import type { FutureLetters } from "@/lib/chatTypes";
import { Avatar } from "./Avatar";
import { formatTime } from "./chatNames";
import { useRoom } from "./RoomContext";

/** Future You summary: the paths, a letter from each future self, next steps and one honest question. */
export function LettersCard({ result, ts }: { result: FutureLetters; ts: number }) {
  const { persona, nameOf } = useRoom();

  return (
    <section aria-label="Letters from future you" className="rounded-2xl border border-brand/30 bg-arena-900 p-4 shadow-[0_10px_40px_-20px_var(--color-brand)]">
      <p className="font-mono text-[10px] tracking-[0.18em] text-brand uppercase">💌 Letters from future you · {formatTime(ts)}</p>
      <h3 className="mt-1.5 font-display text-lg leading-snug font-bold">{result.decision}</h3>

      {result.paths.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {result.paths.map((p) => (
            <li key={p.option} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-sm">
              <p className="font-semibold">{p.option}</p>
              <p className="mt-1 text-ink/75">
                <span className="text-cyan">↑ </span>
                {p.upside}
              </p>
              <p className="text-ink/75">
                <span className="text-coral">↓ </span>
                {p.risk}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 space-y-3">
        {result.letters.map((l) => {
          const meta = persona(l.friend_id);
          return meta ? (
            <figure
              key={l.friend_id}
              className="rounded-xl border bg-arena-950/60 p-3.5"
              style={{ borderColor: `${meta.color}40` }}
            >
              <figcaption className="flex items-center gap-2 text-sm font-semibold" style={{ color: meta.color }}>
                <Avatar persona={meta} size="xs" /> From {nameOf(l.friend_id)}
              </figcaption>
              <blockquote className="mt-2 font-display text-[15px] leading-relaxed whitespace-pre-line text-ink/90 italic">
                {l.letter}
              </blockquote>
            </figure>
          ) : null;
        })}
      </div>

      {result.next_steps.length > 0 && (
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          <p className="font-mono text-[10px] tracking-[0.18em] text-cyan uppercase">This week</p>
          <ol className="mt-1.5 list-inside list-decimal space-y-1 text-sm text-ink/85 marker:text-faint">
            {result.next_steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      )}

      {result.question && (
        <p className="mt-4 rounded-xl bg-brand/10 px-3 py-2.5 text-sm text-ink/90">
          <span className="font-semibold text-brand">Ask yourself: </span>
          {result.question}
        </p>
      )}
    </section>
  );
}
