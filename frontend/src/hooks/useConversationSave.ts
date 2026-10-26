"use client";

import { useEffect, useRef, useState } from "react";
import { account, AccountError, conversationData } from "@/lib/account";
import type { ChatItem, RoomSetup } from "@/lib/chatTypes";
import { loadSavePref, storeSavePref, type SavePref } from "@/lib/conversationSave";
import { useAuth } from "./useAuth";

export type SaveStatus = { kind: "idle" | "saving" | "saved" } | { kind: "error"; message: string };

/**
 * "Save conversation" for one room (signed-in users only; off by default). While it's
 * on, the conversation is saved after every turn (once the room has finished replying).
 * If the support message appeared, nothing is saved until the user agrees (`askSafety`).
 * Uploaded documents are never part of what's saved (lib/account.ts conversationData).
 */
export function useConversationSave({
  roomId,
  setup,
  items,
  replying,
  safety,
  enabled = true,
}: {
  roomId: string;
  setup: RoomSetup;
  items: ChatItem[];
  replying: boolean;
  safety: string | null;
  /** False in demo replays: nothing to save. */
  enabled?: boolean;
}) {
  const auth = useAuth();
  const userId = enabled ? (auth.user?.id ?? null) : null;
  // The preference for this room and user (read from this browser; re-read when the user changes).
  const [stored, setStored] = useState<{ owner: string; pref: SavePref } | null>(null);
  const pref = userId ? (stored?.owner === `${roomId}:${userId}` ? stored.pref : loadSavePref(roomId, userId)) : null;
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  const lastSaved = useRef<string | null>(null);

  const update = (next: SavePref) => {
    storeSavePref(roomId, next);
    setStored({ owner: `${roomId}:${next.userId}`, pref: next });
  };

  const askSafety = !!pref?.on && !!safety && !pref.safetyOk;
  const active = !!pref?.on && !askSafety && !replying;

  useEffect(() => {
    if (!pref || !active) return;
    if (!items.length) {
      // Cleared chat: the next messages become a new saved conversation.
      lastSaved.current = null;
      if (!pref.id) return;
      const timer = setTimeout(() => update({ ...pref, id: null }), 0);
      return () => clearTimeout(timer);
    }
    const data = conversationData(roomId, setup, items, !!safety);
    const signature = JSON.stringify(data);
    if (signature === lastSaved.current) return;
    const timer = setTimeout(async () => {
      setStatus({ kind: "saving" });
      try {
        if (pref.id) {
          try {
            await account.updateConversation(pref.id, data);
          } catch (e) {
            if (!(e instanceof AccountError && e.code === "not_found")) throw e;
            update({ ...pref, id: (await account.createConversation(data)).id }); // deleted elsewhere: save anew
          }
        } else {
          update({ ...pref, id: (await account.createConversation(data)).id });
        }
        lastSaved.current = signature;
        setStatus({ kind: "saved" });
      } catch (e) {
        setStatus({ kind: "error", message: e instanceof AccountError ? e.message : "Couldn't save this conversation." });
      }
    }, 800);
    return () => clearTimeout(timer);
    // `pref` is re-read every render; its fields that matter are listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, items, setup, safety, roomId, pref?.id, pref?.on]);

  return {
    /** Shown only to signed-in users. */
    available: !!pref,
    on: !!pref?.on,
    status,
    askSafety,
    setOn(on: boolean) {
      if (!pref) return;
      setStatus({ kind: "idle" });
      // Turning it on with the support message showing asks first (askSafety), defaulting to no.
      update({ ...pref, on, safetyOk: on ? pref.safetyOk : false });
    },
    /** The answer to "save a conversation that triggered the safety layer?". */
    answerSafety(save: boolean) {
      if (pref) update(save ? { ...pref, safetyOk: true } : { ...pref, on: false, safetyOk: false });
    },
  };
}

export type ConversationSave = ReturnType<typeof useConversationSave>;
