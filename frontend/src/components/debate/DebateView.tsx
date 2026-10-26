"use client";

import { useEffect, useRef } from "react";
import type { DebateState } from "@/hooks/useDebate";
import { SIDES } from "@/lib/sides";
import type { Speaker, Turn } from "@/lib/types";
import { ErrorBanner } from "../ErrorBanner";
import { getRoom } from "@/config/rooms";
import { DemoNotice } from "../replay/DemoNotice";
import { ShareButton } from "../share/ShareDialog";
import { DecisionMemo } from "./DecisionMemo";
import { JudgeDeliberating } from "./JudgeDeliberating";
import { NewDebateButton } from "./NewDebateButton";
import { Scorecard } from "./Scorecard";
import { TopicHeader } from "./TopicHeader";
import { TurnCard } from "./TurnCard";

interface DebateViewProps {
  state: DebateState;
  onNewDebate: () => void;
  onRetry: () => void;
  /** Offers the demo replay on the error, when the AI is unavailable and there's a recording. */
  onWatchDemo?: () => void;
  /** This is a demo replay (the share card says so). */
  demo?: boolean;
}

/** Who speaks next while no turn is streaming: Pro opens each round, Con answers it. */
function nextTurn(turns: Turn[]): { speaker: Speaker; round: number } {
  const last = turns.at(-1);
  if (!last) return { speaker: "pro", round: 1 };
  return last.speaker === "pro" ? { speaker: "con", round: last.round } : { speaker: "pro", round: last.round + 1 };
}

/** The live debate: topic, Pro/Con turns round by round, then the judge's verdict. */
export function DebateView({ state, onNewDebate, onRetry, onWatchDemo, demo = false }: DebateViewProps) {
  const { phase, topic, rounds, turns, verdict, error } = state;
  const verdictRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  // Bring the arena into view when a debate starts, and the verdict when it lands.
  useEffect(() => {
    if (phase === "connecting") sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [phase]);
  useEffect(() => {
    if (verdict) verdictRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [verdict]);

  if (phase === "idle") return null;

  // A placeholder card for whoever is about to speak, so there's never a silent gap.
  const waitingForTurn = (phase === "connecting" || phase === "debating") && turns.every((t) => t.complete);
  const pending = waitingForTurn ? nextTurn(turns) : null;
  const roundCount = Math.max(pending?.round ?? 0, ...turns.map((t) => t.round));

  /** The card for one side in one round: a real turn, the pending placeholder, or an empty slot. */
  function cell(speaker: Speaker, round: number) {
    const turn = turns.find((t) => t.speaker === speaker && t.round === round);
    if (turn) return <TurnCard speaker={speaker} round={round} text={turn.text} streaming={!turn.complete} />;
    if (pending?.speaker === speaker && pending.round === round) {
      return <TurnCard speaker={speaker} round={round} text="" streaming />;
    }
    return <div className="hidden md:block" />; // keeps Con in the right-hand column
  }

  return (
    <section ref={sectionRef} aria-label="Debate" className="scroll-mt-24 space-y-6">
      <TopicHeader topic={topic} rounds={rounds} phase={phase} onNewDebate={onNewDebate} />

      {/* Column labels; on phones the cards stack in speaking order instead. */}
      {roundCount > 0 && (
        <div className="hidden grid-cols-2 gap-5 md:grid" aria-hidden>
          {(["pro", "con"] as Speaker[]).map((s) => (
            <div key={s} className="flex items-center gap-3 px-1">
              <span className={`font-display text-lg font-semibold ${SIDES[s].text}`}>{SIDES[s].label}</span>
              <span className="text-sm text-muted">{SIDES[s].stance} the motion</span>
              <span className={`h-px flex-1 ${SIDES[s].bar} opacity-30`} />
            </div>
          ))}
        </div>
      )}

      <div className="space-y-5">
        {Array.from({ length: roundCount }, (_, i) => i + 1).map((round) => (
          <div key={round} className="grid items-start gap-3 md:grid-cols-2 md:gap-5">
            {cell("pro", round)}
            {cell("con", round)}
          </div>
        ))}
      </div>

      {phase === "judging" && <JudgeDeliberating />}

      {verdict && (
        <div ref={verdictRef} className="scroll-mt-24 space-y-6">
          <Scorecard verdict={verdict} />
          <DecisionMemo memo={verdict.memo} topic={topic} />
        </div>
      )}

      {phase === "error" && error && onWatchDemo && <DemoNotice kind="offer" onWatch={onWatchDemo} />}
      {phase === "error" && error && (
        <ErrorBanner message={error}>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-10 items-center rounded-xl bg-con-deep px-4 text-sm font-semibold text-white transition hover:bg-ink focus-visible:ring-2 focus-visible:ring-con/60 focus-visible:outline-none"
          >
            Try again
          </button>
          <NewDebateButton onClick={onNewDebate} />
        </ErrorBanner>
      )}

      {phase === "done" && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {verdict && <ShareButton result={{ kind: "debate", topic, verdict }} room={getRoom("debate")} demo={demo} />}
          <NewDebateButton onClick={onNewDebate} />
        </div>
      )}
    </section>
  );
}
