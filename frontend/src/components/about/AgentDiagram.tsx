/**
 * How a Huddle room runs, drawn with plain HTML/CSS:
 *   You -> Safety check -> Director <-> Agents (loop) -> back to you.
 * Stacks vertically on phones, flows left to right on wide screens.
 */

const AGENTS = [
  { emoji: "😏", name: "Agent A", color: "var(--color-cyan)" },
  { emoji: "🌸", name: "Agent B", color: "var(--color-coral)" },
  { emoji: "🧐", name: "Agent C", color: "var(--color-gold)" },
];

function Node({ title, body, accent }: { title: string; body: string; accent: string }) {
  return (
    <div
      className="w-full rounded-2xl border bg-arena-950/70 p-4 text-center lg:w-44"
      style={{ borderColor: `color-mix(in srgb, ${accent} 40%, transparent)` }}
    >
      <p className="font-display font-bold" style={{ color: accent }}>
        {title}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{body}</p>
    </div>
  );
}

/** An arrow pointing down on phones and right on wide screens. */
function Arrow({ label }: { label?: string }) {
  return (
    <div aria-hidden className="flex shrink-0 flex-col items-center justify-center gap-1 py-1 text-faint lg:px-1 lg:py-0">
      <span className="text-lg leading-none lg:hidden">↓</span>
      <span className="hidden text-lg leading-none lg:inline">→</span>
      {label && <span className="font-mono text-[10px] tracking-wider uppercase">{label}</span>}
    </div>
  );
}

export function AgentDiagram() {
  return (
    <figure className="rounded-3xl border border-white/[0.07] bg-arena-900/70 p-5 sm:p-8">
      <div className="flex flex-col items-stretch lg:flex-row lg:items-center lg:justify-between">
        <Node title="You" body="Send a message, any time" accent="var(--color-ink)" />
        <Arrow />
        <Node title="Safety check" body="Normal, or switch everyone to supportive mode" accent="var(--color-support)" />
        <Arrow />
        <Node title="Director" body="Picks who speaks, who reacts, or when to stop" accent="var(--color-brand)" />
        <Arrow label="speak / react" />

        {/* The agents, with a loop back to the director after each message. */}
        <div className="relative rounded-2xl border border-dashed border-white/10 p-3 lg:w-48">
          <p className="mb-2 text-center font-mono text-[10px] tracking-[0.18em] text-faint uppercase">Agents</p>
          <ul className="flex justify-center gap-2 lg:flex-col">
            {AGENTS.map((a) => (
              <li
                key={a.name}
                className="flex items-center gap-2 rounded-xl border bg-arena-950/70 px-2.5 py-1.5 text-sm"
                style={{ borderColor: `color-mix(in srgb, ${a.color} 40%, transparent)` }}
              >
                <span aria-hidden>{a.emoji}</span>
                <span className="hidden sm:inline">{a.name}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-center text-[11px] text-muted">↺ back to the director after every message</p>
        </div>

        <Arrow label="end" />
        <Node title="Your turn" body="The room pauses so you can reply" accent="var(--color-ink)" />
      </div>
      <figcaption className="mt-5 text-center text-sm text-muted">
        One user message can trigger several agent messages and emoji reactions. Code enforces the limits: nobody
        speaks three times in a row, and at most 6 messages and 4 reactions per message.
      </figcaption>
    </figure>
  );
}
