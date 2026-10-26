/**
 * Shared client for the backend's POST + Server-Sent Events endpoints
 * (/api/debate and /api/rooms/{id}/message).
 *
 * Opens the request with fetch, reads the SSE stream from the response body,
 * and hands each decoded event to `onEvent`. Every way this can fail ends in
 * a thrown StreamError with a message that is safe to show the user.
 */

import { SseParser } from "./sse";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

/**
 * The backend sends a keep-alive ping every 15 seconds, so this long without
 * any bytes means the connection is dead and we should stop waiting.
 */
const IDLE_TIMEOUT_MS = 60_000;
/** No response headers by now: the free server is probably waking up. */
const WAKING_AFTER_MS = 5_000;
/** No event by now: offer the demo replay (the request keeps going). */
const STALLED_AFTER_MS = 12_000;

/**
 * An error whose message is written for the user, not for a developer.
 * `code` says why, so the UI can offer the demo replay: the backend's codes
 * ("quota_exhausted", "model_unavailable") or "rate_limited", "unreachable", "timeout".
 */
export class StreamError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

/** A request that is taking a while: `waking` = no response yet after 5s, `stalled` = no event yet after 12s. */
export type SlowState = { waking: boolean; stalled: boolean } | null;

/** Ping /health in the background so the free Render server starts waking up before the first real request. */
export function wakeServer() {
  fetch(`${API_URL}/health`, { cache: "no-store" }).catch(() => {}); // failures don't matter here
}

export interface StreamMessages {
  unreachable: string; // fetch failed (backend down, offline)
  slowStart: string; // no response within the idle timeout
  lost: string; // connection dropped mid-stream
  stalled: string; // stream went silent for the idle timeout
  closedEarly: string; // stream ended without a final event
  /** A friendly sentence for a non-2xx response; `detail` is the backend's message, if any. */
  http: (status: number, detail: string | undefined) => string;
}

export interface StreamOptions<E> {
  path: string;
  body: unknown;
  /** Event names to pass on; anything else is ignored. */
  eventTypes: ReadonlySet<string>;
  /** Event names that end the stream successfully (e.g. "done", "your_turn", "error"). */
  finalEvents: ReadonlySet<string>;
  messages: StreamMessages;
  onEvent: (event: E) => void;
  signal: AbortSignal;
  /** Told when the request is slow to start (see SlowState), and with null once it's flowing or over. */
  onSlow?: (slow: SlowState) => void;
}

export async function streamSse<E>({ path, body, eventTypes, finalEvents, messages, onEvent, signal, onSlow }: StreamOptions<E>) {
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

  // Slow-start reporting: "waking" until the response arrives, "stalled" until the first event.
  let connected = false;
  let gotEvent = false;
  let wakingDue = false;
  let stalledDue = false;
  const reportSlow = () => {
    const waking = wakingDue && !connected;
    const stalled = stalledDue && !gotEvent;
    onSlow?.(waking || stalled ? { waking, stalled } : null);
  };
  const wakingTimer = setTimeout(() => {
    wakingDue = true;
    reportSlow();
  }, WAKING_AFTER_MS);
  const stalledTimer = setTimeout(() => {
    stalledDue = true;
    reportSlow();
  }, STALLED_AFTER_MS);

  /** Decode one SSE event and pass it on. Returns true for a final event. */
  const dispatch = (event: string, data: string): boolean => {
    if (!eventTypes.has(event)) return false; // ignore anything we don't know about
    let payload: object;
    try {
      payload = JSON.parse(data);
    } catch {
      return false; // a malformed event shouldn't kill the whole stream
    }
    if (!gotEvent) {
      gotEvent = true;
      reportSlow();
    }
    onEvent({ ...payload, type: event } as E);
    return finalEvents.has(event);
  };

  try {
    resetIdleTimer();
    let response: Response;
    try {
      response = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (signal.aborted) throw err;
      throw new StreamError(timedOut ? messages.slowStart : messages.unreachable, timedOut ? "timeout" : "unreachable");
    }
    connected = true;
    reportSlow();

    if (!response.ok) {
      const { detail, code } = await readError(response);
      throw new StreamError(messages.http(response.status, detail), response.status === 429 ? "rate_limited" : code);
    }
    if (!response.body) throw new StreamError("Your browser doesn't support streaming responses.");

    let finished = false;
    const parser = new SseParser();
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        resetIdleTimer();
        for (const raw of parser.push(value)) {
          finished = dispatch(raw.event, raw.data) || finished;
        }
      }
      for (const raw of parser.flush()) {
        finished = dispatch(raw.event, raw.data) || finished;
      }
    } catch (err) {
      if (signal.aborted) throw err;
      throw new StreamError(timedOut ? messages.stalled : messages.lost);
    }

    if (!finished) throw new StreamError(messages.closedEarly);
  } finally {
    clearTimeout(idleTimer);
    clearTimeout(wakingTimer);
    clearTimeout(stalledTimer);
    onSlow?.(null);
    signal.removeEventListener("abort", abort);
  }
}

/** The backend's `{"detail": "...", "code": "..."}` from an error response, if there is one. */
export async function readError(response: Response): Promise<{ detail?: string; code?: string }> {
  try {
    const body = await response.json();
    return {
      detail: typeof body?.detail === "string" ? body.detail : undefined,
      code: typeof body?.code === "string" ? body.code : undefined,
    };
  } catch {
    return {}; // not JSON
  }
}
