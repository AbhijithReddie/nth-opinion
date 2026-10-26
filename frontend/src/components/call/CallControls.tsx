"use client";

import { useRef, useState, type ReactNode } from "react";
import { useVoice } from "@/hooks/useVoice";
import { SPEEDS, voice } from "@/lib/voice/player";
import { CameraIcon, CaptionsIcon, ChatBubbleIcon, EyeIcon, HandsFreeIcon, MicIcon, PhoneOffIcon, SpeakerIcon, SpeakerOffIcon } from "../icons";
import { CAMERA_NOTE } from "./YouTile";

const round = "relative grid size-11 shrink-0 place-items-center rounded-full border transition focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none active:scale-95";
const look = (on: boolean) => (on ? "border-primary/40 bg-primary-soft text-primary-deep" : "border-line-strong bg-surface text-muted hover:bg-sand hover:text-ink");

/** One round control with a label for screen readers and a tooltip (with its shortcut). */
function Control({ label, tip, on, onClick, children, extra }: { label: string; tip?: string; on: boolean; onClick: () => void; children: ReactNode; extra?: object }) {
  return (
    <button type="button" aria-label={label} aria-pressed={on} title={tip ?? label} onClick={onClick} className={`${round} ${look(on)}`} {...extra}>
      {children}
    </button>
  );
}

export interface MicControl {
  listening: boolean;
  start: () => void;
  stop: () => void;
}

/**
 * The bottom bar, like a video call: mic (tap to toggle, or hold to talk), hands-free,
 * captions, sound (read aloud, volume, speed), camera, behind the scenes, switch view
 * and End call. Shortcuts: M for the mic, C for captions (handled by the call view).
 */
export function CallControls({
  mic,
  handsFree,
  camera,
  behindTheScenes,
  switchLabel,
  onSwitch,
  onEnd,
  extra,
}: {
  /** Leave out where there's no voice input (unsupported browser, replays, the debate). */
  mic?: MicControl;
  handsFree?: { on: boolean; onChange: (on: boolean) => void };
  camera?: { on: boolean; onToggle: () => void };
  behindTheScenes: { on: boolean; onToggle: () => void };
  switchLabel: string;
  onSwitch: () => void;
  onEnd: () => void;
  /** e.g. the room's summary button. */
  extra?: ReactNode;
}) {
  const { enabled, captions, speed, volume } = useVoice();
  const [soundOpen, setSoundOpen] = useState(false);
  // Hold to talk: a press longer than this stops listening on release; a tap toggles.
  const press = useRef<{ at: number; wasListening: boolean } | null>(null);

  return (
    <div role="toolbar" aria-label="Call controls" className="relative flex flex-wrap items-center justify-center gap-2 border-t border-line bg-surface/95 px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
      {mic && (
        <button
          type="button"
          aria-label={mic.listening ? "Stop talking" : "Talk"}
          aria-pressed={mic.listening}
          title="Mic: tap to talk, or hold (M)"
          onPointerDown={() => {
            press.current = { at: performance.now(), wasListening: mic.listening };
            if (!mic.listening) mic.start();
          }}
          onPointerUp={() => {
            const p = press.current;
            press.current = null;
            if (p && (p.wasListening || performance.now() - p.at > 450)) mic.stop();
          }}
          onClick={(e) => {
            if (e.detail === 0) (mic.listening ? mic.stop : mic.start)(); // keyboard (Enter/Space)
          }}
          className={`${round.replace("size-11", "size-13")} ${mic.listening ? "border-con bg-con text-white" : look(false)}`}
        >
          {mic.listening && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-con/30 motion-reduce:hidden" />}
          <MicIcon className="relative size-5" />
        </button>
      )}
      {handsFree && (
        <Control label="Hands-free" tip="Hands-free: sends when you stop talking, then listens again" on={handsFree.on} onClick={() => handsFree.onChange(!handsFree.on)}>
          <HandsFreeIcon className="size-5" />
        </Control>
      )}
      <Control label="Captions" tip="Captions (C)" on={captions} onClick={() => voice.setCaptions(!captions)}>
        <CaptionsIcon className="size-5" />
      </Control>

      <div className="relative">
        <Control label="Sound" tip="Read aloud, volume and speed" on={enabled} onClick={() => setSoundOpen((o) => !o)} extra={{ "aria-expanded": soundOpen }}>
          {enabled ? <SpeakerIcon className="size-5" /> : <SpeakerOffIcon className="size-5" />}
        </Control>
        {soundOpen && (
          <div role="dialog" aria-label="Sound" className="animate-fade-in absolute bottom-14 left-1/2 z-30 w-60 -translate-x-1/2 space-y-3 rounded-2xl border border-line bg-surface p-3 text-sm shadow-lift">
            <label className="flex items-center justify-between gap-2 font-semibold">
              Read replies aloud
              <input type="checkbox" checked={enabled} onChange={(e) => voice.setEnabled(e.target.checked)} className="size-4 accent-primary" />
            </label>
            <label className="block">
              <span className="text-xs text-muted">Volume</span>
              <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => voice.setVolume(Number(e.target.value))} className="w-full accent-primary" />
            </label>
            <div>
              <span className="text-xs text-muted">Speed</span>
              <div className="mt-1 flex gap-1" role="group" aria-label="Speed">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={speed === s}
                    onClick={() => voice.setSpeed(s)}
                    className={`h-8 flex-1 rounded-lg border font-mono text-xs font-semibold ${speed === s ? "border-primary/40 bg-primary-soft text-primary-deep" : "border-line-strong text-ink hover:bg-sand"}`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {camera && (
        <Control label="Camera self-view" tip={`Camera self-view. ${CAMERA_NOTE}`} on={camera.on} onClick={camera.onToggle}>
          <CameraIcon className="size-5" />
        </Control>
      )}
      <Control label="Behind the scenes" tip="Behind the scenes: what the agents are doing" on={behindTheScenes.on} onClick={behindTheScenes.onToggle}>
        <EyeIcon className="size-5" />
      </Control>
      {extra}
      <button
        type="button"
        onClick={onSwitch}
        title={switchLabel}
        className="inline-flex h-11 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-sm font-semibold text-ink transition hover:bg-sand focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
      >
        <ChatBubbleIcon className="size-4" />
        <span className="hidden sm:inline">{switchLabel}</span>
        <span className="sr-only sm:hidden">{switchLabel}</span>
      </button>
      <button
        type="button"
        onClick={onEnd}
        aria-label="End call"
        title="End call"
        className="inline-flex h-11 items-center gap-1.5 rounded-full bg-con-deep px-4 text-sm font-semibold text-white transition hover:bg-ink focus-visible:ring-2 focus-visible:ring-con/60 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-95"
      >
        <PhoneOffIcon className="size-5" />
        <span className="hidden sm:inline">End</span>
      </button>
    </div>
  );
}
