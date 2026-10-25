export const SAMPLE_TOPICS = [
  "Remote work is better than working in an office",
  "AI will create more jobs than it destroys",
  "Social media does more harm than good",
  "Space exploration is worth the cost",
  "Homework should be banned in primary schools",
  "Cities should ban private cars from their centres",
];

/** Clickable topic chips that fill the topic input. */
export function SampleTopics({ onPick, disabled }: { onPick: (topic: string) => void; disabled: boolean }) {
  return (
    <div>
      <p className="mb-2.5 font-mono text-[11px] tracking-[0.18em] text-faint uppercase">Or try one of these</p>
      <div className="flex flex-wrap gap-2">
        {SAMPLE_TOPICS.map((topic) => (
          <button
            key={topic}
            type="button"
            disabled={disabled}
            onClick={() => onPick(topic)}
            className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-left text-[13px] text-muted transition hover:border-judge/40 hover:bg-judge/10 hover:text-ink focus-visible:ring-2 focus-visible:ring-judge/60 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
          >
            {topic}
          </button>
        ))}
      </div>
    </div>
  );
}
