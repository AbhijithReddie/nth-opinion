"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChatItem, ChatMessage } from "@/lib/chatTypes";
import { fillTemplate } from "./chatNames";
import { MessageBubble } from "./MessageBubble";
import { ModeDivider } from "./ModeDivider";
import { useRoom } from "./RoomContext";
import { SummaryCard } from "./SummaryCard";
import { TypingBubble } from "./TypingBubble";

/** How close to the bottom (px) still counts as "reading the latest", so new messages auto-scroll. */
const STICK_THRESHOLD = 120;

/** The scrolling conversation: messages, summary cards and typing bubbles. Keeps itself scrolled to the newest message. */
export function MessageList({ items, typing }: { items: ChatItem[]; typing: string[] }) {
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
        <EmptyState />
      ) : (
        <ol aria-label="Messages" aria-live="polite" aria-relevant="additions" className="flex flex-col">
          {items.map((item, i) => {
            if (item.kind === "summary") return <SummaryCard key={item.id} item={item} />;
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

/** A new room: a friendly nudge with a few conversation starters from the room's config. */
function EmptyState() {
  const { config, setup } = useRoom();
  const values = { title: setup.title, names: setup.participants.map((p) => p.name).join(", ") };

  return (
    <div className="flex h-full flex-col items-center justify-center px-4 py-10 text-center">
      <p className="text-4xl" aria-hidden>
        👋
      </p>
      <p className="mt-3 font-display text-lg font-bold">{fillTemplate(config.copy.emptyTitle, values)}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{fillTemplate(config.copy.emptyIntro, values)}</p>
      <ul className="mt-4 max-w-md space-y-1.5 text-sm text-ink/80">
        {config.copy.starters.map((s) => (
          <li key={s}>&ldquo;{s}&rdquo;</li>
        ))}
      </ul>
    </div>
  );
}
