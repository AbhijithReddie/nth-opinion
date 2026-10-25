import { RefreshIcon } from "../icons";

/** Resets the whole page back to the landing form (stopping any running debate). */
export function NewDebateButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-ink transition hover:border-white/25 hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-judge/60 focus-visible:outline-none ${className}`}
    >
      <RefreshIcon className="size-4" />
      New debate
    </button>
  );
}
