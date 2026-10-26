import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playEvents, ReplayClock, type ReplayEvent } from "./replay";

// Fake timers also fake performance.now(), which the replay clock measures with.
beforeEach(() => vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "performance", "Date"] }));
afterEach(() => vi.useRealTimers());

const ev = (t: number, i: number): ReplayEvent => ({ t, event: "e", data: { i } });

/** Play events and record when (in fake ms) each one arrived. */
function play(events: ReplayEvent[], clock = new ReplayClock()) {
  const start = performance.now();
  const seen: { i: number; at: number }[] = [];
  const done = playEvents<{ i: number }>(events, (e) => seen.push({ i: e.i, at: performance.now() - start }), clock, new AbortController().signal);
  return { seen, done, clock };
}

describe("playEvents", () => {
  it("keeps the original timing", async () => {
    const { seen, done } = play([ev(0, 0), ev(500, 1), ev(1500, 2)]);
    await vi.advanceTimersByTimeAsync(2000);
    await done;
    expect(seen.map((s) => s.i)).toEqual([0, 1, 2]);
    expect(seen[1].at).toBeGreaterThanOrEqual(500);
    expect(seen[1].at).toBeLessThan(600);
    expect(seen[2].at).toBeGreaterThanOrEqual(1500);
  });

  it("caps long gaps at 2.5 seconds", async () => {
    const { seen, done } = play([ev(0, 0), ev(60_000, 1)]);
    await vi.advanceTimersByTimeAsync(3000);
    await done;
    expect(seen[1].at).toBeGreaterThanOrEqual(2500);
    expect(seen[1].at).toBeLessThan(2600);
  });

  it("batches tiny gaps (streamed tokens) instead of waiting for each", async () => {
    const tokens = Array.from({ length: 20 }, (_, i) => ev(i * 10, i)); // 10 ms apart
    const { seen, done } = play(tokens);
    await vi.advanceTimersByTimeAsync(400);
    await done;
    expect(seen).toHaveLength(20);
    expect(seen.at(-1)!.at).toBeLessThan(400); // ~190 ms of gaps, not 20 x 50 ms ticks
  });

  it("plays twice as fast at 2x", async () => {
    const clock = new ReplayClock();
    clock.setSpeed(2);
    const { seen, done } = play([ev(0, 0), ev(2000, 1)], clock);
    await vi.advanceTimersByTimeAsync(1200);
    await done;
    expect(seen[1].at).toBeGreaterThanOrEqual(1000);
    expect(seen[1].at).toBeLessThan(1100);
  });

  it("stops while paused", async () => {
    const { seen, clock } = play([ev(0, 0), ev(1000, 1)]);
    clock.setPaused(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(seen).toHaveLength(1);
    clock.setPaused(false);
    await vi.advanceTimersByTimeAsync(1100);
    expect(seen).toHaveLength(2);
  });

  it("skips to the end at once", async () => {
    const { seen, done, clock } = play([ev(0, 0), ev(2000, 1), ev(4000, 2)]);
    await vi.advanceTimersByTimeAsync(100);
    clock.skip();
    await done;
    expect(seen).toHaveLength(3);
    expect(seen[2].at).toBeLessThan(200);
  });

  it("stops when aborted", async () => {
    const controller = new AbortController();
    const seen: number[] = [];
    const done = playEvents<{ i: number }>([ev(0, 0), ev(1000, 1)], (e) => seen.push(e.i), new ReplayClock(), controller.signal);
    controller.abort();
    await vi.advanceTimersByTimeAsync(1100);
    await done;
    expect(seen).toEqual([0]);
  });
});
