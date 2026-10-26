import { RefreshIcon } from "../icons";

/** Resets the whole page back to the landing form (stopping any running debate). */
export function NewDebateButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-line-strong bg-surface px-4 text-sm font-semibold text-ink shadow-soft transition hover:border-ink/25 hover:bg-sand focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none ${className}`}
    >
      <RefreshIcon className="size-4" />
      New debate
    </button>
  );
}
