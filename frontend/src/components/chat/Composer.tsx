"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { MESSAGE_MAX } from "@/config/roomChats";
import { useDictation } from "@/hooks/useDictation";
import { useHandsFree, useRecognitionLanguage, useSpeechInputSupported } from "@/hooks/useVoice";
import { voice } from "@/lib/voice/player";
import { MicButton, VoiceInputOptions } from "../voice/MicButton";
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
  /** Rooms with modes: a button that switches to the other mode. */
  modeSwitch?: { label: string; onClick: () => void };
  /** Text to start with, e.g. a room's example message. */
  initialText?: string;
  /** Focus the input on mount (after the text was filled in for the user). */
  autoFocus?: boolean;
  /** The room's chat language: picks the default voice input language. */
  language?: string;
}

/** Message input (Enter sends, Shift+Enter for a new line), send button and the room's summary button. */
export function Composer({ onSend, onSummary, canSummarize, summarizing, replying, labels, modeSwitch, initialText = "", autoFocus = false, language = "english" }: ComposerProps) {
  const [text, setText] = useState(initialText);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nearLimit = text.length > MESSAGE_MAX - 100;

  // Voice input: the transcript is added after whatever was already typed, live as you speak.
  // It's only sent by itself in hands-free mode; otherwise the user can edit it first.
  const micSupported = useSpeechInputSupported();
  const handsFree = useHandsFree();
  const [micLang, setMicLang] = useRecognitionLanguage(language);
  const [micUsed, setMicUsed] = useState(false);
  const typedBefore = useRef("");
  const dictation = useDictation(micLang, (spoken, final) => {
    const full = `${typedBefore.current}${typedBefore.current && spoken ? " " : ""}${spoken}`.slice(0, MESSAGE_MAX);
    if (final && handsFree && spoken.trim()) {
      if (onSend(full)) return setText("");
    }
    setText(full);
    requestAnimationFrame(autosize);
  });
  function toggleMic() {
    if (!dictation.listening) typedBefore.current = text.trim();
    setMicUsed(true);
    dictation.toggle();
  }

  /** Grow the textarea with its content, up to about 5 lines. */
  function autosize() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
    // Only show a scrollbar once the text is taller than the box.
    el.style.overflowY = el.scrollHeight > 132 ? "auto" : "hidden";
  }

  // Size the box for any starting text, and put the cursor at its end.
  useEffect(() => {
    const el = inputRef.current;
    if (!el || !el.value) return;
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
    el.style.overflowY = el.scrollHeight > 132 ? "auto" : "hidden";
    if (autoFocus) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [autoFocus]);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    dictation.stop();
    voice.stop(); // sending a message stops the room reading aloud
    if (onSend(text)) {
      setText("");
      requestAnimationFrame(autosize);
    }
    inputRef.current?.focus();
  }

  return (
    <div className="border-t border-line bg-surface/95 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {modeSwitch && (
          <button
            type="button"
            onClick={modeSwitch.onClick}
            className="inline-flex h-8 items-center rounded-full border border-line-strong bg-surface px-3 text-xs font-semibold text-ink transition hover:bg-sand focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
          >
            {modeSwitch.label}
          </button>
        )}
        <button
          type="button"
          onClick={onSummary}
          disabled={!canSummarize || summarizing}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-primary/30 bg-primary-soft px-3 text-xs font-semibold text-primary-deep transition hover:border-primary/50 hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
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
        {replying && <span className="ml-auto text-[11px] text-faint">You can reply any time</span>}
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
            className="scroll-thin block max-h-33 min-h-11 w-full resize-none overflow-y-hidden rounded-2xl border border-line-strong bg-canvas px-4 py-2.5 text-base text-ink placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none sm:text-[15px]"
          />
          {nearLimit && (
            <span className="pointer-events-none absolute right-3 -top-5 font-mono text-[10px] text-judge-deep">
              {text.length}/{MESSAGE_MAX}
            </span>
          )}
        </div>
        {micSupported && <MicButton listening={dictation.listening} level={dictation.level} onClick={toggleMic} />}
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Send message"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-white shadow-[0_8px_20px_-10px_var(--color-primary)] transition hover:bg-primary-deep focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none active:scale-95 disabled:bg-sand-deep disabled:text-muted disabled:shadow-none"
        >
          <SendIcon className="size-5" />
        </button>
      </form>
      {micSupported && (micUsed || dictation.error) && (
        <VoiceInputOptions
          lang={micLang}
          onLang={(lang) => {
            dictation.stop();
            setMicLang(lang);
          }}
          listening={dictation.listening}
          error={dictation.error}
          onClearError={dictation.clearError}
        />
      )}
      <p className="mt-1.5 text-center text-[11px] text-faint">{labels.note}</p>
    </div>
  );
}
