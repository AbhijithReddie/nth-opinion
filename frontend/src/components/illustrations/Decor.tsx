/**
 * Decorative touches: soft background blobs and little doodles. Purely visual,
 * so they're hidden from screen readers and never catch clicks.
 */

/** Soft blobs behind a section. Place inside a `relative` parent. */
export function BackdropBlobs({ className = "", tones = ["fill-butter/30", "fill-lavender/25", "fill-sage/20"] }: { className?: string; tones?: [string, string, string] }) {
  return (
    <svg aria-hidden viewBox="0 0 800 400" preserveAspectRatio="none" className={`pointer-events-none absolute inset-0 -z-10 h-full w-full ${className}`}>
      <path d="M60 80C140 0 300 20 340 90s-60 160-170 160S-20 160 60 80Z" className={tones[0]} />
      <path d="M560 40c90-30 210 20 220 100s-80 120-170 110-140-60-130-120 20-70 80-90Z" className={tones[1]} />
      <path d="M300 300c60-40 180-30 210 20s-40 90-120 90-150-70-90-110Z" className={tones[2]} />
    </svg>
  );
}

/** A scatter of sparkles, dots and squiggles. Place inside a `relative` parent. */
export function Doodles({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 600 300" className={`pointer-events-none absolute inset-0 -z-10 h-full w-full ${className}`} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M40 60l3 9 9 3-9 3-3 9-3-9-9-3 9-3Z" className="fill-butter stroke-ink/30" strokeWidth={1.4} />
      <path d="M560 50l2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" className="fill-lavender stroke-ink/30" strokeWidth={1.4} />
      <path d="M520 240q8-10 16 0t16 0" className="stroke-sage" strokeWidth={2.4} />
      <path d="M70 230q8-10 16 0t16 0" className="stroke-terracotta/60" strokeWidth={2.4} />
      <circle cx="120" cy="120" r="4" className="fill-terracotta/40" />
      <circle cx="480" cy="140" r="5" className="fill-butter/70" />
      <circle cx="300" cy="24" r="3.5" className="fill-sage/60" />
    </svg>
  );
}
