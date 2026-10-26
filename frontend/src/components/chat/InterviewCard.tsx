import type { InterviewResult } from "@/lib/chatTypes";
import { Avatar } from "./Avatar";
import { formatTime } from "./chatNames";
import { useRoom } from "./RoomContext";

type Recommendation = InterviewResult["verdicts"][number]["recommendation"];

const RECOMMENDATIONS: Record<Recommendation, { label: string; className: string }> = {
  strong_hire: { label: "Strong hire", className: "bg-pro-deep text-white" },
  hire: { label: "Hire", className: "bg-pro-soft text-pro-deep" },
  no_hire: { label: "No hire", className: "bg-con-soft text-con-deep" },
  strong_no_hire: { label: "Strong no hire", className: "bg-con-deep text-white" },
};

/** Interview Panel summary: the panel's decision, each interviewer's recommendation, competency scores and feedback. */
export function InterviewCard({ result, ts }: { result: InterviewResult; ts: number }) {
  const { setup, persona, nameOf } = useRoom();
  const offer = result.decision === "offer";

  return (
    <section aria-label="Interview result" className="rounded-2xl border border-butter bg-surface p-4 text-left shadow-lift">
      <p className="font-mono text-[10px] tracking-[0.18em] text-butter-deep uppercase">🗳️ Panel decision · {formatTime(ts)}</p>
      <h3 className="mt-1.5 font-display text-xl leading-snug font-semibold" style={{ color: offer ? "var(--color-pro-deep)" : "var(--color-con-deep)" }}>
        {offer ? "You'd get the offer 🎉" : "Not this time"}
      </h3>
      <p className="text-xs text-muted">{setup.title}</p>
      <p className="mt-2 text-sm text-muted">{result.summary}</p>

      <ul className="mt-4 space-y-2">
        {result.verdicts.map((v) => {
          const meta = persona(v.friend_id);
          const rec = RECOMMENDATIONS[v.recommendation] ?? RECOMMENDATIONS.no_hire;
          return meta ? (
            <li key={v.friend_id} className="rounded-xl border border-line bg-sand/60 p-3">
              <div className="flex items-center gap-2.5">
                <Avatar persona={meta} />
                <span className="font-semibold" style={{ color: meta.color }}>
                  {nameOf(v.friend_id)}
                </span>
                <span className={`ml-auto rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase ${rec.className}`}>
                  {rec.label}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-muted">&ldquo;{v.reason}&rdquo;</p>
            </li>
          ) : null;
        })}
      </ul>

      <ul className="mt-4 grid gap-2 border-t border-line pt-3 sm:grid-cols-2">
        {result.competencies.map((c) => (
          <li key={c.name} className="text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">{c.name}</span>
              <span aria-label={`${c.score} out of 5`} className="tracking-widest text-butter-deep">
                {"●".repeat(c.score)}
                <span className="text-line-strong">{"●".repeat(5 - c.score)}</span>
              </span>
            </div>
            <p className="text-xs text-muted">{c.note}</p>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid gap-3 border-t border-line pt-3 text-sm sm:grid-cols-2">
        <Feedback title="You did well" items={result.strengths} className="text-pro-deep" marker="+" />
        <Feedback title="Work on this next" items={result.improvements} className="text-con-deep" marker="→" />
      </div>

      {/* Only when a job description was uploaded. */}
      {result.job_match && (
        <div className="mt-4 border-t border-line pt-3 text-sm">
          <p className="flex items-baseline justify-between font-mono text-[10px] tracking-[0.18em] text-muted uppercase">
            Job match
            <span className="font-display text-xl font-semibold tracking-normal text-ink normal-case">{result.job_match.score}/100</span>
          </p>
          <div
            role="meter"
            aria-label="Job match"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={result.job_match.score}
            className="mt-1.5 h-2 overflow-hidden rounded-full bg-sand"
          >
            <div className="h-full rounded-full bg-pro" style={{ width: `${result.job_match.score}%` }} />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Feedback title="Skills you match" items={result.job_match.matched_skills} className="text-pro-deep" marker="✓" />
            <Feedback title="Missing for this role" items={result.job_match.missing_skills} className="text-con-deep" marker="·" />
          </div>
          <div className="mt-3">
            <Feedback title="Top 3 to work on" items={result.job_match.focus} className="text-accent-deep" marker="→" />
          </div>
        </div>
      )}
    </section>
  );
}

function Feedback({ title, items, className, marker }: { title: string; items: string[]; className: string; marker: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className={`font-mono text-[10px] tracking-[0.18em] uppercase ${className}`}>{title}</p>
      <ul className="mt-1.5 space-y-1 text-ink">
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
