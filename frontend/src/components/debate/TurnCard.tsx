import { SIDES } from "@/lib/sides";
import type { Speaker } from "@/lib/types";
import { TypingIndicator } from "../TypingIndicator";

interface TurnCardProps {
  speaker: Speaker;
  round: number;
  text: string;
  /** Tokens are still arriving: show a caret and a typing indicator. */
  streaming: boolean;
}

/** One speech by Pro or Con, labelled with its round. Text grows live while streaming. */
export function TurnCard({ speaker, round, text, streaming }: TurnCardProps) {
  const side = SIDES[speaker];
  const waiting = streaming && text.length === 0;

  return (
    <article
      aria-busy={streaming}
      className={`animate-fade-up relative overflow-hidden rounded-2xl border bg-surface p-4 shadow-soft sm:p-5 ${side.border} ${
        streaming ? side.glow : ""
      }`}
    >
      {/* Coloured edge so the side is obvious even when columns stack on a phone. */}
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${side.bar}`} />

      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`rounded-md px-2 py-0.5 font-display text-sm font-semibold ${side.bg} ${side.text}`}>
            {side.label}
          </span>
          <span className="font-mono text-xs tracking-wider text-muted uppercase">Round {round}</span>
        </div>
        {streaming && (
          <span className={`flex items-center gap-2 font-mono text-[11px] uppercase ${side.text}`}>
            {waiting ? "Thinking" : "Speaking"}
            <TypingIndicator label={`${side.label} is ${waiting ? "thinking" : "speaking"}`} />
          </span>
        )}
      </header>

      {waiting ? (
        <div className="space-y-2" aria-hidden>
          <div className="h-3 w-11/12 rounded bg-sand" />
          <div className="h-3 w-4/5 rounded bg-sand" />
          <div className="h-3 w-2/3 rounded bg-sand" />
        </div>
      ) : (
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-ink">
          {text}
          {streaming && (
            <span aria-hidden className={`animate-caret ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 ${side.bar}`} />
          )}
        </p>
      )}
    </article>
  );
}
