"use client";

/**
 * All state and actions for a chat room (Group Chat, Pitch Tank, ...).
 *
 * - The room setup and the chat are saved to localStorage (safely: the page
 *   still works if storage is blocked).
 * - Replies stream in over SSE. Events go through a small queue that paces
 *   them like real people: each persona "types" for at least 700ms before
 *   their message appears, with short gaps between messages.
 * - The user can send at any time. A new message cancels the current reply
 *   stream (AbortController) and queue, then sends with the full history.
 * - Rooms with modes (e.g. Roast -> Toast) track the current mode, send it with
 *   each message, and switch when the server or the user says so.
 * - Demo replay mode (`replay` given): plays a recorded conversation through the
 *   same queue and state, on the replay's clock, and never touches saved chats.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { findBuiltIn, LANGUAGES, MESSAGE_MAX, NAME_MAX, personaById, type RoomChatConfig } from "@/config/roomChats";
import { newId, type ChatItem, type ChatMessage, type RoomEvent, type RoomSetup, type SummaryItem } from "@/lib/chatTypes";
import { playEvents, type ReplayClock, type RoomReplay } from "@/lib/replay";
import { fetchRoomSummary, streamRoomMessage } from "@/lib/roomsApi";
import { StreamError, type SlowState } from "@/lib/sseClient";
import { applyTrace, EMPTY_TRACE, type TraceState } from "@/lib/trace";
import { loadJson, removeKey, saveJson } from "@/lib/storage";

const MAX_STORED_ITEMS = 200;

/** Minimum time a persona shows as typing before their message appears. */
const MIN_TYPING_MS = 700;
/** Extra typing time per character, so longer messages "take longer to type" (capped). */
const TYPING_MS_PER_CHAR = 12;
const MAX_EXTRA_TYPING_MS = 900;

export interface ChatError {
  message: string;
  /** What "Try again" should redo. */
  retry: "message" | "summary";
  /** Why it failed (see StreamError), so the chat can offer the demo replay. */
  code?: string;
}

/** A recording to play instead of talking to the server (demo replay mode). */
export interface RoomReplayPlayback {
  recording: RoomReplay;
  clock: ReplayClock;
}

interface Saved {
  setup: RoomSetup | null;
  items: ChatItem[];
  safety: string | null;
  mode: string | null;
}

/** The mode a room starts in (null for rooms without modes). */
const firstMode = (config: RoomChatConfig) => config.modes?.[0]?.id ?? null;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));

/** True if a saved (or recorded) setup still fits the room's config (personas, limits, required fields). */
export function isValidSetup(config: RoomChatConfig, s: Partial<RoomSetup> | undefined): s is RoomSetup {
  if (!s || typeof s.title !== "string" || !LANGUAGES.some((l) => l.id === s.language)) return false;
  if (!s.context || typeof s.context !== "object") return false;
  if (config.contextFields.some((f) => f.required && !s.context?.[f.id]?.trim())) return false;
  if (config.title.contextKey && !s.title.trim()) return false;
  const people = s.participants;
  const guests = s.guests ?? [];
  const custom = Array.isArray(s.custom) ? s.custom : [];
  const named = (p: { id: string; name: string } | undefined) => !!p && typeof p.name === "string" && !!p.name.trim() && p.name.length <= NAME_MAX;
  // Members: the room's own personas, or (Group Chat) the user's own. Guests: the user's own, or another room's.
  const isMember = (id: string) => !!personaById(config, id) || (!!config.customMembers && custom.some((c) => c.id === id));
  const isGuestOk = (id: string) => custom.some((c) => c.id === id) || (!!findBuiltIn(id) && !personaById(config, id));
  return (
    Array.isArray(people) &&
    people.length >= config.cast.min &&
    people.length <= config.cast.max &&
    people.every((p) => named(p) && isMember(p.id)) &&
    Array.isArray(guests) &&
    guests.length <= (config.guests?.max ?? 0) &&
    people.length + guests.length <= (config.guests?.maxTotal ?? Infinity) &&
    guests.every((g) => named(g) && isGuestOk(g.id))
  );
}

function isValidItem(item: ChatItem): boolean {
  if (!item || typeof item.id !== "string" || typeof item.ts !== "number") return false;
  if (item.kind === "message") return typeof item.text === "string" && Array.isArray(item.reactions);
  if (item.kind === "mode") return typeof item.mode === "string";
  return item.kind === "summary" && !!item.data && ["poll", "offers", "scorecard", "interview", "letters", "notes"].includes(item.type);
}

/** Group Chats saved before rooms were generalised used a different shape; convert them once. */
const LEGACY_GROUP_CHAT_KEY = "huddle.groupChat.v1";
type LegacyItem = ChatItem | { kind: "poll"; id: string; ts: number; question: string; options: string[]; votes: [] };
function loadLegacyGroupChat(): Partial<Saved> | null {
  const raw = loadJson<{ setup?: { groupName: string; friends: RoomSetup["participants"]; language: RoomSetup["language"] }; items?: LegacyItem[]; safety?: string | null }>(LEGACY_GROUP_CHAT_KEY);
  if (!raw?.setup) return null;
  removeKey(LEGACY_GROUP_CHAT_KEY);
  return {
    setup: { title: raw.setup.groupName, participants: raw.setup.friends, language: raw.setup.language, context: {} },
    items: (raw.items ?? []).map((item) =>
      item.kind === "poll"
        ? { kind: "summary", type: "poll", id: item.id, ts: item.ts, data: { question: item.question, options: item.options, votes: item.votes } }
        : item,
    ),
    safety: raw.safety ?? null,
  };
}

/** Read the saved room, dropping anything that doesn't look right (old format, hand-edited, ...). */
function loadSaved(config: RoomChatConfig): Saved {
  let raw = loadJson<Partial<Saved>>(config.storageKey);
  if (!raw && config.roomId === "group-chat") raw = loadLegacyGroupChat();
  if (!raw || typeof raw !== "object" || !isValidSetup(config, raw.setup ?? undefined)) {
    return { setup: null, items: [], safety: null, mode: firstMode(config) };
  }
  return {
    setup: raw.setup!,
    items: Array.isArray(raw.items) ? raw.items.filter(isValidItem) : [],
    safety: typeof raw.safety === "string" ? raw.safety : null,
    mode: config.modes?.some((m) => m.id === raw.mode) ? raw.mode! : firstMode(config),
  };
}

/** `behindTheScenes` asks the server for trace events (the panel is open); replays play whatever was recorded. */
export function useRoomChat(config: RoomChatConfig, replay?: RoomReplayPlayback, behindTheScenes = false) {
  // This hook only runs in the browser (the page loads it with ssr: false), so reading storage here is safe.
  const [initial] = useState<Saved>(() =>
    replay ? { setup: replay.recording.setup, items: [], safety: null, mode: firstMode(config) } : loadSaved(config),
  );
  const [setup, setSetupState] = useState<RoomSetup | null>(initial.setup);
  const [editing, setEditing] = useState(initial.setup === null);
  const [items, setItems] = useState<ChatItem[]>(initial.items);
  const [typing, setTyping] = useState<string[]>([]);
  const [replying, setReplying] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [safety, setSafety] = useState<string | null>(initial.safety);
  const [mode, setModeState] = useState<string | null>(initial.mode);
  const [slow, setSlow] = useState<SlowState>(null);
  /** The current turn, for the "Behind the scenes" panel. */
  const [trace, setTrace] = useState<TraceState>(EMPTY_TRACE);
  const behindTheScenesRef = useRef(behindTheScenes);
  useEffect(() => {
    behindTheScenesRef.current = behindTheScenes;
  }, [behindTheScenes]);

  // Refs mirror the latest values for use inside async code.
  const itemsRef = useRef(items);
  const setupRef = useRef(setup);
  const modeRef = useRef(mode);
  /** Bumped for every new reply run; queued events from older runs see a different number and stop. */
  const runRef = useRef(0);
  const streamRef = useRef<AbortController | null>(null);
  const summaryRef = useRef<AbortController | null>(null);

  const updateItems = useCallback((update: (prev: ChatItem[]) => ChatItem[]) => {
    itemsRef.current = update(itemsRef.current);
    setItems(itemsRef.current);
  }, []);

  // Save after every change (only the newest items, to keep storage small). Replays are never saved.
  useEffect(() => {
    if (setup && !replay) saveJson(config.storageKey, { setup, items: items.slice(-MAX_STORED_ITEMS), safety, mode });
  }, [config.storageKey, replay, setup, items, safety, mode]);

  // In a replay every wait runs on the replay's clock (pause, 2x, skip to the end).
  const wait = replay?.clock.sleep ?? sleep;

  /** Switch the room's mode and mark the switch in the chat with a divider. Unknown modes are ignored. */
  const applyMode = useCallback(
    (next: string) => {
      if (next === modeRef.current || !config.modes?.some((m) => m.id === next)) return;
      modeRef.current = next;
      setModeState(next);
      updateItems((prev) => [...prev, { kind: "mode", id: newId("mode"), ts: Date.now(), mode: next }]);
    },
    [config.modes, updateItems],
  );

  // Leaving the page (or Next.js hiding it): stop any reply or summary in progress.
  useEffect(
    () => () => {
      runRef.current++;
      streamRef.current?.abort();
      summaryRef.current?.abort();
      setTyping([]);
      setReplying(false);
      setSummarizing(false);
    },
    [],
  );

  /** Cancel the reply in progress: abort the request and drop anything still queued. */
  const stopReply = useCallback(() => {
    runRef.current++;
    streamRef.current?.abort();
    streamRef.current = null;
    setTyping([]);
    setReplying(false);
  }, []);

  /** Stream the room's replies to `userMsg`, given the history before it. */
  const runReply = useCallback(
    async (userMsg: ChatMessage, history: ChatItem[]) => {
      const room = setupRef.current;
      if (!room) return;
      streamRef.current?.abort();
      const run = ++runRef.current;
      const alive = () => runRef.current === run;
      const controller = new AbortController();
      streamRef.current = controller;
      setTyping([]);
      setReplying(true);
      setError(null);
      setTrace(EMPTY_TRACE);

      // --- the pacing queue -------------------------------------------------
      const typingSince = new Map<string, number>();
      const showTyping = (id: string) => {
        if (typingSince.has(id)) return;
        typingSince.set(id, Date.now());
        setTyping((t) => (t.includes(id) ? t : [...t, id]));
      };
      const stopTyping = (id: string) => {
        typingSince.delete(id);
        setTyping((t) => t.filter((x) => x !== id));
      };
      let queue = Promise.resolve();
      let failure: string | null = null;
      let failureCode: string | undefined;

      const handle = async (event: RoomEvent) => {
        if (!alive()) return;
        switch (event.type) {
          case "typing":
            showTyping(event.friend_id);
            break;
          case "message": {
            // Keep "typing..." up for a natural minimum before the message lands.
            showTyping(event.friend_id);
            const extra = Math.min(event.text.length * TYPING_MS_PER_CHAR, MAX_EXTRA_TYPING_MS);
            await wait(typingSince.get(event.friend_id)! + MIN_TYPING_MS + extra - Date.now());
            if (!alive()) return;
            stopTyping(event.friend_id);
            updateItems((prev) => [
              ...prev,
              {
                kind: "message",
                id: event.id,
                sender: event.friend_id,
                text: event.text,
                replyTo: event.reply_to ?? null,
                mentions: event.mentions ?? [],
                reactions: [],
                ts: Date.now(),
              },
            ]);
            await wait(250 + Math.random() * 450); // small gap before the next persona chimes in
            break;
          }
          case "reaction":
            await wait(300);
            if (!alive()) return;
            updateItems((prev) =>
              prev.map((item) =>
                item.kind === "message" &&
                item.id === event.message_id &&
                !item.reactions.some((r) => r.friendId === event.friend_id && r.emoji === event.emoji)
                  ? { ...item, reactions: [...item.reactions, { friendId: event.friend_id, emoji: event.emoji }] }
                  : item,
              ),
            );
            break;
          case "safety":
            setSafety(event.helpline_text);
            break;
          case "mode":
            applyMode(event.mode);
            break;
          case "error":
            failure = event.message;
            failureCode = event.code;
            break;
          case "your_turn":
            break;
        }
        // Trace events wait in the same queue, so the panel stays in step with the chat.
        if (alive()) setTrace((t) => applyTrace(t, event));
      };
      // -----------------------------------------------------------------------

      const onEvent = (event: RoomEvent) => {
        queue = queue.then(() => handle(event));
      };
      try {
        if (replay) {
          await playEvents(replay.recording.events, onEvent, replay.clock, controller.signal);
        } else {
          const message = { id: userMsg.id, text: userMsg.text };
          await streamRoomMessage(
            config,
            room,
            history,
            message,
            modeRef.current,
            onEvent,
            controller.signal,
            setSlow,
            behindTheScenesRef.current,
          );
        }
      } catch (err) {
        if (!alive()) return; // replaced by a newer message, cleared, or the page closed
        failure = err instanceof StreamError ? err.message : "Something unexpected went wrong. Please try again.";
        failureCode = err instanceof StreamError ? err.code : undefined;
      }

      await queue; // let the messages that already arrived finish "typing"
      if (!alive()) return;
      streamRef.current = null;
      setTyping([]);
      setReplying(false);
      if (failure) setError({ message: failure, retry: "message", code: failureCode });
    },
    [applyMode, config, replay, updateItems, wait],
  );

  /** Send a message. Works while the room is still replying: that reply is cancelled. */
  const send = useCallback(
    (text: string): boolean => {
      const clean = text.trim();
      if (!clean || clean.length > MESSAGE_MAX || !setupRef.current) return false;
      const history = itemsRef.current;
      const message: ChatMessage = {
        kind: "message",
        id: newId("u"),
        sender: "user",
        text: clean,
        replyTo: null,
        mentions: [],
        reactions: [],
        ts: Date.now(),
      };
      updateItems((prev) => [...prev, message]);
      void runReply(message, history);
      return true;
    },
    [runReply, updateItems],
  );

  /** The room's final output (a poll, investor offers, ...), shown as a card in the chat. */
  const requestSummary = useCallback(async () => {
    const room = setupRef.current;
    if (!room || summaryRef.current) return;
    const controller = new AbortController();
    summaryRef.current = controller;
    setSummarizing(true);
    setError(null);
    try {
      let data: SummaryItem["data"];
      if (replay?.recording.summary) {
        await replay.clock.sleep(1500); // as if the room were thinking it over
        data = replay.recording.summary;
      } else {
        data = await fetchRoomSummary(config, room, itemsRef.current, controller.signal);
      }
      updateItems((prev) => [
        ...prev,
        { kind: "summary", type: config.summary.type, id: newId("summary"), ts: Date.now(), data } as ChatItem,
      ]);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError({
        message: err instanceof StreamError ? err.message : "Couldn't wrap this up. Please try again.",
        retry: "summary",
        code: err instanceof StreamError ? err.code : undefined,
      });
    } finally {
      if (summaryRef.current === controller) {
        summaryRef.current = null;
        setSummarizing(false);
      }
    }
  }, [config, replay, updateItems]);

  // Demo replay mode: post the recorded message, play the replies, then the summary.
  // (Restarts cleanly if React re-runs the effect, e.g. in development's Strict Mode.)
  useEffect(() => {
    if (!replay) return;
    let disposed = false;
    const { message, summary } = replay.recording;
    const userMsg: ChatMessage = {
      kind: "message",
      id: message.id,
      sender: "user",
      text: message.text,
      replyTo: null,
      mentions: [],
      reactions: [],
      ts: Date.now(),
    };
    updateItems(() => [userMsg]);
    void runReply(userMsg, []).then(() => {
      if (!disposed && summary) void requestSummary();
    });
    return () => {
      disposed = true;
    };
  }, [replay, requestSummary, runReply, updateItems]);

  /** Redo whatever failed: the summary, or the replies to your last message. */
  const retry = useCallback(() => {
    if (error?.retry === "summary") {
      void requestSummary();
      return;
    }
    const all = itemsRef.current;
    const index = all.findLastIndex((item) => item.kind === "message" && item.sender === "user");
    if (index === -1) return;
    void runReply(all[index] as ChatMessage, all.slice(0, index));
  }, [error, requestSummary, runReply]);

  const clearChat = useCallback(() => {
    stopReply();
    summaryRef.current?.abort();
    summaryRef.current = null;
    setSummarizing(false);
    updateItems(() => []);
    setSafety(null);
    setError(null);
    modeRef.current = firstMode(config);
    setModeState(modeRef.current);
  }, [config, stopReply, updateItems]);

  /** Save the setup screen and open the chat. The chat itself is kept. */
  const saveSetup = useCallback((next: RoomSetup) => {
    setupRef.current = next;
    setSetupState(next);
    setEditing(false);
  }, []);

  const editSetup = useCallback(() => {
    stopReply();
    setEditing(true);
  }, [stopReply]);

  return {
    config,
    setup,
    editing,
    items,
    typing,
    replying,
    summarizing,
    error,
    /** The reply is slow to start (server waking up, or no answer yet); null otherwise. */
    slow,
    /** What the "Behind the scenes" panel shows for the current turn. */
    trace,
    safety,
    /** Current mode id, for rooms with modes. */
    mode,
    hasUserMessage: items.some((item) => item.kind === "message" && item.sender === "user"),
    send,
    requestSummary,
    retry,
    clearChat,
    saveSetup,
    editSetup,
    /** The user switches mode (e.g. "Switch to real feedback"); it applies from their next message. */
    switchMode: applyMode,
    cancelEdit: () => setup && setEditing(false),
    dismissError: () => setError(null),
    dismissSafety: () => setSafety(null),
  };
}

export type RoomChatController = ReturnType<typeof useRoomChat>;
