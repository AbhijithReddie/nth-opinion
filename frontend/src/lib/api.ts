/**
 * Client for POST /api/debate.
 *
 * The streaming itself lives in sseClient.ts (shared with the rooms); this
 * file adds the debate's event names and its user-facing error messages.
 * Every way this can fail ends in a thrown DebateError.
 */

import { StreamError, streamSse, type SlowState } from "./sseClient";
import { TRACE_EVENT_TYPES } from "./trace";
import type { DebateEvent } from "./types";

export { API_URL } from "./sseClient";
export { StreamError as DebateError };

export const TOPIC_MIN = 5;
export const TOPIC_MAX = 200;

const EVENT_TYPES = new Set(["turn_start", "token", "turn_end", "judge", "done", "error", ...TRACE_EVENT_TYPES]);
const FINAL_EVENTS = new Set(["done", "error"]);

export async function streamDebate(
  topic: string,
  rounds: number,
  onEvent: (event: DebateEvent) => void,
  signal: AbortSignal,
  onSlow?: (slow: SlowState) => void,
  /** Also stream trace events for the "Behind the scenes" panel. */
  behindTheScenes = false,
  /** A language id from config/languages (plain English sends nothing extra, as before). */
  language = "english",
): Promise<void> {
  const body = { topic, rounds, ...(behindTheScenes ? { behind_the_scenes: true } : {}), ...(language !== "english" ? { language } : {}) };
  await streamSse<DebateEvent>({
    path: "/api/debate",
    body,
    eventTypes: EVENT_TYPES,
    finalEvents: FINAL_EVENTS,
    onEvent,
    signal,
    onSlow,
    messages: {
      unreachable: "Can't reach the arena server. Make sure the backend is running and try again.",
      slowStart: "The arena server took too long to respond. Please try again.",
      lost: "The connection to the arena was lost mid-debate. Please try again.",
      stalled: "The debate stalled and timed out. Please try again.",
      closedEarly: "The connection closed before the debate finished. Please try again.",
      http: (status, detail) => {
        if (status === 429) return detail ?? "You've hit the debate limit for now. Please try again later.";
        if (status === 422) return detail ?? `Topic must be between ${TOPIC_MIN} and ${TOPIC_MAX} characters.`;
        return `The arena server ran into a problem (error ${status}). Please try again.`;
      },
    },
  });
}
