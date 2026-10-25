import type { Phase } from "@/lib/types";
import { NewDebateButton } from "./NewDebateButton";

const STATUS: Record<Exclude<Phase, "idle">, { label: string; className: string; live?: boolean }> = {
  connecting: { label: "Entering the arena", className: "text-muted border-white/10", live: true },
  debating: { label: "Live", className: "text-con border-con/30 bg-con/10", live: true },
  judging: { label: "Judging", className: "text-judge border-judge/30 bg-judge/10", live: true },
  done: { label: "Final", className: "text-pro border-pro/30 bg-pro/10" },
  error: { label: "Stopped", className: "text-muted border-white/10" },
};

/** The motion being debated, its status, round count and a New debate button. */
export function TopicHeader({
  topic,
  rounds,
  phase,
  onNewDebate,
}: {
  topic: string;
  rounds: number;
  phase: Exclude<Phase, "idle">;
  onNewDebate: () => void;
}) {
  const status = STATUS[phase];
  return (
    <header className="animate-fade-up flex flex-col gap-4 rounded-3xl border border-white/[0.08] bg-arena-900/70 p-5 backdrop-blur sm:flex-row sm:items-end sm:justify-between sm:p-7">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-[0.18em] uppercase">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${status.className}`}>
            {status.live && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
            {status.label}
          </span>
          <span className="text-faint">
            {rounds} {rounds === 1 ? "round" : "rounds"}
          </span>
        </div>
        <p className="font-mono text-[11px] tracking-[0.18em] text-faint uppercase">The motion</p>
        <h2 className="mt-1 font-display text-2xl leading-tight font-extrabold text-balance break-words sm:text-4xl">
          &ldquo;{topic}&rdquo;
        </h2>
      </div>
      <NewDebateButton onClick={onNewDebate} className="self-start sm:self-auto" />
    </header>
  );
}
