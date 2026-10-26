import type { ReactNode } from "react";
import type { SlowState } from "@/lib/sseClient";
import { PlayIcon } from "../icons";
import { Button } from "../ui/Button";

const TEXT = {
  waking: "Waking up the server (free hosting can take up to a minute)...",
  offer: "The AI is taking a break, watch a real conversation instead.",
};

export type DemoNoticeKind = keyof typeof TEXT;

/**
 * Which notice a slow request needs: "offer" the demo once nothing has arrived
 * for 12s (if the room has one), "waking" while the server hasn't answered yet.
 */
export function slowNoticeKind(slow: SlowState, hasDemo: boolean): DemoNoticeKind | null {
  if (slow?.stalled && hasDemo) return "offer";
  return slow?.waking ? "waking" : null;
}

/** "Waking up the server" or "The AI is taking a break", with a button to watch the demo replay instead. */
export function DemoNotice({
  kind,
  onWatch,
  children,
  className = "",
}: {
  kind: DemoNoticeKind;
  /** Starts the demo replay; leave out when the room has no recording. */
  onWatch?: () => void;
  /** Extra actions, e.g. "Try again". */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={kind === "offer" ? "alert" : "status"}
      className={`animate-fade-in flex flex-wrap items-center gap-2 rounded-xl border border-accent/40 bg-lavender-soft px-3 py-2 text-sm ${className}`}
    >
      <p className="min-w-0 flex-1 basis-48 font-medium text-ink">{TEXT[kind]}</p>
      {onWatch && (
        <Button size="sm" onClick={onWatch}>
          <PlayIcon className="size-3.5" /> Watch the demo
        </Button>
      )}
      {children}
    </div>
  );
}

/** The "Watch a demo" button that sits next to a room's start button. */
export function WatchDemoButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <Button variant="secondary" size="lg" onClick={onClick} className={className}>
      <PlayIcon className="size-4" /> Watch a demo
    </Button>
  );
}
