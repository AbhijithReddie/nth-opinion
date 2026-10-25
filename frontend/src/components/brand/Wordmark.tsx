/**
 * The "Nth Opinion" wordmark, with "th" as a small raised superscript like an
 * ordinal. Sized in em, so it scales with whatever font size the parent sets.
 * The text content is still "Nth Opinion", so screen readers and copy/paste read it normally.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`font-display font-extrabold tracking-tight whitespace-nowrap ${className ?? ""}`}>
      N
      {/* translate rather than vertical-align, so the superscript doesn't push the line height around */}
      <span className="ml-[0.03em] inline-block -translate-y-[0.72em] text-[0.5em] tracking-normal">th</span> Opinion
    </span>
  );
}
