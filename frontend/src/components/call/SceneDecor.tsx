import type { Decor } from "@/lib/call/scenes";

/**
 * Each room's set piece behind the tiles, drawn with plain shapes in the Chai & Sage
 * palette: a spotlight for your pitch, a table, a classroom board, a stage with a mic,
 * a timeline, or the debate's podiums. Purely decorative.
 */
export function SceneDecor({ decor }: { decor: Decor }) {
  switch (decor) {
    case "spotlight":
      // Pitch Tank: the investors' desk up top, a spotlight where you stand.
      return (
        <>
          <div aria-hidden className="absolute inset-x-[12%] top-[46%] h-3 rounded-full bg-sand-deep/70" />
          <div aria-hidden className="absolute bottom-[4%] left-1/2 h-16 w-72 -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,var(--color-butter)_0%,transparent_100%)] opacity-70" />
        </>
      );
    case "table":
      // Interview Panel: a long table in front of the three interviewers.
      return <div aria-hidden className="absolute inset-x-[10%] top-[47%] h-6 rounded-2xl border border-sand-deep bg-sand shadow-soft" />;
    case "classroom":
      // Study Group: a board behind, a shared table in front.
      return (
        <>
          <div aria-hidden className="absolute inset-x-[18%] top-[4%] h-[38%] rounded-xl border-4 border-sand-deep bg-sage-deep/85" />
          <div aria-hidden className="absolute inset-x-[14%] top-[50%] h-5 rounded-2xl border border-sand-deep bg-sand shadow-soft" />
        </>
      );
    case "stage-mic":
      // Roast & Toast: a small stage with a mic stand.
      return (
        <>
          <div aria-hidden className="absolute inset-x-[8%] top-[44%] h-8 rounded-t-3xl border-t-4 border-butter-deep bg-butter-soft" />
          <svg aria-hidden viewBox="0 0 24 60" className="absolute top-[30%] left-[6%] hidden h-24 text-ink/70 md:block">
            <rect x="7" y="2" width="10" height="16" rx="5" fill="currentColor" />
            <path d="M12 18v38M5 58h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </>
      );
    case "timeline":
      // Future You: a line through time, now in the middle.
      return <div aria-hidden className="absolute inset-x-[6%] top-1/2 h-1 -translate-y-1/2 rounded-full bg-linear-to-r from-room-future/30 via-room-future to-room-future/30" />;
    case "podiums":
      return null; // drawn under each speaker by CallStage
    default:
      return null;
  }
}

/** A podium under a debate speaker. */
export function Podium({ color, tall = false }: { color: string; tall?: boolean }) {
  return (
    <div aria-hidden className={`mx-auto -mt-3 w-32 rounded-t-xl border-x border-t border-line-strong bg-surface lg:w-40 ${tall ? "h-16" : "h-10"}`} style={{ borderTop: `6px solid ${color}` }} />
  );
}
