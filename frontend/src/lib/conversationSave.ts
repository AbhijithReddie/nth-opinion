/**
 * "Save conversation" (signed-in users, off by default): which rooms save, to which
 * saved conversation, and whether the user agreed to save one that triggered the
 * safety layer. Remembered per room and per user in this browser.
 */

import { ROOM_CHATS } from "@/config/roomChats";
import type { Conversation } from "./account";
import { loadJson, saveJson } from "./storage";

export interface SavePref {
  userId: string;
  on: boolean;
  /** The saved conversation this room updates (null until the first save). */
  id: string | null;
  /** The user said yes to saving although the support message appeared. */
  safetyOk: boolean;
}

const key = (roomId: string) => `nth-opinion.save.${roomId}`;

export function loadSavePref(roomId: string, userId: string): SavePref {
  const saved = loadJson<SavePref>(key(roomId));
  return saved && saved.userId === userId ? saved : { userId, on: false, id: null, safetyOk: false };
}

export function storeSavePref(roomId: string, pref: SavePref) {
  saveJson(key(roomId), pref);
}

/**
 * Resume: put a saved conversation back into its room (the room reads its chat from
 * this browser's storage, as always) and keep saving to the same conversation.
 * Returns false for a room that no longer exists.
 */
export function restoreConversation(conversation: Conversation, userId: string): boolean {
  const config = ROOM_CHATS[conversation.room_id as keyof typeof ROOM_CHATS];
  if (!config) return false;
  const messages = conversation.messages.filter((m) => m.kind === "message");
  const summary = conversation.result && typeof conversation.result === "object" ? [conversation.result] : [];
  saveJson(config.storageKey, { setup: conversation.setup, items: [...messages, ...summary], safety: null, mode: null });
  storeSavePref(conversation.room_id, { userId, on: true, id: conversation.id, safetyOk: conversation.safety_flagged });
  return true;
}
