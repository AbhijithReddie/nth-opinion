import type { ReactNode } from "react";
import type { RoomMeta } from "@/config/rooms";
import { ArrowRightIcon } from "../icons";
import { Button } from "../ui/Button";

/**
 * "See it in action": a room's example input, a "Try this example" button, and the
 * hand-written sample conversation (passed as children), clearly labelled as a sample.
 */
export function SampleSection({
  room,
  onTry,
  children,
  id = "sample",
  compact = false,
}: {
  room: RoomMeta;
  onTry: () => void;
  children: ReactNode;
  id?: string;
  /** Inside the empty chat: no section heading, the parent provides one. */
  compact?: boolean;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      {!compact && (
        <div className="text-center">
          <p className="font-mono text-[11px] tracking-[0.2em] uppercase" style={{ color: room.accentInk }}>
            {room.title}
          </p>
          <h2 id={`${id}-title`} className="mt-2 font-display text-3xl font-semibold tracking-tight">
            See it in action
          </h2>
          <p className="mx-auto mt-2 max-w-md text-muted">A short, hand-written example of how a conversation here goes.</p>
        </div>
      )}

      <div
        className={`overflow-hidden rounded-3xl border bg-surface shadow-soft ${compact ? "" : "mt-6"}`}
        style={{ borderColor: `color-mix(in srgb, ${room.accent} 45%, var(--color-line))` }}
      >
        <div className="flex flex-col gap-4 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.14em] text-ink uppercase"
              style={{ backgroundColor: `color-mix(in srgb, ${room.accent} 30%, white)` }}
            >
              {compact ? <span id={`${id}-title`}>Sample conversation</span> : "Sample conversation"}
            </span>
            <p className="mt-2 text-xs text-muted">Example input</p>
            <p className="font-display text-lg leading-snug font-medium text-pretty">&ldquo;{room.example.prompt}&rdquo;</p>
          </div>
          <Button onClick={onTry} variant="secondary" className="self-start sm:self-center">
            Try this example <ArrowRightIcon className="size-4" />
          </Button>
        </div>
        <div className="chat-paper px-3 pt-1 pb-6 sm:px-5">{children}</div>
        <p className="border-t border-line bg-sand/60 px-4 py-2.5 text-center text-xs text-muted">
          Sample conversation written by hand to show the room. Your conversation will be different.
        </p>
      </div>
    </section>
  );
}
