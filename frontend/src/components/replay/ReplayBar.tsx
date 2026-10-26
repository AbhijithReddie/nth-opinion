"use client";

import { useState } from "react";
import type { ReplayClock } from "@/lib/replay";
import { CloseIcon, PauseIcon, PlayIcon, SkipIcon } from "../icons";

const control =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-sm font-semibold text-ink transition hover:bg-sand focus-visible:ring-2 focus-visible:ring-accent-deep/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Controls for a demo replay: pause/resume, 1x/2x speed, skip to the end and exit.
 * Always labelled, so nobody mistakes a recording for a live conversation.
 */
export function ReplayBar({
  clock,
  finished,
  onExit,
  className = "",
}: {
  clock: ReplayClock;
  /** The recording has played to the end. */
  finished: boolean;
  onExit: () => void;
  className?: string;
}) {
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);

  return (
    <div
      role="region"
      aria-label="Replay controls"
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-line-strong bg-lavender-soft px-3 py-2.5 sm:px-4 ${className}`}
    >
      <p className="flex min-w-0 flex-1 basis-full items-center gap-2 text-sm font-semibold text-ink sm:basis-auto">
        <span className="rounded-full bg-accent-deep px-2 py-0.5 font-mono text-[10px] tracking-wider text-white uppercase">Demo</span>
        Replay of a recorded conversation
        {finished && <span className="font-normal text-muted">· finished</span>}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={finished}
          onClick={() => {
            clock.setPaused(!paused);
            setPaused(!paused);
          }}
          className={control}
        >
          {paused ? <PlayIcon className="size-3.5" /> : <PauseIcon className="size-3.5" />}
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          type="button"
          disabled={finished}
          aria-label={`Playback speed ${speed}x, switch to ${speed === 1 ? 2 : 1}x`}
          onClick={() => {
            const next = speed === 1 ? 2 : 1;
            clock.setSpeed(next);
            setSpeed(next);
          }}
          className={`${control} w-12 justify-center font-mono`}
        >
          {speed}x
        </button>
        <button
          type="button"
          disabled={finished}
          onClick={() => {
            clock.skip();
            setPaused(false);
          }}
          className={control}
        >
          <SkipIcon className="size-3.5" /> Skip to end
        </button>
        <button type="button" onClick={onExit} className={control}>
          <CloseIcon className="size-3.5" /> Exit replay
        </button>
      </div>
    </div>
  );
}
