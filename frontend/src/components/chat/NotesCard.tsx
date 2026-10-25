import type { StudyNotes } from "@/lib/chatTypes";
import { formatTime } from "./chatNames";

/** Study Group summary: key points, a memory trick, a self-test with hidden answers, weak spots and what's next. */
export function NotesCard({ notes, ts }: { notes: StudyNotes; ts: number }) {
  return (
    <section aria-label="Study notes" className="rounded-2xl border border-cyan/30 bg-arena-900 p-4 shadow-[0_10px_40px_-20px_var(--color-cyan)]">
      <p className="font-mono text-[10px] tracking-[0.18em] text-cyan uppercase">📒 Study notes · {formatTime(ts)}</p>
      <h3 className="mt-1.5 font-display text-lg leading-snug font-bold">{notes.topic}</h3>

      <ul className="mt-3 space-y-1.5 text-sm text-ink/85">
        {notes.key_points.map((point) => (
          <li key={point} className="flex gap-2">
            <span aria-hidden className="text-cyan">
              •
            </span>
            {point}
          </li>
        ))}
      </ul>

      {notes.memory_trick && (
        <p className="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] px-3 py-2.5 text-sm text-ink/90">
          <span className="font-semibold text-emerald-300">🧠 Remember it: </span>
          {notes.memory_trick}
        </p>
      )}

      {notes.quiz.length > 0 && (
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          <p className="font-mono text-[10px] tracking-[0.18em] text-gold uppercase">Test yourself (tap to reveal)</p>
          <ol className="mt-2 space-y-1.5">
            {notes.quiz.map((q, i) => (
              <li key={q.question}>
                <details className="group rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
                  <summary className="cursor-pointer list-none font-medium marker:hidden focus-visible:outline-2 focus-visible:outline-brand">
                    <span className="mr-1.5 font-mono text-xs text-faint">{i + 1}.</span>
                    {q.question}
                    <span className="ml-1.5 text-xs text-faint group-open:hidden">· show answer</span>
                  </summary>
                  <p className="mt-1.5 text-ink/80">{q.answer}</p>
                </details>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-4 grid gap-3 border-t border-white/[0.06] pt-3 text-sm sm:grid-cols-2">
        <List title="Revise these" items={notes.weak_spots} className="text-coral" />
        <List title="Study next" items={notes.next_topics} className="text-brand" />
      </div>
    </section>
  );
}

function List({ title, items, className }: { title: string; items: string[]; className: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className={`font-mono text-[10px] tracking-[0.18em] uppercase ${className}`}>{title}</p>
      <ul className="mt-1.5 space-y-1 text-ink/80">
        {items.map((item) => (
          <li key={item}>→ {item}</li>
        ))}
      </ul>
    </div>
  );
}
