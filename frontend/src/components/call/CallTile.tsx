"use client";

import type { AvatarLook } from "@/config/personas";
import type { Emotion } from "@/lib/chatTypes";
import { TypingIndicator } from "../TypingIndicator";
import { AnimatedAvatar, type AvatarState } from "./AnimatedAvatar";

export interface TileReaction {
  key: string;
  emoji: string;
}

export interface TilePersona {
  id: string;
  /** The name shown (the user's chosen name). */
  name: string;
  color: string;
  look: AvatarLook;
  guest?: boolean;
  /** A small caption under the name, e.g. "Pro" or "Interviewer". */
  role?: string;
}

const STATE_LABEL: Record<AvatarState, string> = { idle: "listening", thinking: "thinking", speaking: "speaking", reacting: "reacting" };

/** Sizes: spotlight (the big phone tile), tile (desktop), strip (the phone's row of small tiles). */
const SIZES = {
  spotlight: { box: "w-full max-w-xs p-5", avatar: "size-40 sm:size-48", name: "text-base" },
  tile: { box: "w-36 p-3 lg:w-44", avatar: "size-24 lg:size-32", name: "text-sm" },
  strip: { box: "w-24 p-2", avatar: "size-14", name: "text-xs" },
};

/**
 * One persona in the call: their animated avatar, name (and a Guest badge), and their state.
 * Speaking: a glowing ring in their colour, a slight scale-up and an equaliser.
 * Thinking: three dots. Reactions float up from the tile.
 */
export function CallTile({
  persona,
  state,
  expression,
  reactions,
  size = "tile",
}: {
  persona: TilePersona;
  state: AvatarState;
  expression?: Emotion;
  reactions: TileReaction[];
  size?: keyof typeof SIZES;
}) {
  const s = SIZES[size];
  const speaking = state === "speaking";
  return (
    <div
      role="group"
      aria-label={`${persona.name}${persona.guest ? " (guest)" : ""}, ${STATE_LABEL[state]}`}
      className={`relative flex shrink-0 flex-col items-center rounded-3xl border bg-surface/85 shadow-soft backdrop-blur transition-transform duration-300 motion-reduce:transition-none ${s.box} ${
        speaking ? "z-10 scale-[1.04] border-transparent" : "border-line"
      }`}
      style={speaking ? { boxShadow: `0 0 0 3px ${persona.color}, 0 0 28px -4px ${persona.color}` } : undefined}
    >
      <div className="relative">
        <AnimatedAvatar id={persona.id} look={persona.look} color={persona.color} state={state} expression={expression} className={`rounded-full ${s.avatar}`} />
        {state === "thinking" && (
          <span className="absolute -top-1 -right-2 rounded-full border border-line bg-surface px-2 py-1 shadow-soft">
            <TypingIndicator label={`${persona.name} is thinking`} />
          </span>
        )}
        {speaking && (
          <span aria-hidden className="equaliser absolute -top-1 -right-1 flex h-5 items-end gap-0.5 rounded-full bg-surface px-1.5 py-1 shadow-soft" style={{ color: persona.color }}>
            <span className="h-full" />
            <span className="h-full" />
            <span className="h-full" />
          </span>
        )}
        {/* Reactions float up from the avatar (they just appear and fade with reduced motion). */}
        {reactions.map((r) => (
          <span key={r.key} aria-hidden className="animate-reaction-up pointer-events-none absolute inset-x-0 top-1/3 text-center text-3xl motion-reduce:animate-none">
            {r.emoji}
          </span>
        ))}
      </div>
      <p className={`mt-2 flex max-w-full items-center gap-1.5 truncate font-semibold ${s.name}`} style={{ color: persona.color }}>
        <span className="truncate">{persona.name}</span>
        {persona.guest && (
          <span className="shrink-0 rounded-full border border-line-strong bg-sand px-1.5 py-px text-[10px] font-semibold tracking-wide text-muted uppercase">Guest</span>
        )}
      </p>
      {persona.role && size !== "strip" && <p className="truncate text-[11px] text-muted">{persona.role}</p>}
    </div>
  );
}
