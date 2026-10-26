import { GavelIcon } from "../icons";

/**
 * Shown between Con's last turn and the verdict. The judge's output is not
 * streamed, so a swinging gavel and shimmering lines fill the wait.
 */
export function JudgeDeliberating() {
  return (
    <section
      role="status"
      aria-live="polite"
      className="animate-fade-up mx-auto max-w-2xl rounded-3xl border border-judge bg-surface p-6 text-center shadow-lift sm:p-8"
    >
      <div className="relative mx-auto grid size-16 place-items-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-judge/30 [animation-duration:2s]" />
        <span className="relative grid size-16 place-items-center rounded-full border border-judge bg-judge-soft text-judge-deep">
          <GavelIcon className="animate-gavel size-7 origin-bottom-left" />
        </span>
      </div>
      <p className="mt-5 font-display text-xl font-semibold text-judge-deep">The judge is deliberating...</p>
      <p className="mt-1 text-sm text-muted">Weighing logic, evidence and rebuttals from both sides.</p>
      <div className="mx-auto mt-6 max-w-sm space-y-2.5" aria-hidden>
        <div className="shimmer-line animate-shimmer h-2.5 rounded-full" />
        <div className="shimmer-line animate-shimmer mx-auto h-2.5 w-4/5 rounded-full [animation-delay:0.2s]" />
        <div className="shimmer-line animate-shimmer mx-auto h-2.5 w-3/5 rounded-full [animation-delay:0.4s]" />
      </div>
    </section>
  );
}
