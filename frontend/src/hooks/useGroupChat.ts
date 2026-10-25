"use client";

/**
 * All Group Chat state and actions.
 *
 * - The group setup and the chat are saved to localStorage (safely: the page
 *   still works if storage is blocked).
 * - Friends' replies stream in over SSE. Events go through a small queue that
 *   paces them like real people: each friend "types" for at least 700ms
 *   before their message appears, with short gaps between messages.
 * - The user can send at any time. A new message cancels the current reply
 *   stream (AbortController) and queue, then sends with the full history.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { isFriendId, LANGUAGES, MAX_FRIENDS, MIN_FRIENDS, NAME_MAX, type FriendId } from "@/config/friends";
import { newId, type ChatItem, type ChatMessage, type GroupSetup, type RoomEvent } from "@/lib/chatTypes";
import { fetchGroupPoll, streamGroupMessage } from "@/lib/roomsApi";
import { StreamError } from "@/lib/sseClient";
import { loadJson, saveJson } from "@/lib/storage";

const STORAGE_KEY = "huddle.groupChat.v1";
const MAX_STORED_ITEMS = 200;
export const MESSAGE_MAX = 1000;

/** Minimum time a friend shows as typing before their message appears. */
const MIN_TYPING_MS = 700;
/** Extra typing time per character, so longer messages "take longer to type" (capped). */
const TYPING_MS_PER_CHAR = 12;
const MAX_EXTRA_TYPING_MS = 900;

export interface ChatError {
  message: string;
  /** What "Try again" should redo. */
  retry: "message" | "poll";
}

interface Saved {
  setup: GroupSetup | null;
  items: ChatItem[];
  safety: string | null;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));

/** Read the saved chat, dropping anything that doesn't look right (old format, hand-edited, ...). */
function loadSaved(): Saved {
  const empty: Saved = { setup: null, items: [], safety: null };
  const raw = loadJson<Partial<Saved>>(STORAGE_KEY);
  if (!raw || typeof raw !== "object") return empty;

  const s = raw.setup;
  const setupValid =
    !!s &&
    typeof s.groupName === "string" &&
    LANGUAGES.some((l) => l.id === s.language) &&
    Array.isArray(s.friends) &&
    s.friends.length >= MIN_FRIENDS &&
    s.friends.length <= MAX_FRIENDS &&
    s.friends.every((f) => isFriendId(f?.id) && typeof f.name === "string" && f.name.trim().length > 0 && f.name.length <= NAME_MAX);

  const items = Array.isArray(raw.items)
    ? raw.items.filter(
        (item): item is ChatItem =>
          !!item &&
          typeof item.id === "string" &&
          typeof item.ts === "number" &&
          ((item.kind === "message" && typeof item.text === "string" && Array.isArray(item.reactions)) ||
            (item.kind === "poll" && Array.isArray(item.options) && Array.isArray(item.votes))),
      )
    : [];

  return {
    setup: setupValid ? (s as GroupSetup) : null,
    items: setupValid ? items : [],
    safety: typeof raw.safety === "string" ? raw.safety : null,
  };
}

export function useGroupChat() {
  // This hook only runs in the browser (the page loads it with ssr: false), so reading storage here is safe.
  const [initial] = useState(loadSaved);
  const [setup, setSetupState] = useState<GroupSetup | null>(initial.setup);
  const [editing, setEditing] = useState(initial.setup === null);
  const [items, setItems] = useState<ChatItem[]>(initial.items);
  const [typing, setTyping] = useState<FriendId[]>([]);
  const [replying, setReplying] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [safety, setSafety] = useState<string | null>(initial.safety);

  // Refs mirror the latest values for use inside async code.
  const itemsRef = useRef(items);
  const setupRef = useRef(setup);
  /** Bumped for every new reply run; queued events from older runs see a different number and stop. */
  const runRef = useRef(0);
  const streamRef = useRef<AbortController | null>(null);
  const pollRef = useRef<AbortController | null>(null);

  const updateItems = useCallback((update: (prev: ChatItem[]) => ChatItem[]) => {
    itemsRef.current = update(itemsRef.current);
    setItems(itemsRef.current);
  }, []);

  // Save after every change (only the newest items, to keep storage small).
  useEffect(() => {
    if (setup) saveJson(STORAGE_KEY, { setup, items: items.slice(-MAX_STORED_ITEMS), safety });
  }, [setup, items, safety]);

  // Leaving the page (or Next.js hiding it): stop any reply or vote in progress.
  useEffect(
    () => () => {
      runRef.current++;
      streamRef.current?.abort();
      pollRef.current?.abort();
      setTyping([]);
      setReplying(false);
      setPolling(false);
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

  /** Stream the friends' replies to `userMsg`, given the history before it. */
  const runReply = useCallback(
    async (userMsg: ChatMessage, history: ChatItem[]) => {
      const group = setupRef.current;
      if (!group) return;
      streamRef.current?.abort();
      const run = ++runRef.current;
      const alive = () => runRef.current === run;
      const controller = new AbortController();
      streamRef.current = controller;
      setTyping([]);
      setReplying(true);
      setError(null);

      // --- the pacing queue -------------------------------------------------
      const typingSince = new Map<FriendId, number>();
      const showTyping = (id: FriendId) => {
        if (typingSince.has(id)) return;
        typingSince.set(id, Date.now());
        setTyping((t) => (t.includes(id) ? t : [...t, id]));
      };
      const stopTyping = (id: FriendId) => {
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
            await sleep(250 + Math.random() * 450); // small gap before the next friend chimes in
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
        await streamGroupMessage(
          { id: userMsg.id, text: userMsg.text },
          { history, friends: group.friends, language: group.language },
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
    [updateItems],
  );

  /** Send a message. Works while friends are still replying: that reply is cancelled. */
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

  /** Ask the group to vote: one summary call, shown as a poll card in the chat. */
  const askPoll = useCallback(async () => {
    const group = setupRef.current;
    if (!group || pollRef.current) return;
    const controller = new AbortController();
    pollRef.current = controller;
    setPolling(true);
    setError(null);
    try {
      const poll = await fetchGroupPoll(
        { history: itemsRef.current, friends: group.friends, language: group.language },
        controller.signal,
      );
      updateItems((prev) => [...prev, { kind: "poll", id: newId("poll"), ts: Date.now(), ...poll }]);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError({
        message: err instanceof StreamError ? err.message : "Couldn't run the vote. Please try again.",
        retry: "poll",
      });
    } finally {
      if (pollRef.current === controller) {
        pollRef.current = null;
        setPolling(false);
      }
    }
  }, [updateItems]);

  /** Redo whatever failed: the vote, or the friends' reply to your last message. */
  const retry = useCallback(() => {
    if (error?.retry === "poll") {
      void askPoll();
      return;
    }
    const all = itemsRef.current;
    const index = all.findLastIndex((item) => item.kind === "message" && item.sender === "user");
    if (index === -1) return;
    void runReply(all[index] as ChatMessage, all.slice(0, index));
  }, [askPoll, error, runReply]);

  const clearChat = useCallback(() => {
    stopReply();
    pollRef.current?.abort();
    pollRef.current = null;
    setPolling(false);
    updateItems(() => []);
    setSafety(null);
    setError(null);
  }, [stopReply, updateItems]);

  /** Save the setup screen and open the chat. The chat itself is kept. */
  const saveSetup = useCallback((next: GroupSetup) => {
    setupRef.current = next;
    setSetupState(next);
    setEditing(false);
  }, []);

  const editGroup = useCallback(() => {
    stopReply();
    setEditing(true);
  }, [stopReply]);

  return {
    setup,
    editing,
    items,
    typing,
    replying,
    polling,
    error,
    safety,
    hasUserMessage: items.some((item) => item.kind === "message" && item.sender === "user"),
    send,
    askPoll,
    retry,
    clearChat,
    saveSetup,
    editGroup,
    cancelEdit: () => setup && setEditing(false),
    dismissError: () => setError(null),
    dismissSafety: () => setSafety(null),
  };
}

export type GroupChatController = ReturnType<typeof useGroupChat>;
