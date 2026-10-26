import { CloseIcon, HeartIcon } from "../icons";

/** Calm, always-visible support banner shown when the backend detects someone may be struggling. */
export function SafetyBanner({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  return (
    <div role="status" className="animate-fade-in flex items-start gap-3 border-b border-support/30 bg-support-soft px-4 py-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-support">
        <HeartIcon className="size-4" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-support">You&apos;re not alone</p>
        <p className="mt-0.5 leading-relaxed text-ink">{text}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Hide support message"
        className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-ink focus-visible:ring-2 focus-visible:ring-support/60 focus-visible:outline-none"
      >
        <CloseIcon className="size-4" />
      </button>
    </div>
  );
}
