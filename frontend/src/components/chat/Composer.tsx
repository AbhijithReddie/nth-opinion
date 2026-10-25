"use client";

import { useRef, useState, type FormEvent } from "react";
import { MESSAGE_MAX } from "@/config/roomChats";
import { PollIcon, SendIcon } from "../icons";
import { TypingIndicator } from "../TypingIndicator";

interface ComposerProps {
  onSend: (text: string) => boolean;
  onSummary: () => void;
  canSummarize: boolean;
  summarizing: boolean;
  /** The room is still replying; sending now interrupts it. */
  replying: boolean;
  /** Wording from the room config. */
  labels: { summary: string; summaryLoading: string; placeholder: string; note: string };
}

/** Message input (Enter sends, Shift+Enter for a new line), send button and the room's summary button. */
export function Composer({ onSend, onSummary, canSummarize, summarizing, replying, labels }: ComposerProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nearLimit = text.length > MESSAGE_MAX - 100;

  /** Grow the textarea with its content, up to about 5 lines. */
  function autosize() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
    // Only show a scrollbar once the text is taller than the box.
    el.style.overflowY = el.scrollHeight > 132 ? "auto" : "hidden";
  }

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (onSend(text)) {
      setText("");
      requestAnimationFrame(autosize);
    }
    inputRef.current?.focus();
  }

  return (
    <div className="border-t border-white/[0.06] bg-arena-900/90 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onSummary}
          disabled={!canSummarize || summarizing}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 text-xs font-semibold text-brand transition hover:bg-brand/20 focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          title={canSummarize ? undefined : "Send a message first"}
        >
          {summarizing ? (
            <>
              {labels.summaryLoading} <TypingIndicator label={labels.summaryLoading} />
            </>
          ) : (
            <>
              <PollIcon className="size-3.5" /> {labels.summary}
            </>
          )}
        </button>
        {replying && <span className="text-[11px] text-faint">You can reply any time</span>}
      </div>

      <form onSubmit={submit} className="flex items-end gap-2">
        <label htmlFor="chat-input" className="sr-only">
          {labels.placeholder}
        </label>
        <div className="relative flex-1">
          <textarea
            id="chat-input"
            ref={inputRef}
            rows={1}
            value={text}
            maxLength={MESSAGE_MAX}
            placeholder={labels.placeholder}
            onChange={(e) => {
              setText(e.target.value);
              autosize();
            }}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter adds a new line. Don't send mid-IME composition.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
            }}
            className="scroll-thin block max-h-33 min-h-11 w-full resize-none overflow-y-hidden rounded-2xl border border-white/10 bg-arena-950/80 px-4 py-2.5 text-base text-ink placeholder:text-faint focus:border-brand/50 focus:ring-2 focus:ring-brand/25 focus:outline-none sm:text-[15px]"
          />
          {nearLimit && (
            <span className="pointer-events-none absolute right-3 -top-5 font-mono text-[10px] text-gold">
              {text.length}/{MESSAGE_MAX}
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Send message"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-arena-950 transition hover:bg-[#9d90ff] focus-visible:ring-2 focus-visible:ring-brand/70 focus-visible:ring-offset-2 focus-visible:ring-offset-arena-900 focus-visible:outline-none active:scale-95 disabled:bg-arena-600 disabled:text-muted"
        >
          <SendIcon className="size-5" />
        </button>
      </form>
      <p className="mt-1.5 text-center text-[11px] text-faint">{labels.note}</p>
    </div>
  );
}
