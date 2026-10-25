import type { Scorecard } from "@/lib/chatTypes";
import { Avatar } from "./Avatar";
import { formatTime } from "./chatNames";
import { useRoom } from "./RoomContext";

/** Colour for a 1-10 score: coral (weak), gold (okay), cyan (strong). */
function scoreColor(score: number): string {
  if (score >= 8) return "var(--color-cyan)";
  if (score >= 5) return "var(--color-gold)";
  return "var(--color-coral)";
}

/** Roast & Toast summary: overall score, category bars, prioritised fixes, best roast and best toast. */
export function ScorecardCard({ card, ts }: { card: Scorecard; ts: number }) {
  const { setup, persona, nameOf } = useRoom();

  return (
    <section aria-label="Scorecard" className="rounded-2xl border border-coral/30 bg-arena-900 p-4 shadow-[0_10px_40px_-20px_var(--color-coral)]">
      <p className="font-mono text-[10px] tracking-[0.18em] text-coral uppercase">📝 Scorecard · {formatTime(ts)}</p>

      <div className="mt-2 flex items-center gap-4">
        <p className="shrink-0 font-display leading-none font-extrabold" style={{ color: scoreColor(card.overall) }}>
          <span className="text-5xl">{card.overall}</span>
          <span className="text-lg text-faint">/10</span>
        </p>
        <div className="min-w-0">
          <h3 className="font-display text-lg leading-snug font-bold">{setup.title}</h3>
          <p className="text-sm text-muted">{card.verdict}</p>
        </div>
      </div>

      <ul className="mt-4 space-y-2.5">
        {card.scores.map((s, i) => (
          <li key={s.category}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold">{s.category}</span>
              <span className="font-mono text-xs" style={{ color: scoreColor(s.score) }}>
                {s.score}/10
              </span>
            </div>
            <div
              role="meter"
              aria-label={s.category}
              aria-valuemin={0}
              aria-valuemax={10}
              aria-valuenow={s.score}
              className="h-2 overflow-hidden rounded-full bg-white/[0.06]"
            >
              <div
                className="animate-bar-grow h-full origin-left rounded-full"
                style={{ width: `${s.score * 10}%`, backgroundColor: scoreColor(s.score), animationDelay: `${150 + i * 100}ms` }}
              />
            </div>
            <p className="mt-1 text-xs text-faint">{s.note}</p>
          </li>
        ))}
      </ul>

      <div className="mt-4 border-t border-white/[0.06] pt-3">
        <p className="font-mono text-[10px] tracking-[0.18em] text-cyan uppercase">Fix these first</p>
        <ol className="mt-2 space-y-2.5">
          {card.fixes.map((fix, i) => {
            const by = fix.friend_id ? persona(fix.friend_id) : undefined;
            return (
              <li key={fix.title} className="flex gap-2.5 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/[0.06] font-mono text-xs text-muted">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">{fix.title}</p>
                  <p className="mt-0.5 text-ink/75">{fix.detail}</p>
                  {by && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-faint">
                      <Avatar persona={by} size="xs" /> from {nameOf(by.id)}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Quote label="🔥 Best roast" text={card.best_roast} className="border-coral/25 bg-coral/[0.06]" />
        <Quote label="🥂 Best toast" text={card.best_toast} className="border-cyan/25 bg-cyan/[0.06]" />
      </div>
    </section>
  );
}

function Quote({ label, text, className }: { label: string; text: string; className: string }) {
  if (!text) return null;
  return (
    <figure className={`rounded-xl border p-3 text-sm ${className}`}>
      <figcaption className="text-xs font-semibold text-muted">{label}</figcaption>
      <blockquote className="mt-1 text-ink/85">&ldquo;{text}&rdquo;</blockquote>
    </figure>
  );
}
