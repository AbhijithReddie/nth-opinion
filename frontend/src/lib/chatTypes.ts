/**
 * Chat room data shapes: what the page stores, and the SSE events from
 * POST /api/rooms/{room_id}/message (see backend/main.py).
 */

import type { Language } from "@/config/roomChats";

export interface RoomParticipant {
  id: string;
  /** The name the user chose (defaults to the persona's own name). */
  name: string;
}

/** What the setup screen produces. */
export interface RoomSetup {
  /** Group name / startup name. */
  title: string;
  participants: RoomParticipant[];
  language: Language;
  /** Answers to the room's context fields, by field id. */
  context: Record<string, string>;
}

export interface ChatReaction {
  friendId: string;
  emoji: string;
}

export interface ChatMessage {
  kind: "message";
  id: string;
  /** "user" or a persona id. */
  sender: string;
  text: string;
  replyTo: string | null;
  /** Persona ids (or "user") @mentioned in the text. */
  mentions: string[];
  reactions: ChatReaction[];
  /** Unix time in ms. */
  ts: number;
}

/** Group Chat summary: "Ask the group to vote". */
export interface Poll {
  question: string;
  options: string[];
  votes: { friend_id: string; option: string; reason: string }[];
}

/** Shark Tank summary: "Ask for offers". */
export interface InvestorDecision {
  friend_id: string;
  decision: "offer" | "out";
  amount_lakh: number | null;
  equity_percent: number | null;
  conditions: string | null;
  reason: string;
}

export interface Offers {
  summary: string;
  strengths: string[];
  concerns: string[];
  decisions: InvestorDecision[];
}

/** A room's final output, shown as a card in the chat. */
export type SummaryItem = { kind: "summary"; id: string; ts: number } & (
  | { type: "poll"; data: Poll }
  | { type: "offers"; data: Offers }
);

export type ChatItem = ChatMessage | SummaryItem;

/** One SSE event from the room, already JSON-decoded. */
export type RoomEvent =
  | { type: "typing"; friend_id: string }
  | { type: "message"; id: string; friend_id: string; text: string; reply_to: string | null; mentions: string[] }
  | { type: "reaction"; friend_id: string; message_id: string; emoji: string }
  | { type: "safety"; helpline_text: string }
  | { type: "your_turn" }
  | { type: "error"; message: string };

/** A short random id; works on plain-http pages where crypto.randomUUID is unavailable. */
export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
