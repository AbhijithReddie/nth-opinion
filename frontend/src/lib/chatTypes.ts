/**
 * Chat room data shapes: what the page stores, and the SSE events from
 * POST /api/rooms/{room_id}/message (see backend/main.py).
 */

import type { Language } from "@/config/roomChats";
import type { TraceEvent } from "./trace";

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

/** Pitch Tank summary: "Ask for offers". */
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

/** Roast & Toast summary: "Get my scorecard". */
export interface Scorecard {
  overall: number;
  verdict: string;
  scores: { category: string; score: number; note: string }[];
  fixes: { title: string; detail: string; friend_id: string | null }[];
  best_roast: string;
  best_toast: string;
}

/** Interview Panel summary: "End interview & get feedback". */
export interface InterviewResult {
  decision: "offer" | "no_offer";
  summary: string;
  verdicts: { friend_id: string; recommendation: "strong_hire" | "hire" | "no_hire" | "strong_no_hire"; reason: string }[];
  competencies: { name: string; score: number; note: string }[];
  strengths: string[];
  improvements: string[];
}

/** Future You summary: "Get letters from future you". */
export interface FutureLetters {
  decision: string;
  paths: { option: string; upside: string; risk: string }[];
  letters: { friend_id: string; letter: string }[];
  next_steps: string[];
  question: string;
}

/** Study Group summary: "Make my study notes". */
export interface StudyNotes {
  topic: string;
  key_points: string[];
  memory_trick: string;
  quiz: { question: string; answer: string }[];
  weak_spots: string[];
  next_topics: string[];
}

/** A room's final output: its type and data. */
export type SummaryData =
  | { type: "poll"; data: Poll }
  | { type: "offers"; data: Offers }
  | { type: "scorecard"; data: Scorecard }
  | { type: "interview"; data: InterviewResult }
  | { type: "letters"; data: FutureLetters }
  | { type: "notes"; data: StudyNotes };

/** A room's final output, shown as a card in the chat. */
export type SummaryItem = { kind: "summary"; id: string; ts: number } & SummaryData;

/** A divider in the chat marking a switch between room modes (e.g. Roast -> Toast). */
export interface ModeItem {
  kind: "mode";
  id: string;
  ts: number;
  mode: string;
}

export type ChatItem = ChatMessage | SummaryItem | ModeItem;

/** One SSE event from the room, already JSON-decoded. */
export type RoomEvent =
  | TraceEvent
  | { type: "typing"; friend_id: string }
  | { type: "message"; id: string; friend_id: string; text: string; reply_to: string | null; mentions: string[] }
  | { type: "reaction"; friend_id: string; message_id: string; emoji: string }
  | { type: "safety"; helpline_text: string }
  | { type: "mode"; mode: string }
  | { type: "your_turn" }
  | { type: "error"; message: string; code?: string };

/** A short random id; works on plain-http pages where crypto.randomUUID is unavailable. */
export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
