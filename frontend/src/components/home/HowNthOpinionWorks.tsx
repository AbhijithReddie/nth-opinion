import { SectionHeading } from "../ui/SectionHeading";

const STEPS = [
  {
    title: "You bring a problem",
    body: "A decision, a crush, a career move, a startup idea. Ask it in English, Hinglish or Tenglish.",
    color: "var(--color-ink)",
  },
  {
    title: "Several minds, different personalities",
    body: "Each AI agent has its own personality, speaking style and typical take, so you get perspectives that actually disagree.",
    color: "var(--color-cyan)",
  },
  {
    title: "A director runs the room",
    body: "A director agent reads the conversation and decides who would naturally speak next, who reacts, and when to hand it back to you.",
    color: "var(--color-coral)",
  },
  {
    title: "You get a real answer",
    body: "Under the banter, every agent gives honest advice. End with a vote, a score or a verdict.",
    color: "var(--color-gold)",
  },
];

/** "How it works": four numbered steps from your problem to the room's answer. */
export function HowNthOpinionWorks() {
  return (
    <section aria-labelledby="how-title" className="py-16 sm:py-20">
      <SectionHeading id="how-title" eyebrow="How it works" title="Not one chatbot. A room full of them.">
        Nth Opinion is a multi-agent system. Instead of one assistant answering politely, several agents talk it through,
        with you and with each other.
      </SectionHeading>
      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="rounded-2xl border border-white/[0.07] bg-arena-900/70 p-5">
            <span
              className="grid size-9 place-items-center rounded-xl border font-mono text-sm font-semibold"
              style={{ color: step.color, borderColor: `color-mix(in srgb, ${step.color} 35%, transparent)` }}
            >
              0{i + 1}
            </span>
            <h3 className="mt-4 font-display text-lg font-bold">{step.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
