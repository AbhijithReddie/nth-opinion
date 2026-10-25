import type { InterviewResult } from "@/lib/chatTypes";
import { Avatar } from "./Avatar";
import { formatTime } from "./chatNames";
import { useRoom } from "./RoomContext";

type Recommendation = InterviewResult["verdicts"][number]["recommendation"];

const RECOMMENDATIONS: Record<Recommendation, { label: string; className: string }> = {
  strong_hire: { label: "Strong hire", className: "bg-cyan text-arena-950" },
  hire: { label: "Hire", className: "bg-cyan/20 text-cyan" },
  no_hire: { label: "No hire", className: "bg-coral/20 text-coral" },
  strong_no_hire: { label: "Strong no hire", className: "bg-coral text-arena-950" },
};

/** Interview Panel summary: the panel's decision, each interviewer's recommendation, competency scores and feedback. */
export function InterviewCard({ result, ts }: { result: InterviewResult; ts: number }) {
  const { setup, persona, nameOf } = useRoom();
  const offer = result.decision === "offer";

  return (
    <section aria-label="Interview result" className="rounded-2xl border border-gold/30 bg-arena-900 p-4 shadow-[0_10px_40px_-20px_var(--color-gold)]">
      <p className="font-mono text-[10px] tracking-[0.18em] text-gold uppercase">🗳️ Panel decision · {formatTime(ts)}</p>
      <h3 className="mt-1.5 font-display text-xl leading-snug font-extrabold" style={{ color: offer ? "var(--color-cyan)" : "var(--color-coral)" }}>
        {offer ? "You'd get the offer 🎉" : "Not this time"}
      </h3>
      <p className="text-xs text-faint">{setup.title}</p>
      <p className="mt-2 text-sm text-muted">{result.summary}</p>

      <ul className="mt-4 space-y-2">
        {result.verdicts.map((v) => {
          const meta = persona(v.friend_id);
          const rec = RECOMMENDATIONS[v.recommendation] ?? RECOMMENDATIONS.no_hire;
          return meta ? (
            <li key={v.friend_id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center gap-2.5">
                <Avatar persona={meta} />
                <span className="font-semibold" style={{ color: meta.color }}>
                  {nameOf(v.friend_id)}
                </span>
                <span className={`ml-auto rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase ${rec.className}`}>
                  {rec.label}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-ink/75">&ldquo;{v.reason}&rdquo;</p>
            </li>
          ) : null;
        })}
      </ul>

      <ul className="mt-4 grid gap-2 border-t border-white/[0.06] pt-3 sm:grid-cols-2">
        {result.competencies.map((c) => (
          <li key={c.name} className="text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">{c.name}</span>
              <span aria-label={`${c.score} out of 5`} className="tracking-widest text-gold">
                {"●".repeat(c.score)}
                <span className="text-white/15">{"●".repeat(5 - c.score)}</span>
              </span>
            </div>
            <p className="text-xs text-faint">{c.note}</p>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid gap-3 border-t border-white/[0.06] pt-3 text-sm sm:grid-cols-2">
        <Feedback title="You did well" items={result.strengths} className="text-cyan" marker="+" />
        <Feedback title="Work on this next" items={result.improvements} className="text-coral" marker="→" />
      </div>
    </section>
  );
}

function Feedback({ title, items, className, marker }: { title: string; items: string[]; className: string; marker: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className={`font-mono text-[10px] tracking-[0.18em] uppercase ${className}`}>{title}</p>
      <ul className="mt-1.5 space-y-1 text-ink/80">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden className={className}>
              {marker}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
