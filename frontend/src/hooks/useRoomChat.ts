"use client";

/**
 * All state and actions for a chat room (Group Chat, Shark Tank, ...).
 *
 * - The room setup and the chat are saved to localStorage (safely: the page
 *   still works if storage is blocked).
 * - Replies stream in over SSE. Events go through a small queue that paces
 *   them like real people: each persona "types" for at least 700ms before
 *   their message appears, with short gaps between messages.
 * - The user can send at any time. A new message cancels the current reply
 *   stream (AbortController) and queue, then sends with the full history.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { LANGUAGES, MESSAGE_MAX, NAME_MAX, personaById, type RoomChatConfig } from "@/config/roomChats";
import { newId, type ChatItem, type ChatMessage, type RoomEvent, type RoomSetup } from "@/lib/chatTypes";
import { fetchRoomSummary, streamRoomMessage } from "@/lib/roomsApi";
import { StreamError } from "@/lib/sseClient";
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
}

interface Saved {
  setup: RoomSetup | null;
  items: ChatItem[];
  safety: string | null;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));

/** True if a saved setup still fits the room's config (personas, limits, required fields). */
function isValidSetup(config: RoomChatConfig, s: Partial<RoomSetup> | undefined): s is RoomSetup {
  if (!s || typeof s.title !== "string" || !LANGUAGES.some((l) => l.id === s.language)) return false;
  if (!s.context || typeof s.context !== "object") return false;
  if (config.contextFields.some((f) => f.required && !s.context?.[f.id]?.trim())) return false;
  if (config.title.contextKey && !s.title.trim()) return false;
  const people = s.participants;
  return (
    Array.isArray(people) &&
    people.length >= config.cast.min &&
    people.length <= config.cast.max &&
    people.every((p) => !!personaById(config, p?.id) && typeof p.name === "string" && !!p.name.trim() && p.name.length <= NAME_MAX)
  );
}

function isValidItem(item: ChatItem): boolean {
  if (!item || typeof item.id !== "string" || typeof item.ts !== "number") return false;
  if (item.kind === "message") return typeof item.text === "string" && Array.isArray(item.reactions);
  return item.kind === "summary" && !!item.data && (item.type === "poll" || item.type === "offers");
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
    return { setup: null, items: [], safety: null };
  }
  return {
    setup: raw.setup!,
    items: Array.isArray(raw.items) ? raw.items.filter(isValidItem) : [],
    safety: typeof raw.safety === "string" ? raw.safety : null,
  };
}

export function useRoomChat(config: RoomChatConfig) {
  // This hook only runs in the browser (the page loads it with ssr: false), so reading storage here is safe.
  const [initial] = useState(() => loadSaved(config));
  const [setup, setSetupState] = useState<RoomSetup | null>(initial.setup);
  const [editing, setEditing] = useState(initial.setup === null);
  const [items, setItems] = useState<ChatItem[]>(initial.items);
  const [typing, setTyping] = useState<string[]>([]);
  const [replying, setReplying] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [safety, setSafety] = useState<string | null>(initial.safety);

  // Refs mirror the latest values for use inside async code.
  const itemsRef = useRef(items);
  const setupRef = useRef(setup);
  /** Bumped for every new reply run; queued events from older runs see a different number and stop. */
  const runRef = useRef(0);
  const streamRef = useRef<AbortController | null>(null);
  const summaryRef = useRef<AbortController | null>(null);

  const updateItems = useCallback((update: (prev: ChatItem[]) => ChatItem[]) => {
    itemsRef.current = update(itemsRef.current);
    setItems(itemsRef.current);
  }, []);

  // Save after every change (only the newest items, to keep storage small).
  useEffect(() => {
    if (setup) saveJson(config.storageKey, { setup, items: items.slice(-MAX_STORED_ITEMS), safety });
  }, [config.storageKey, setup, items, safety]);

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
            await sleep(typingSince.get(event.friend_id)! + MIN_TYPING_MS + extra - Date.now());
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
            await sleep(250 + Math.random() * 450); // small gap before the next persona chimes in
            break;
          }
          case "reaction":
            await sleep(300);
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
          case "error":
            failure = event.message;
            break;
          case "your_turn":
            break;
        }
      };
      // -----------------------------------------------------------------------

      try {
        await streamRoomMessage(
          config,
          room,
          history,
          { id: userMsg.id, text: userMsg.text },
          (event) => {
            queue = queue.then(() => handle(event));
          },
          controller.signal,
        );
      } catch (err) {
        if (!alive()) return; // replaced by a newer message, cleared, or the page closed
        failure = err instanceof StreamError ? err.message : "Something unexpected went wrong. Please try again.";
      }

      await queue; // let the messages that already arrived finish "typing"
      if (!alive()) return;
      streamRef.current = null;
      setTyping([]);
      setReplying(false);
      if (failure) setError({ message: failure, retry: "message" });
    },
    [config, updateItems],
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
      const data = await fetchRoomSummary(config, room, itemsRef.current, controller.signal);
      updateItems((prev) => [
        ...prev,
        { kind: "summary", type: config.summary.type, id: newId("summary"), ts: Date.now(), data } as ChatItem,
      ]);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError({
        message: err instanceof StreamError ? err.message : "Couldn't wrap this up. Please try again.",
        retry: "summary",
      });
    } finally {
      if (summaryRef.current === controller) {
        summaryRef.current = null;
        setSummarizing(false);
      }
    }
  }, [config, updateItems]);

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
  }, [stopReply, updateItems]);

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
    safety,
    hasUserMessage: items.some((item) => item.kind === "message" && item.sender === "user"),
    send,
    requestSummary,
    retry,
    clearChat,
    saveSetup,
    editSetup,
    cancelEdit: () => setup && setEditing(false),
    dismissError: () => setError(null),
    dismissSafety: () => setSafety(null),
  };
}

export type RoomChatController = ReturnType<typeof useRoomChat>;
