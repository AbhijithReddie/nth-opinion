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

/** An error whose message is written for the user, not for a developer. */
export class StreamError extends Error {}

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
}

export async function streamSse<E>({ path, body, eventTypes, finalEvents, messages, onEvent, signal }: StreamOptions<E>) {
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

  /** Decode one SSE event and pass it on. Returns true for a final event. */
  const dispatch = (event: string, data: string): boolean => {
    if (!eventTypes.has(event)) return false; // ignore anything we don't know about
    let payload: object;
    try {
      payload = JSON.parse(data);
    } catch {
      return false; // a malformed event shouldn't kill the whole stream
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
      throw new StreamError(timedOut ? messages.slowStart : messages.unreachable);
    }

    if (!response.ok) throw new StreamError(messages.http(response.status, await readDetail(response)));
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
    signal.removeEventListener("abort", abort);
  }
}

/** The backend's `{"detail": "..."}` message from an error response, if there is one. */
export async function readDetail(response: Response): Promise<string | undefined> {
  try {
    const body = await response.json();
    return typeof body?.detail === "string" ? body.detail : undefined;
  } catch {
    return undefined; // not JSON
  }
}
