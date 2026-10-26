/**
 * Demo replay mode: recorded conversations (public/replays/<room-id>.json, made
 * by backend/record_replays.py) played back through the same hooks and
 * components as a live room, so visitors can see a room working even when the
 * AI is unavailable.
 */

import type { RoomSetup, SummaryData } from "./chatTypes";

/** One recorded SSE event, `t` milliseconds after the request started. */
export interface ReplayEvent {
  t: number;
  event: string;
  data: Record<string, unknown>;
}

export interface DebateReplay {
  room_id: "debate";
  setup: { topic: string; rounds: number };
  events: ReplayEvent[];
}

export interface RoomReplay {
  room_id: string;
  setup: RoomSetup;
  /** The user's message that started the conversation. */
  message: { id: string; text: string };
  events: ReplayEvent[];
  /** The room's final output (poll, offers, ...), or null if the room has none. */
  summary: SummaryData["data"] | null;
}

export type Replay = DebateReplay | RoomReplay;

/** Long pauses in a recording (slow model calls) are shortened to this. */
const MAX_GAP_MS = 2_500;
/** Gaps shorter than this (streamed tokens) are added up instead of waited for one by one. */
const MIN_SLEEP_MS = 40;

/** Errors that mean the AI or the server is unavailable, so the demo replay is offered instead. */
const REPLAY_CODES = new Set(["quota_exhausted", "model_unavailable", "rate_limited", "unreachable", "timeout"]);
export const offersReplay = (code: string | null | undefined) => !!code && REPLAY_CODES.has(code);

const cache = new Map<string, Promise<Replay | null>>();

/** The room's recording, or null if it has none (or it can't be read). Fetched once per page load. */
export function loadReplay(roomId: string): Promise<Replay | null> {
  if (!cache.has(roomId)) {
    cache.set(
      roomId,
      fetch(`/replays/${roomId}.json`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => (data && Array.isArray(data.events) && data.setup ? (data as Replay) : null))
        .catch(() => null),
    );
  }
  return cache.get(roomId)!;
}

/**
 * Time for a replay: every wait (gaps between events and the rooms' typing
 * delays) goes through sleep(), so pause, 2x speed and "skip to the end"
 * apply to all of them.
 */
export class ReplayClock {
  private paused = false;
  private speed = 1;
  private skipped = false;
  private waiters = new Set<{ left: number; done: () => void }>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private last = 0;

  sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      if (this.skipped || ms <= 0) return resolve();
      this.waiters.add({ left: ms, done: resolve });
      if (!this.timer) {
        this.last = performance.now();
        this.timer = setInterval(this.tick, 50);
      }
    });

  setPaused(paused: boolean) {
    this.paused = paused;
  }

  setSpeed(speed: number) {
    this.speed = speed;
  }

  /** Finish instantly: every wait, now and later, resolves at once. Also used to stop the replay. */
  skip() {
    this.skipped = true;
    this.paused = false;
    for (const w of this.waiters) w.done();
    this.waiters.clear();
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /**
   * Drop every pending wait without resolving it, so nothing more plays (leaving
   * the replay). Waits started afterwards work as normal, which keeps React's
   * development double-mount working.
   */
  dispose() {
    this.waiters.clear();
    clearInterval(this.timer);
    this.timer = undefined;
  }

  private tick = () => {
    const now = performance.now();
    const elapsed = this.paused ? 0 : (now - this.last) * this.speed;
    this.last = now;
    for (const w of this.waiters) {
      w.left -= elapsed;
      if (w.left <= 0) {
        this.waiters.delete(w);
        w.done();
      }
    }
    if (this.waiters.size === 0) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  };
}

/** Feed recorded events to `onEvent` with their original timing (long gaps capped), like a live stream. */
export async function playEvents<E>(events: ReplayEvent[], onEvent: (event: E) => void, clock: ReplayClock, signal: AbortSignal) {
  let previous = 0;
  let owed = 0;
  for (const { t, event, data } of events) {
    owed += Math.min(Math.max(t - previous, 0), MAX_GAP_MS);
    previous = t;
    if (owed >= MIN_SLEEP_MS) {
      await clock.sleep(owed);
      owed = 0;
    }
    if (signal.aborted) return;
    onEvent({ ...data, type: event } as E);
  }
}
