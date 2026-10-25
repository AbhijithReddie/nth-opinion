/**
 * Client for POST /api/debate.
 *
 * Opens the request with fetch, reads the SSE stream from the response body,
 * and hands each decoded event to `onEvent`. Every way this can fail ends in
 * a thrown DebateError with a message that is safe to show the user.
 */

import { SseParser } from "./sse";
import type { DebateEvent } from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

export const TOPIC_MIN = 5;
export const TOPIC_MAX = 200;

/**
 * The backend sends a keep-alive ping every 15 seconds, so this long without
 * any bytes means the connection is dead and we should stop waiting.
 */
const IDLE_TIMEOUT_MS = 60_000;

const EVENT_TYPES = new Set(["turn_start", "token", "turn_end", "judge", "done", "error"]);

/** An error whose message is written for the user, not for a developer. */
export class DebateError extends Error {}

export async function streamDebate(
  topic: string,
  rounds: number,
  onEvent: (event: DebateEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  // A second controller lets the idle timer cancel the request too.
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort);
  let timedOut = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const resetIdleTimer = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, IDLE_TIMEOUT_MS);
  };

  try {
    resetIdleTimer();
    let response: Response;
    try {
      response = await fetch(`${API_URL}/api/debate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ topic, rounds }),
        signal: controller.signal,
      });
    } catch (err) {
      if (signal.aborted) throw err;
      throw new DebateError(
        timedOut
          ? "The arena server took too long to respond. Please try again."
          : "Can't reach the arena server. Make sure the backend is running and try again.",
      );
    }

    if (!response.ok) throw new DebateError(await errorMessageFor(response));
    if (!response.body) throw new DebateError("Your browser doesn't support streaming responses.");

    let finished = false;
    const parser = new SseParser();
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        resetIdleTimer();
        for (const raw of parser.push(value)) {
          finished = dispatch(raw.event, raw.data, onEvent) || finished;
        }
      }
      for (const raw of parser.flush()) {
        finished = dispatch(raw.event, raw.data, onEvent) || finished;
      }
    } catch (err) {
      if (signal.aborted) throw err;
      throw new DebateError(
        timedOut
          ? "The debate stalled and timed out. Please try again."
          : "The connection to the arena was lost mid-debate. Please try again.",
      );
    }

    if (!finished) {
      throw new DebateError("The connection closed before the debate finished. Please try again.");
    }
  } finally {
    clearTimeout(idleTimer);
    signal.removeEventListener("abort", abort);
  }
}

/** Decode one SSE event and pass it on. Returns true for the final events (done / error). */
function dispatch(event: string, data: string, onEvent: (event: DebateEvent) => void): boolean {
  if (!EVENT_TYPES.has(event)) return false; // ignore anything we don't know about
  let payload: object;
  try {
    payload = JSON.parse(data);
  } catch {
    return false; // a malformed event shouldn't kill the whole debate
  }
  onEvent({ ...payload, type: event } as DebateEvent);
  return event === "done" || event === "error";
}

/** Turn a non-2xx response into a friendly sentence. */
async function errorMessageFor(response: Response): Promise<string> {
  let detail: string | undefined;
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") detail = body.detail;
  } catch {
    // Not JSON; fall back to the generic messages below.
  }

  if (response.status === 429) {
    return detail ?? "You've hit the debate limit for now. Please try again later.";
  }
  if (response.status === 422) {
    return detail ?? `Topic must be between ${TOPIC_MIN} and ${TOPIC_MAX} characters.`;
  }
  return `The arena server ran into a problem (error ${response.status}). Please try again.`;
}
