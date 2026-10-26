"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getRoom } from "@/config/rooms";
import type { ChatItem, ChatMessage } from "@/lib/chatTypes";
import { RoomIllustration } from "../illustrations/RoomIllustration";
import { SampleSection } from "../rooms/SampleSection";
import { fillTemplate } from "./chatNames";
import { MessageBubble } from "./MessageBubble";
import { ModeDivider } from "./ModeDivider";
import { useRoom } from "./RoomContext";
import { RoomSample } from "./RoomSample";
import { SummaryCard } from "./SummaryCard";
import { TypingBubble } from "./TypingBubble";

/** How close to the bottom (px) still counts as "reading the latest", so new messages auto-scroll. */
const STICK_THRESHOLD = 120;

/**
 * The scrolling conversation: messages, summary cards and typing bubbles. Keeps itself scrolled to the newest message.
 * `onTryExample` fills the composer with the room's example message (from the empty state).
 */
export function MessageList({ items, typing, onTryExample }: { items: ChatItem[]; typing: string[]; onTryExample: (text: string) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const messagesById = new Map(items.filter((i): i is ChatMessage => i.kind === "message").map((m) => [m.id, m]));
  const lastItem = items.at(-1);

  // New content: follow it if the user was already at the bottom, or if they just sent a message.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const userJustSent = lastItem?.kind === "message" && lastItem.sender === "user";
    if (stickToBottom.current || userJustSent) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [items.length, lastItem, typing.length]);

  useEffect(() => () => clearTimeout(highlightTimer.current), []);

  /** Scroll to a quoted message and flash it. */
  function jumpTo(id: string) {
    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlighted(id);
    clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlighted(null), 1500);
  }

  return (
    <div
      ref={scrollRef}
      onScroll={(e) => {
        const el = e.currentTarget;
        stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD;
      }}
      className="scroll-thin flex-1 overflow-y-auto overscroll-contain px-3 pt-2 pb-4 sm:px-5"
    >
      {items.length === 0 && typing.length === 0 ? (
        <EmptyState onTryExample={onTryExample} />
      ) : (
        <ol aria-label="Messages" aria-live="polite" aria-relevant="additions" className="flex flex-col">
          {items.map((item, i) => {
            if (item.kind === "summary") return <SummaryCard key={item.id} item={item} shareable />;
            if (item.kind === "mode") return <ModeDivider key={item.id} mode={item.mode} />;
            const prev = items[i - 1];
            const grouped = prev?.kind === "message" && prev.sender === item.sender && !item.replyTo;
            return (
              <MessageBubble
                key={item.id}
                message={item}
                original={item.replyTo ? messagesById.get(item.replyTo) : undefined}
                grouped={grouped}
                highlighted={highlighted === item.id}
                onJump={jumpTo}
              />
            );
          })}
          {typing.map((id) => (
            <TypingBubble key={`typing-${id}`} id={id} />
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * A new room: the room's illustration, a friendly nudge with a few conversation starters from the room's config,
 * and the room's sample conversation (folded away) with a "Try this example" button.
 */
function EmptyState({ onTryExample }: { onTryExample: (text: string) => void }) {
  const { config, setup } = useRoom();
  const room = getRoom(config.roomId);
  const values = { title: setup.title, names: setup.participants.map((p) => p.name).join(", ") };

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-2 py-8 text-center">
      <RoomIllustration roomId={config.roomId} className="max-w-[15rem]" />
      <p className="mt-3 font-display text-xl font-semibold">{fillTemplate(config.copy.emptyTitle, values)}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{fillTemplate(config.copy.emptyIntro, values)}</p>
      <ul className="mt-4 max-w-md space-y-1.5 text-sm text-ink">
        {config.copy.starters.map((s) => (
          <li key={s} className="rounded-xl border border-line bg-surface px-3 py-1.5 shadow-soft">
            &ldquo;{s}&rdquo;
          </li>
        ))}
      </ul>
      <details className="group mt-6 w-full max-w-xl text-left">
        <summary className="mx-auto w-fit cursor-pointer list-none rounded-full border border-line-strong bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-soft transition hover:bg-sand focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">See a sample conversation</span>
          <span className="hidden group-open:inline">Hide the sample</span>
        </summary>
        <div className="mt-4">
          <SampleSection room={room} id="chat-sample" compact onTry={() => onTryExample(room.example.fill.message)}>
            <RoomSample config={config} example={room.example} />
          </SampleSection>
        </div>
      </details>
    </div>
  );
}
