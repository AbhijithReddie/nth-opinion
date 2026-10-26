import type { Scorecard } from "@/lib/chatTypes";
import { Avatar } from "./Avatar";
import { formatTime } from "./chatNames";
import { useRoom } from "./RoomContext";

/** Colour for a 1-10 score: terracotta (weak), butter (okay), sage (strong). Text-safe shades. */
function scoreColor(score: number): string {
  if (score >= 8) return "var(--color-sage-deep)";
  if (score >= 5) return "var(--color-butter-deep)";
  return "var(--color-terracotta-deep)";
}

/** Roast & Toast summary: overall score, category bars, prioritised fixes, best roast and best toast. */
export function ScorecardCard({ card, ts }: { card: Scorecard; ts: number }) {
  const { setup, persona, nameOf } = useRoom();

  return (
    <section aria-label="Scorecard" className="rounded-2xl border border-con/40 bg-surface p-4 text-left shadow-lift">
      <p className="font-mono text-[10px] tracking-[0.18em] text-con-deep uppercase">📝 Scorecard · {formatTime(ts)}</p>

      <div className="mt-2 flex items-center gap-4">
        <p className="shrink-0 font-mono leading-none font-semibold" style={{ color: scoreColor(card.overall) }}>
          <span className="text-5xl">{card.overall}</span>
          <span className="text-lg text-muted">/10</span>
        </p>
        <div className="min-w-0">
          <h3 className="font-display text-lg leading-snug font-semibold">{setup.title}</h3>
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
              className="h-2 overflow-hidden rounded-full bg-sand"
            >
              <div
                className="animate-bar-grow h-full origin-left rounded-full"
                style={{ width: `${s.score * 10}%`, backgroundColor: scoreColor(s.score), animationDelay: `${150 + i * 100}ms` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted">{s.note}</p>
          </li>
        ))}
      </ul>

      <div className="mt-4 border-t border-line pt-3">
        <p className="font-mono text-[10px] tracking-[0.18em] text-pro-deep uppercase">Fix these first</p>
        <ol className="mt-2 space-y-2.5">
          {card.fixes.map((fix, i) => {
            const by = fix.friend_id ? persona(fix.friend_id) : undefined;
            return (
              <li key={fix.title} className="flex gap-2.5 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sand font-mono text-xs text-muted">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">{fix.title}</p>
                  <p className="mt-0.5 text-muted">{fix.detail}</p>
                  {by && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
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
        <Quote label="🔥 Best roast" text={card.best_roast} className="border-con/30 bg-con-soft" />
        <Quote label="🥂 Best toast" text={card.best_toast} className="border-pro/30 bg-pro-soft" />
      </div>
    </section>
  );
}

function Quote({ label, text, className }: { label: string; text: string; className: string }) {
  if (!text) return null;
  return (
    <figure className={`rounded-xl border p-3 text-sm ${className}`}>
      <figcaption className="text-xs font-semibold text-muted">{label}</figcaption>
      <blockquote className="mt-1 text-ink">&ldquo;{text}&rdquo;</blockquote>
    </figure>
  );
}
