"use client";

import { useBehindTheScenes } from "@/hooks/useBehindTheScenes";
import { EyeIcon } from "../icons";

/** The eye button that opens or closes the "Behind the scenes" panel (remembered across rooms and visits). */
export function BehindTheScenesToggle({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const [on, setOn] = useBehindTheScenes();
  return (
    <button
      type="button"
      aria-pressed={on}
      title={on ? "Hide what the agents are doing" : "Show what the agents are doing"}
      onClick={() => setOn(!on)}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-accent-deep/50 focus-visible:outline-none ${
        on ? "border-accent-deep/40 bg-lavender-soft text-accent-deep" : "border-line-strong bg-surface text-muted hover:text-ink"
      } ${className}`}
    >
      <EyeIcon className="size-4" />
      {/* On small chat headers only the icon shows; the label stays for screen readers. */}
      <span className={compact ? "sr-only sm:not-sr-only" : ""}>Behind the scenes</span>
    </button>
  );
}
