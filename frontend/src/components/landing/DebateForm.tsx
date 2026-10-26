"use client";

import { useState, type FormEvent, type ReactNode, type RefObject } from "react";
import type { Language } from "@/config/languages";
import { usePreferredLanguage } from "@/hooks/useLanguages";
import { useOnline } from "@/hooks/useOnline";
import { LanguagePicker } from "../chat/setup/LanguagePicker";
import { TOPIC_MAX, TOPIC_MIN } from "@/lib/api";
import { ErrorBanner } from "../ErrorBanner";
import { WatchDemoButton } from "../replay/DemoNotice";
import { TypingIndicator } from "../TypingIndicator";
import { useDictateInto } from "../voice/useDictateInto";
import { RoundsSelector } from "./RoundsSelector";
import { SampleTopics } from "./SampleTopics";

interface DebateFormProps {
  running: boolean;
  /** An error to show under the form (e.g. rate limit or server unreachable). */
  error: string | null;
  /** Shown instead of the error: the demo replay offer, or "waking up the server". */
  notice?: ReactNode;
  onStart: (topic: string, rounds: number, language: Language) => void;
  /** Starts the demo replay; leave out when there's no recording. */
  onWatchDemo?: () => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  /** Topic to start with, e.g. from "Try this example". */
  initialTopic?: string;
}

/** Topic input with a character counter, sample topics, rounds selector, Start and "Watch a demo" buttons. */
export function DebateForm({ running, error, notice, onStart, onWatchDemo, inputRef, initialTopic = "" }: DebateFormProps) {
  const [topic, setTopic] = useState(initialTopic);
  const [rounds, setRounds] = useState(2);
  const online = useOnline();
  // The language picked last time, until one is picked here.
  const preferred = usePreferredLanguage();
  const [picked, setLanguage] = useState<Language | null>(null);
  const language = picked ?? preferred;
  const [inputError, setInputError] = useState<string | null>(null);
  const mic = useDictateInto({
    value: topic,
    language,
    max: TOPIC_MAX,
    onChange: (t) => {
      setTopic(t);
      setInputError(null);
    },
  });

  const length = topic.trim().length;
  const nearLimit = topic.length > TOPIC_MAX - 20;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (running || !online) return;
    const clean = topic.trim();
    if (clean.length < TOPIC_MIN) {
      setInputError(`Give the debaters a bit more to work with: at least ${TOPIC_MIN} characters.`);
      inputRef.current?.focus();
      return;
    }
    if (clean.length > TOPIC_MAX) {
      setInputError(`Keep the topic under ${TOPIC_MAX} characters.`);
      return;
    }
    setInputError(null);
    onStart(clean, rounds, language);
  }

  return (
    <form
      id="debate-form"
      onSubmit={handleSubmit}
      noValidate
      className="animate-fade-up mx-auto mt-12 max-w-3xl scroll-mt-24 rounded-3xl border border-line bg-surface p-4 shadow-lift [animation-delay:120ms] sm:p-6"
    >
      <label htmlFor="topic" className="mb-2 block font-display text-lg font-semibold">
        What should they debate?
      </label>
      <div className="relative">
        <textarea
          id="topic"
          ref={inputRef}
          rows={2}
          value={topic}
          maxLength={TOPIC_MAX}
          disabled={running}
          placeholder="e.g. Pineapple belongs on pizza"
          aria-invalid={inputError ? true : undefined}
          aria-describedby="topic-counter topic-error"
          onChange={(e) => {
            setTopic(e.target.value);
            if (inputError) setInputError(null);
          }}
          onKeyDown={(e) => {
            // Enter starts the debate; Shift+Enter still adds a new line.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          className={`block w-full resize-none rounded-2xl border bg-canvas px-4 pt-3 pb-8 text-base text-ink placeholder:text-faint transition focus:outline-none disabled:opacity-60 sm:text-lg ${
            mic.button ? "pr-14" : ""
          } ${
            inputError ? "border-con/60 focus:ring-2 focus:ring-con/30" : "border-line-strong focus:border-judge-deep/60 focus:ring-2 focus:ring-judge/40"
          }`}
        />
        <span
          id="topic-counter"
          className={`pointer-events-none absolute right-3 bottom-2.5 font-mono text-xs ${
            nearLimit ? "text-judge-deep" : length > 0 && length < TOPIC_MIN ? "text-con-deep" : "text-faint"
          }`}
        >
          {topic.length}/{TOPIC_MAX}
        </span>
        {mic.button && !running && <div className="absolute top-2 right-2">{mic.button}</div>}
      </div>
      {mic.options}
      <p id="topic-error" role="alert" className="min-h-5 pt-1.5 text-sm text-con-deep">
        {inputError}
      </p>

      <div className="mt-2">
        <SampleTopics
          disabled={running}
          onPick={(t) => {
            setTopic(t);
            setInputError(null);
          }}
        />
      </div>

      <div className="mt-6">
        <LanguagePicker value={language} onChange={setLanguage} name="debate-language" />
      </div>

      <div className="mt-6 flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <RoundsSelector value={rounds} onChange={setRounds} disabled={running} />
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          {onWatchDemo && <WatchDemoButton onClick={onWatchDemo} />}
          <button
            type="submit"
            disabled={running || !online}
            className="group relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-xl border border-judge-deep/30 bg-judge px-7 font-display text-base font-semibold text-ink shadow-[0_10px_24px_-12px_var(--color-judge-deep)] transition hover:bg-[color-mix(in_srgb,var(--color-judge)_85%,var(--color-judge-deep))] focus-visible:ring-2 focus-visible:ring-judge-deep focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none active:scale-[0.98] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-sand-deep disabled:text-muted disabled:shadow-none"
          >
            {running ? (
              <>
                Debate in progress <TypingIndicator label="Debate in progress" />
              </>
            ) : (
              <>Start Debate</>
            )}
          </button>
        </div>
      </div>

      {!online && (
        <p role="status" className="mt-4 text-sm font-medium text-con-deep">
          You&apos;re offline. Rooms need the internet, but the demo works offline.
        </p>
      )}
      {notice ? (
        <div className="mt-5">{notice}</div>
      ) : (
        error && (
          <div className="mt-5">
            <ErrorBanner message={error} />
          </div>
        )
      )}
    </form>
  );
}
