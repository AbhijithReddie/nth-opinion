import type { FutureLetters } from "@/lib/chatTypes";
import { Avatar } from "./Avatar";
import { formatTime } from "./chatNames";
import { useRoom } from "./RoomContext";

/** Future You summary: the paths, a letter from each future self, next steps and one honest question. */
export function LettersCard({ result, ts }: { result: FutureLetters; ts: number }) {
  const { persona, nameOf } = useRoom();

  return (
    <section aria-label="Letters from future you" className="rounded-2xl border border-room-future/40 bg-surface p-4 text-left shadow-lift">
      <p className="font-mono text-[10px] tracking-[0.18em] text-room-future-ink uppercase">💌 Letters from future you · {formatTime(ts)}</p>
      <h3 className="mt-1.5 font-display text-lg leading-snug font-semibold">{result.decision}</h3>

      {result.paths.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {result.paths.map((p) => (
            <li key={p.option} className="rounded-xl border border-line bg-sand/60 p-3 text-sm">
              <p className="font-semibold">{p.option}</p>
              <p className="mt-1 text-muted">
                <span className="text-pro-deep">↑ </span>
                {p.upside}
              </p>
              <p className="text-muted">
                <span className="text-con-deep">↓ </span>
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
              className="rounded-xl border bg-canvas p-3.5"
              style={{ borderColor: `${meta.color}40` }}
            >
              <figcaption className="flex items-center gap-2 text-sm font-semibold" style={{ color: meta.color }}>
                <Avatar persona={meta} size="xs" /> From {nameOf(l.friend_id)}
              </figcaption>
              <blockquote className="mt-2 font-display text-[15px] leading-relaxed whitespace-pre-line text-ink italic">
                {l.letter}
              </blockquote>
            </figure>
          ) : null;
        })}
      </div>

      {result.next_steps.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="font-mono text-[10px] tracking-[0.18em] text-pro-deep uppercase">This week</p>
          <ol className="mt-1.5 list-inside list-decimal space-y-1 text-sm text-ink marker:text-muted">
            {result.next_steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      )}

      {result.question && (
        <p className="mt-4 rounded-xl bg-room-future/10 px-3 py-2.5 text-sm text-ink">
          <span className="font-semibold text-room-future-ink">Ask yourself: </span>
          {result.question}
        </p>
      )}
    </section>
  );
}
