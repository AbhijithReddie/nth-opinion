import { SIDES } from "@/lib/sides";
import type { Winner } from "@/lib/types";
import { ScaleIcon, TrophyIcon } from "../icons";

/** Big "Pro wins" / "Con wins" / "It's a tie" badge at the top of the scorecard. */
export function WinnerBadge({ winner }: { winner: Winner }) {
  if (winner === "tie") {
    return (
      <div className="animate-pop inline-flex items-center gap-3 rounded-2xl border border-judge/40 bg-judge/10 px-5 py-3 text-judge">
        <ScaleIcon className="size-7" />
        <span className="font-display text-2xl font-extrabold sm:text-3xl">It&apos;s a tie</span>
      </div>
    );
  }

  const side = SIDES[winner];
  return (
    <div
      className={`animate-pop inline-flex items-center gap-3 rounded-2xl border px-5 py-3 ${side.border} ${side.bg} ${side.text} ${side.glow}`}
    >
      <TrophyIcon className="size-7" />
      <span className="font-display text-2xl font-extrabold sm:text-3xl">{side.label} wins</span>
    </div>
  );
}
