import { SIDES } from "@/lib/sides";
import type { SideScores, Speaker, Verdict } from "@/lib/types";
import { ScoreBar } from "./ScoreBar";
import { WinnerBadge } from "./WinnerBadge";

const CRITERIA: { key: keyof SideScores; label: string }[] = [
  { key: "logic", label: "Logic" },
  { key: "evidence", label: "Evidence" },
  { key: "rebuttal", label: "Rebuttal" },
];

const total = (s: SideScores) => s.logic + s.evidence + s.rebuttal;

/** The judge's verdict: winner badge plus a score column for each side. */
export function Scorecard({ verdict }: { verdict: Verdict }) {
  return (
    <section
      aria-labelledby="scorecard-title"
      className="animate-fade-up rounded-3xl border border-judge/25 bg-arena-900/80 p-5 backdrop-blur sm:p-8"
    >
      <div className="flex flex-col items-center text-center">
        <p id="scorecard-title" className="mb-4 font-mono text-[11px] tracking-[0.2em] text-judge uppercase">
          The judge&apos;s verdict
        </p>
        <WinnerBadge winner={verdict.winner} />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-6">
        {(["pro", "con"] as Speaker[]).map((speaker, col) => (
          <SideColumn
            key={speaker}
            speaker={speaker}
            scores={verdict.scores[speaker]}
            isWinner={verdict.winner === speaker}
            delayBase={col * 150}
          />
        ))}
      </div>
    </section>
  );
}

/** One side's three bars and total out of 30. */
function SideColumn({
  speaker,
  scores,
  isWinner,
  delayBase,
}: {
  speaker: Speaker;
  scores: SideScores;
  isWinner: boolean;
  delayBase: number;
}) {
  const side = SIDES[speaker];
  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${isWinner ? `${side.border} ${side.bg}` : "border-white/[0.06] bg-white/[0.02]"}`}>
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className={`font-display text-lg font-extrabold ${side.text}`}>{side.label}</h3>
        <p className="font-mono">
          <span className={`text-3xl font-bold ${side.text}`}>{total(scores)}</span>
          <span className="text-sm text-faint">/30</span>
        </p>
      </div>
      <div className="space-y-3.5">
        {CRITERIA.map(({ key, label }, i) => (
          <ScoreBar key={key} label={label} score={scores[key]} speaker={speaker} delay={300 + delayBase + i * 120} />
        ))}
      </div>
    </div>
  );
}
