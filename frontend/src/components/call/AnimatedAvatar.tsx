"use client";

import { useEffect, useId, useRef } from "react";
import type { AvatarLook } from "@/config/personas";
import type { Emotion } from "@/lib/chatTypes";
import { onFrame, reducedMotion } from "@/lib/call/frameLoop";
import { mouthTarget } from "@/lib/voice/lipSync";
import { BLUSH, Figure, INK, type Mood } from "../chat/Avatar";

/**
 * The illustrated avatar, alive: the same artwork as components/chat/Avatar.tsx
 * with a face whose parts move on their own.
 *   - eyes blink at random, natural intervals (sometimes twice);
 *   - brows and the resting mouth follow the expression;
 *   - the mouth opens with the voice (lib/voice/lipSync.ts) and morphs between
 *     closed, slightly open, open, wide and round "O";
 *   - the head sways gently, nods now and then while listening, and glances up
 *     while thinking.
 * Every frame writes SVG attributes through refs (no React re-renders), from one
 * shared loop that pauses in hidden tabs. With reduced motion: no sway or nods,
 * and the mouth simply fades between open and closed.
 */

export type AvatarState = "idle" | "thinking" | "speaking" | "reacting";

interface ExpressionShape {
  brows: string;
  /** The closed mouth (a curve), drawn when not talking. */
  mouth: string;
  blush: boolean;
  /** Bigger eyes when excited. */
  eye: number;
}

// Brows over eyes at y=30.2; mouth around y=36. Same coordinates as the static faces.
const EXPRESSIONS: Record<Emotion, ExpressionShape> = {
  neutral: { brows: "M24.8 26q2.2-.8 4.4 0M34.8 26q2.2-.8 4.4 0", mouth: "M29 36q3 1.8 6 0", blush: true, eye: 1.7 },
  happy: { brows: "M24.8 26q2.2-1 4.4-.2M34.8 25.8q2.2-.8 4.4.2", mouth: "M28 35.6q4 3.6 8 0", blush: true, eye: 1.7 },
  excited: { brows: "M24.8 24.8q2.2-1.4 4.4-.4M34.8 24.4q2.2-1 4.4.4", mouth: "M27.4 35.2q4.6 5 9.2 0", blush: true, eye: 1.95 },
  thoughtful: { brows: "M24.8 26.4q2.2-1.6 4.4-1M34.8 24.6l4.4 1.2", mouth: "M29.4 36.6q2.6-.9 5.2.2", blush: false, eye: 1.6 },
  annoyed: { brows: "m24.8 25 4.6 1.6M34.6 26.6l4.6-1.6", mouth: "M29 37h6", blush: false, eye: 1.6 },
  concerned: { brows: "M24.8 26.4l4.4-1.4M34.8 25l4.4 1.4", mouth: "M28.6 37.6q3.4-2 6.8 0", blush: false, eye: 1.7 },
};

/** The persona's own resting look (from their avatar's mood), used when no emotion is given. */
const MOOD_EXPRESSION: Record<Mood, Emotion> = {
  smile: "happy",
  grin: "happy",
  laugh: "excited",
  smirk: "neutral",
  flat: "neutral",
  frown: "annoyed",
  calm: "neutral",
  confused: "thoughtful",
};

export function AnimatedAvatar({
  id,
  look,
  color,
  state,
  expression,
  className = "",
  label,
}: {
  /** The persona id the voice uses: its mouth moves when this persona is the one speaking. */
  id: string;
  look: AvatarLook;
  color: string;
  state: AvatarState;
  /** While speaking: the message's emotion. Otherwise the persona's own resting look. */
  expression?: Emotion;
  className?: string;
  label?: string;
}) {
  const clipId = useId();
  const figure = useRef<SVGGElement>(null);
  const eyes = useRef<SVGGElement>(null);
  const mouthOpen = useRef<SVGEllipseElement>(null);
  const mouthClosed = useRef<SVGPathElement>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const mood = (look.mood ?? "smile") as Mood;
  const shape = EXPRESSIONS[expression ?? (state === "reacting" ? "excited" : MOOD_EXPRESSION[mood])];

  useEffect(() => {
    const seed = Math.random() * 10; // so a room of avatars doesn't sway in step
    let nextBlink = performance.now() + 800 + Math.random() * 3000;
    let blinkAt = -1;
    let nextNod = performance.now() + 3000 + Math.random() * 4000;
    let nodAt = -1;
    const mouth = { open: 0, round: 0 };
    let last = { figure: "", eyes: "", rx: -1, ry: -1, closed: -1 };

    return onFrame((now) => {
      const reduced = reducedMotion();
      const current = stateRef.current;

      // Blink: 140 ms, every 2-6 s, sometimes a quick double blink.
      if (now >= nextBlink) {
        blinkAt = now;
        nextBlink = now + (Math.random() < 0.2 ? 260 : 2000 + Math.random() * 4000);
      }
      const p = blinkAt < 0 ? 1 : (now - blinkAt) / 140;
      const lid = p < 1 ? 1 - Math.sin(Math.PI * p) * 0.92 : 1;
      const eyeTransform = `translate(0 30.2) scale(1 ${lid.toFixed(2)}) translate(0 -30.2)`;
      if (eyeTransform !== last.eyes) eyes.current?.setAttribute("transform", (last.eyes = eyeTransform));

      // Head: gentle sway; occasional nods while listening; a bit livelier while speaking.
      let figureTransform = "";
      if (!reduced) {
        const t = now / 1000 + seed;
        const speaking = current === "speaking";
        const angle = Math.sin(t * (speaking ? 1.6 : 0.8)) * (speaking ? 2 : 1.2);
        let dip = 0;
        if (current === "idle" && now >= nextNod) {
          nodAt = now;
          nextNod = now + 4000 + Math.random() * 6000;
        }
        if (nodAt >= 0 && now - nodAt < 700) dip = Math.sin(((now - nodAt) / 700) * Math.PI * 2) ** 2 * 1.4;
        const lift = current === "thinking" ? -0.8 : 0;
        figureTransform = `rotate(${angle.toFixed(2)} 32 60) translate(0 ${(dip + lift).toFixed(2)})`;
      }
      if (figureTransform !== last.figure) figure.current?.setAttribute("transform", (last.figure = figureTransform));

      // Mouth: follow the voice with light smoothing; snap shut the moment speech stops.
      const target = mouthTarget(id, now);
      if (target.open === 0 && current !== "speaking") mouth.open = 0;
      else mouth.open += (target.open - mouth.open) * 0.45;
      mouth.round += (target.round - mouth.round) * 0.3;
      const open = reduced ? (target.open > 0.25 ? 1 : 0) : mouth.open;
      const rx = reduced ? 3.2 : 4.2 - mouth.round * 1.9 - (1 - open) * 0.8; // wide -> round "O"
      const ry = reduced ? 2.4 : 0.35 + open * (2.6 + mouth.round * 0.8);
      const shown = open > 0.06 ? 1 : 0;
      if (Math.abs(rx - last.rx) > 0.02 || Math.abs(ry - last.ry) > 0.02 || shown !== last.closed) {
        const el = mouthOpen.current;
        if (el) {
          el.setAttribute("rx", rx.toFixed(2));
          el.setAttribute("ry", ry.toFixed(2));
          el.style.opacity = String(shown);
        }
        if (mouthClosed.current) mouthClosed.current.style.opacity = String(1 - shown);
        last = { ...last, rx, ry, closed: shown };
      }
    });
  }, [id]);

  const thinking = state === "thinking";
  const face = (_mood: Mood, brow: string) => (
    <>
      {shape.blush && (
        <g fill={BLUSH} fillOpacity={0.3}>
          <circle cx="24.4" cy="34.4" r="2.2" />
          <circle cx="39.6" cy="34.4" r="2.2" />
        </g>
      )}
      {/* Brows lift while thinking; their shape follows the expression. */}
      <path
        d={shape.brows}
        fill="none"
        stroke={brow}
        strokeWidth="1.5"
        strokeLinecap="round"
        className="transition-transform duration-300"
        style={{ transform: thinking ? "translateY(-1px)" : undefined }}
      />
      <g ref={eyes}>
        {/* Pupils glance up and aside while thinking. */}
        <g className="transition-transform duration-300" style={{ transform: thinking ? "translate(0.8px, -1.2px)" : undefined }}>
          <circle cx="27" cy="30.2" r={shape.eye} fill={INK} />
          <circle cx="37" cy="30.2" r={shape.eye} fill={INK} />
          <circle cx="27.6" cy="29.6" r="0.5" fill="#FFFFFF" />
          <circle cx="37.6" cy="29.6" r="0.5" fill="#FFFFFF" />
        </g>
      </g>
      <path ref={mouthClosed} d={shape.mouth} fill="none" stroke={INK} strokeWidth="1.7" strokeLinecap="round" className="transition-opacity duration-100" />
      <ellipse ref={mouthOpen} cx="32" cy="36.4" rx="3" ry="0.4" fill={INK} style={{ opacity: 0 }} className="transition-opacity duration-100" />
    </>
  );

  return (
    <svg viewBox="0 0 64 64" className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <clipPath id={clipId}>
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="64" height="64" fill="#FFFFFF" />
        <rect width="64" height="64" fill={color} fillOpacity={0.15} />
        <g ref={figure}>
          <Figure look={look} color={color} face={face} />
        </g>
      </g>
      <circle cx="32" cy="32" r="31" fill="none" stroke={color} strokeOpacity={0.45} strokeWidth="2" />
    </svg>
  );
}
