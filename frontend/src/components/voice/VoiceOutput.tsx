"use client";

import { type ReactNode } from "react";
import { useVoice } from "@/hooks/useVoice";
import { SPEEDS, voice, type SpeakRequest } from "@/lib/voice/player";
import { sentenceAround } from "@/lib/voice/speechText";
import { CaptionsIcon, PlayIcon, SkipIcon, SpeakerIcon, SpeakerOffIcon, StopIcon } from "../icons";

/**
 * Voice output UI, shared by the rooms, the Debate Arena and replays (and the coming call mode):
 * the header toggle, a per-message play button, karaoke text and the captions bar.
 */

const iconButton =
  "grid size-8 shrink-0 place-items-center rounded-lg transition focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none";

/** Header toggles, styled like the "Behind the scenes" button. */
const toggleButton = (on: boolean) =>
  `grid size-9 shrink-0 place-items-center rounded-lg border transition focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none ${
    on ? "border-primary/40 bg-primary-soft text-primary-deep" : "border-line-strong bg-surface text-muted hover:text-ink"
  }`;

/** "Read replies aloud" (off by default), plus a captions switch while it's on. */
export function VoiceToggle() {
  const { enabled, captions, supported } = useVoice();
  if (!supported) return null;
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => voice.setEnabled(!enabled)}
        aria-pressed={enabled}
        aria-label="Read replies aloud"
        title={enabled ? "Reading replies aloud" : "Read replies aloud"}
        className={toggleButton(enabled)}
      >
        {enabled ? <SpeakerIcon className="size-4" /> : <SpeakerOffIcon className="size-4" />}
      </button>
      {enabled && (
        <button
          type="button"
          onClick={() => voice.setCaptions(!captions)}
          aria-pressed={captions}
          aria-label="Live captions"
          title="Live captions"
          className={toggleButton(captions)}
        >
          <CaptionsIcon className="size-4" />
        </button>
      )}
    </div>
  );
}

/** Hear just this message (works whether or not "Read replies aloud" is on). */
export function PlayButton({ request, className = "" }: { request: SpeakRequest; className?: string }) {
  const { speaking, supported } = useVoice();
  if (!supported) return null;
  const playing = speaking?.key === request.key;
  return (
    <button
      type="button"
      onClick={() => (playing ? voice.stop() : voice.playNow(request))}
      aria-label={playing ? "Stop reading" : `Read ${request.speakerName}'s message aloud`}
      title={playing ? "Stop" : "Read aloud"}
      className={`inline-grid size-6 place-items-center rounded-full text-faint transition hover:bg-sand hover:text-ink focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none ${className}`}
    >
      {playing ? <StopIcon className="size-3" /> : <PlayIcon className="size-3" />}
    </button>
  );
}

/**
 * A message's text; while it's being read with captions on, the current word is highlighted.
 * `children` is the normal rendering (e.g. with coloured @mentions), used the rest of the time.
 */
export function SpokenText({ messageKey, children }: { messageKey: string; children: ReactNode }) {
  const { speaking, captions } = useVoice();
  if (!captions || speaking?.key !== messageKey) return <>{children}</>;
  const { speech, word } = speaking;
  const current = speech.tokenOfWord[word];
  return (
    <>
      {speech.tokens.map((token, i) =>
        i === current ? (
          <span key={i} className="spoken-word">
            {token}
          </span>
        ) : (
          token
        ),
      )}
    </>
  );
}

/**
 * Fixed under the conversation while something is read aloud: who's talking, the current
 * line (captions on), speed, skip and stop. `avatar` draws the speaker's avatar.
 */
export function CaptionsBar({ avatar, className = "" }: { avatar?: (speakerId: string) => ReactNode; className?: string }) {
  const { speaking, captions, speed, queued } = useVoice();
  if (!speaking) return null;
  const { speech, word } = speaking;
  const [first, last] = sentenceAround(speech, word);
  const nextSpeed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];

  return (
    <div role="region" aria-label="Now reading aloud" className={`animate-fade-in flex items-center gap-2.5 border-t border-line bg-surface/95 px-3 py-2 backdrop-blur ${className}`}>
      {avatar?.(speaking.speakerId)}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-ink">
          {speaking.speakerName}
          {queued > 0 && <span className="ml-1.5 font-normal text-faint">+{queued} next</span>}
        </p>
        {captions && (
          // Captions are visual only: screen readers already read the message itself.
          <p aria-hidden className="line-clamp-2 text-sm leading-snug text-muted">
            {speech.words.slice(first, last + 1).map((w, i) => (
              <span key={first + i} className={first + i === word ? "spoken-word text-ink" : ""}>
                {w}{" "}
              </span>
            ))}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => voice.setSpeed(nextSpeed)}
        aria-label={`Speed ${speed}x, change to ${nextSpeed}x`}
        title="Speed (applies from the next message)"
        className="h-8 shrink-0 rounded-lg border border-line-strong px-2 font-mono text-xs font-semibold text-ink transition hover:bg-sand focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
      >
        {speed}x
      </button>
      <button type="button" onClick={() => voice.skip()} aria-label="Skip this message" title="Skip" className={`${iconButton} text-muted hover:bg-sand hover:text-ink`}>
        <SkipIcon className="size-4" />
      </button>
      <button type="button" onClick={() => voice.stop()} aria-label="Stop reading aloud" title="Stop" className={`${iconButton} text-muted hover:bg-sand hover:text-ink`}>
        <StopIcon className="size-4" />
      </button>
    </div>
  );
}
