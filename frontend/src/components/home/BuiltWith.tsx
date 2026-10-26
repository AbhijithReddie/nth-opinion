export const TECH_STACK = [
  { name: "LangGraph", role: "Agent state machines: the director loop and the debate rounds" },
  { name: "LangSmith", role: "Tracing every agent call, so each decision can be inspected" },
  { name: "FastAPI", role: "Python backend streaming the room live over Server-Sent Events" },
  { name: "Next.js", role: "This website, styled with Tailwind CSS" },
];

/** "Built with" strip: the four main technologies and what each does. */
export function BuiltWith() {
  return (
    <section aria-labelledby="built-title" className="py-16 sm:py-20">
      <div className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-soft sm:p-10">
        <p className="font-mono text-[11px] tracking-[0.2em] text-primary-deep uppercase">Under the hood</p>
        <h2 id="built-title" className="mt-2 font-display text-2xl font-semibold sm:text-3xl">
          Built with LangGraph, LangSmith, FastAPI and Next.js
        </h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TECH_STACK.map((t) => (
            <li key={t.name} className="rounded-2xl border border-line bg-canvas p-4">
              <p className="font-display text-lg font-semibold">{t.name}</p>
              <p className="mt-1 text-sm text-muted">{t.role}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
