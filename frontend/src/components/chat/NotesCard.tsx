import type { StudyNotes } from "@/lib/chatTypes";
import { formatTime } from "./chatNames";

/** Study Group summary: key points, a memory trick, a self-test with hidden answers, weak spots and what's next. */
export function NotesCard({ notes, ts }: { notes: StudyNotes; ts: number }) {
  return (
    <section aria-label="Study notes" className="rounded-2xl border border-room-study/50 bg-surface p-4 text-left shadow-lift">
      <p className="font-mono text-[10px] tracking-[0.18em] text-room-study-ink uppercase">📒 Study notes · {formatTime(ts)}</p>
      <h3 className="mt-1.5 font-display text-lg leading-snug font-semibold">{notes.topic}</h3>

      <ul className="mt-3 space-y-1.5 text-sm text-ink">
        {notes.key_points.map((point) => (
          <li key={point} className="flex gap-2">
            <span aria-hidden className="text-room-study-ink">
              •
            </span>
            {point}
          </li>
        ))}
      </ul>

      {notes.memory_trick && (
        <p className="mt-3 rounded-xl border border-pro/30 bg-pro-soft px-3 py-2.5 text-sm text-ink">
          <span className="font-semibold text-pro-deep">🧠 Remember it: </span>
          {notes.memory_trick}
        </p>
      )}

      {notes.quiz.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="font-mono text-[10px] tracking-[0.18em] text-butter-deep uppercase">Test yourself (tap to reveal)</p>
          <ol className="mt-2 space-y-1.5">
            {notes.quiz.map((q, i) => (
              <li key={q.question}>
                <details className="group rounded-lg bg-sand px-3 py-2 text-sm">
                  <summary className="cursor-pointer list-none font-medium marker:hidden focus-visible:outline-2 focus-visible:outline-primary">
                    <span className="mr-1.5 font-mono text-xs text-muted">{i + 1}.</span>
                    {q.question}
                    <span className="ml-1.5 text-xs text-muted group-open:hidden">· show answer</span>
                  </summary>
                  <p className="mt-1.5 text-ink">{q.answer}</p>
                </details>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-4 grid gap-3 border-t border-line pt-3 text-sm sm:grid-cols-2">
        <List title="Revise these" items={notes.weak_spots} className="text-con-deep" />
        <List title="Study next" items={notes.next_topics} className="text-accent-deep" />
      </div>
    </section>
  );
}

function List({ title, items, className }: { title: string; items: string[]; className: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className={`font-mono text-[10px] tracking-[0.18em] uppercase ${className}`}>{title}</p>
      <ul className="mt-1.5 space-y-1 text-ink">
        {items.map((item) => (
          <li key={item}>→ {item}</li>
        ))}
      </ul>
    </div>
  );
}
