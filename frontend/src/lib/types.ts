/**
 * Shapes of the data sent by the FastAPI backend (backend/main.py).
 * Keep these in sync with the SSE events documented there.
 */

export type Speaker = "pro" | "con";
export type Winner = Speaker | "tie";

export interface SideScores {
  logic: number;
  evidence: number;
  rebuttal: number;
}

export interface Verdict {
  scores: Record<Speaker, SideScores>;
  winner: Winner;
  memo: string;
}

/** One SSE event from POST /api/debate, already JSON-decoded. */
export type DebateEvent =
  | { type: "turn_start"; speaker: Speaker; round: number }
  | { type: "token"; speaker: Speaker; text: string }
  | { type: "turn_end"; speaker: Speaker; round: number; text: string }
  | ({ type: "judge" } & Verdict)
  | { type: "done" }
  | { type: "error"; message: string };

/** A single speech in the debate, as shown in a TurnCard. */
export interface Turn {
  speaker: Speaker;
  round: number;
  text: string;
  /** False while tokens are still streaming in. */
  complete: boolean;
}

/**
 * Where the debate is right now.
 * idle -> connecting -> debating -> judging -> done, or -> error at any point.
 */
export type Phase = "idle" | "connecting" | "debating" | "judging" | "done" | "error";
