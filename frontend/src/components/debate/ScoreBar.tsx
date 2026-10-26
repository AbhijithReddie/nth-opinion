import { SIDES } from "@/lib/sides";
import type { Speaker } from "@/lib/types";

/** A single score out of 10, drawn as a bar that grows in when it first appears. */
export function ScoreBar({ label, score, speaker, delay }: { label: string; score: number; speaker: Speaker; delay: number }) {
  const side = SIDES[speaker];
  const pct = Math.max(0, Math.min(10, score)) * 10;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-mono">
          <span className={`font-semibold ${side.text}`}>{score}</span>
          <span className="text-muted">/10</span>
        </span>
      </div>
      <div
        role="meter"
        aria-label={`${side.label} ${label}`}
        aria-valuemin={0}
        aria-valuemax={10}
        aria-valuenow={score}
        className="h-2.5 overflow-hidden rounded-full bg-sand"
      >
        <div
          className={`animate-bar-grow h-full origin-left rounded-full ${side.bar}`}
          style={{ width: `${pct}%`, animationDelay: `${delay}ms` }}
        />
      </div>
    </div>
  );
}
