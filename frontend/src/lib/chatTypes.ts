/**
 * Group Chat data shapes: what the page stores, and the SSE events from
 * POST /api/rooms/group-chat/message (see backend/main.py).
 */

import type { FriendId, Language } from "@/config/friends";

export interface GroupFriend {
  id: FriendId;
  /** The name the user chose (defaults to the friend's own name). */
  name: string;
}

export interface GroupSetup {
  groupName: string;
  friends: GroupFriend[];
  language: Language;
}

export interface ChatReaction {
  friendId: FriendId;
  emoji: string;
}

export interface ChatMessage {
  kind: "message";
  id: string;
  sender: "user" | FriendId;
  text: string;
  replyTo: string | null;
  /** Friend ids (or "user") @mentioned in the text. */
  mentions: string[];
  reactions: ChatReaction[];
  /** Unix time in ms. */
  ts: number;
}

export interface PollVote {
  friend_id: FriendId;
  option: string;
  reason: string;
}

export interface Poll {
  question: string;
  options: string[];
  votes: PollVote[];
}

/** A poll card shown in the chat after "Ask the group to vote". */
export interface PollItem extends Poll {
  kind: "poll";
  id: string;
  ts: number;
}

export type ChatItem = ChatMessage | PollItem;

/** One SSE event from the room, already JSON-decoded. */
export type RoomEvent =
  | { type: "typing"; friend_id: FriendId }
  | { type: "message"; id: string; friend_id: FriendId; text: string; reply_to: string | null; mentions: string[] }
  | { type: "reaction"; friend_id: FriendId; message_id: string; emoji: string }
  | { type: "safety"; helpline_text: string }
  | { type: "your_turn" }
  | { type: "error"; message: string };

/** A short random id; works on plain-http pages where crypto.randomUUID is unavailable. */
export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
