"use client";

import { useState } from "react";
import { markVoiceNoteSeen, setHandsFree, useHandsFree, voiceNoteSeen } from "@/hooks/useVoice";
import { RECOGNITION_LANGUAGES, type RecognitionLanguage } from "@/lib/voice/recognitionLanguages";
import { CloseIcon, MicIcon } from "../icons";

/** The mic: tap to talk, tap again to stop. Pulses while listening, with a ring that follows your voice. */
export function MicButton({ listening, level, onClick, className = "size-11" }: { listening: boolean; level: number; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={listening}
      aria-label={listening ? "Stop voice input" : "Speak instead of typing"}
      title={listening ? "Stop" : "Voice input"}
      className={`relative grid shrink-0 place-items-center rounded-full border transition focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none active:scale-95 ${className} ${
        listening ? "border-con bg-con text-white" : "border-line-strong bg-surface text-muted hover:bg-sand hover:text-ink"
      }`}
    >
      {listening && (
        <>
          <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-con/30 motion-reduce:hidden" />
          {/* Sound level: a ring that grows with the volume. */}
          <span
            aria-hidden
            className="absolute -inset-1 rounded-full border-2 border-con/50 transition-transform duration-75"
            style={{ transform: `scale(${1 + level * 0.35})` }}
          />
        </>
      )}
      <MicIcon className="relative size-5" />
    </button>
  );
}

/**
 * Under the box while voice input is in use: recognition language, hands-free,
 * what's happening, errors, and (once) where the audio goes.
 */
export function VoiceInputOptions({
  lang,
  onLang,
  listening,
  error,
  onClearError,
  showHandsFree = true,
}: {
  lang: RecognitionLanguage;
  onLang: (lang: RecognitionLanguage) => void;
  listening: boolean;
  error: string | null;
  onClearError: () => void;
  /** Hands-free sends a finished voice message by itself; not for topic boxes. */
  showHandsFree?: boolean;
}) {
  const handsFree = useHandsFree();
  const [noteSeen, setNoteSeen] = useState(voiceNoteSeen);

  return (
    <div className="mt-1.5 space-y-1.5 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <label className="inline-flex items-center gap-1.5 text-muted">
          Speaking
          <select
            value={lang}
            onChange={(e) => onLang(e.target.value as RecognitionLanguage)}
            className="h-7 rounded-lg border border-line-strong bg-surface px-1.5 text-xs font-semibold text-ink focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
          >
            {RECOGNITION_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        {showHandsFree && (
          <label className="inline-flex items-center gap-1.5 text-muted" title="Send each voice message as soon as you stop talking">
            <input type="checkbox" checked={handsFree} onChange={(e) => setHandsFree(e.target.checked)} className="size-3.5 accent-primary" />
            Hands-free
          </label>
        )}
        <span aria-live="polite" className={listening ? "font-semibold text-con-deep" : "text-faint"}>
          {listening ? "Listening… stops when you pause" : handsFree && showHandsFree ? "Sends when you stop talking" : "Edit the text, then send"}
        </span>
      </div>
      {error && (
        <p role="alert" className="flex items-start gap-1.5 rounded-lg border border-con/30 bg-con-soft px-2 py-1.5 text-ink">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={onClearError} aria-label="Dismiss" className="text-muted hover:text-ink">
            <CloseIcon className="size-3.5" />
          </button>
        </p>
      )}
      {!noteSeen && (
        <p className="flex items-start gap-1.5 rounded-lg bg-sand px-2 py-1.5 text-muted">
          <span className="flex-1">Voice input uses your browser&apos;s speech service (in Chrome, audio is processed by Google).</span>
          <button
            type="button"
            onClick={() => {
              markVoiceNoteSeen();
              setNoteSeen(true);
            }}
            aria-label="Got it"
            className="text-muted hover:text-ink"
          >
            <CloseIcon className="size-3.5" />
          </button>
        </p>
      )}
    </div>
  );
}
