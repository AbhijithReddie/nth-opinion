import type { Phase } from "@/lib/types";
import { BehindTheScenesToggle } from "../trace/BehindTheScenesToggle";
import { NewDebateButton } from "./NewDebateButton";
import { VoiceToggle } from "../voice/VoiceOutput";
import { ViewSwitch } from "../chat/ChatHeader";

const STATUS: Record<Exclude<Phase, "idle">, { label: string; className: string; live?: boolean }> = {
  connecting: { label: "Entering the arena", className: "text-muted border-line-strong", live: true },
  debating: { label: "Live", className: "text-con-deep border-con/40 bg-con-soft", live: true },
  judging: { label: "Judging", className: "text-judge-deep border-judge bg-judge-soft", live: true },
  done: { label: "Final", className: "text-pro-deep border-pro/40 bg-pro-soft" },
  error: { label: "Stopped", className: "text-muted border-line-strong" },
};

/** The motion being debated, its status, round count and a New debate button. */
export function TopicHeader({
  topic,
  rounds,
  phase,
  onNewDebate,
  view,
  onView,
}: {
  topic: string;
  rounds: number;
  phase: Exclude<Phase, "idle">;
  onNewDebate: () => void;
  /** Arena or Stage mode. */
  view?: "chat" | "call";
  onView?: (view: "chat" | "call") => void;
}) {
  const status = STATUS[phase];
  return (
    <header className="animate-fade-up flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 shadow-soft sm:flex-row sm:items-end sm:justify-between sm:p-7">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-[0.18em] uppercase">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${status.className}`}>
            {status.live && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
            {status.label}
          </span>
          <span className="text-muted">
            {rounds} {rounds === 1 ? "round" : "rounds"}
          </span>
        </div>
        <p className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">The motion</p>
        <h2 className="mt-1 font-display text-2xl leading-tight font-semibold text-balance break-words sm:text-4xl">
          &ldquo;{topic}&rdquo;
        </h2>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
        {onView && <ViewSwitch view={view ?? "chat"} onView={onView} chatName="Arena" callName="Stage mode" />}
        {view !== "call" && (
          <>
            <VoiceToggle />
            <BehindTheScenesToggle />
          </>
        )}
        <NewDebateButton onClick={onNewDebate} />
      </div>
    </header>
  );
}
