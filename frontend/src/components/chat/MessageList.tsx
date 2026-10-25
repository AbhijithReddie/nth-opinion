"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FriendId } from "@/config/friends";
import type { ChatItem, ChatMessage, GroupSetup } from "@/lib/chatTypes";
import { senderName } from "./chatNames";
import { MessageBubble } from "./MessageBubble";
import { PollCard } from "./PollCard";
import { TypingBubble } from "./TypingBubble";

/** How close to the bottom (px) still counts as "reading the latest", so new messages auto-scroll. */
const STICK_THRESHOLD = 120;

/** The scrolling conversation: messages, polls and typing bubbles. Keeps itself scrolled to the newest message. */
export function MessageList({ items, typing, setup }: { items: ChatItem[]; typing: FriendId[]; setup: GroupSetup }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const messagesById = new Map(
    items.filter((i): i is ChatMessage => i.kind === "message").map((m) => [m.id, m]),
  );
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
        <EmptyState setup={setup} />
      ) : (
        <ol aria-label="Messages" aria-live="polite" aria-relevant="additions" className="flex flex-col">
          {items.map((item, i) => {
            if (item.kind === "poll") return <PollCard key={item.id} poll={item} setup={setup} />;
            const prev = items[i - 1];
            const grouped = prev?.kind === "message" && prev.sender === item.sender && !item.replyTo;
            return (
              <MessageBubble
                key={item.id}
                message={item}
                setup={setup}
                original={item.replyTo ? messagesById.get(item.replyTo) : undefined}
                grouped={grouped}
                highlighted={highlighted === item.id}
                onJump={jumpTo}
              />
            );
          })}
          {typing.map((id) => (
            <TypingBubble key={`typing-${id}`} id={id} name={senderName(setup, id)} />
          ))}
        </ol>
      )}
    </div>
  );
}

/** First visit to a new group: a friendly nudge with a few conversation starters. */
function EmptyState({ setup }: { setup: GroupSetup }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 py-10 text-center">
      <p className="text-4xl" aria-hidden>
        👋
      </p>
      <p className="mt-3 font-display text-lg font-bold">{setup.groupName} is ready</p>
      <p className="mt-1 max-w-sm text-sm text-muted">
        Tell {setup.friends.map((f) => f.name).join(", ")} what&apos;s on your mind. Try one of these:
      </p>
      <ul className="mt-4 space-y-1.5 text-sm text-ink/80">
        <li>&ldquo;Should I text my crush first?&rdquo;</li>
        <li>&ldquo;My manager took credit for my work again.&rdquo;</li>
        <li>&ldquo;MBA abroad or a job offer in Bangalore?&rdquo;</li>
      </ul>
    </div>
  );
}
