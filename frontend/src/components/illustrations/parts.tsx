import type { ReactNode } from "react";

/**
 * Building blocks for Nth Opinion's illustrations: one flat, hand-drawn style
 * with soft ink outlines and the Chai & Sage palette. Colours come from the
 * theme as Tailwind `fill-*` / `stroke-*` classes, so they follow the tokens in globals.css.
 */

/** The SVG frame every illustration uses: labelled for screen readers, ink outlines, scales to its container. */
export function Art({
  label,
  viewBox = "0 0 320 220",
  className = "",
  children,
}: {
  label: string;
  viewBox?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg viewBox={viewBox} role="img" aria-label={label} className={`h-auto w-full ${className}`}>
      <g className="stroke-ink" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {children}
      </g>
    </svg>
  );
}

/** A soft background blob. */
export function Blob({ d, className }: { d: string; className: string }) {
  return <path d={d} className={className} stroke="none" />;
}

/** A speech bubble with a tail. The tail sits under the left, centre or right of the bubble. */
export function Bubble({
  x,
  y,
  w,
  h,
  tail = "left",
  fill = "fill-surface",
  float,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  tail?: "left" | "center" | "right";
  fill?: string;
  /** Delay (s) for a gentle bobbing animation; omit for a still bubble. */
  float?: number;
  children?: ReactNode;
}) {
  const tx = tail === "left" ? x + 18 : tail === "right" ? x + w - 18 : x + w / 2;
  const lean = tail === "left" ? -4 : tail === "right" ? 4 : 0;
  return (
    <g className={float !== undefined ? "animate-float" : undefined} style={float !== undefined ? { animationDelay: `${float}s` } : undefined}>
      <rect x={x} y={y} width={w} height={h} rx={Math.min(13, h / 2)} className={fill} />
      <path d={`M${tx - 7} ${y + h - 2}L${tx + lean} ${y + h + 10}L${tx + 7} ${y + h - 2}`} className={fill} />
      {children}
    </g>
  );
}

/** A four-point sparkle doodle centred on (x, y). */
export function Sparkle({ x, y, r = 8, className = "fill-butter" }: { x: number; y: number; r?: number; className?: string }) {
  const k = r * 0.28;
  return (
    <path
      d={`M${x} ${y - r}L${x + k} ${y - k}L${x + r} ${y}L${x + k} ${y + k}L${x} ${y + r}L${x - k} ${y + k}L${x - r} ${y}L${x - k} ${y - k}Z`}
      className={className}
      strokeWidth={1.6}
    />
  );
}

/** A small heart centred on (x, y). */
export function Heart({ x, y, s = 1, className = "fill-terracotta" }: { x: number; y: number; s?: number; className?: string }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 -2C-5-9-13-5-10 2-8 6-3 9 0 12 3 9 8 6 10 2 13-5 5-9 0-2Z"
      className={className}
      strokeWidth={2}
    />
  );
}

/** Three little dots, like someone typing. */
export function Dots({ x, y, className = "fill-ink" }: { x: number; y: number; className?: string }) {
  return (
    <g className={className} stroke="none">
      <circle cx={x - 9} cy={y} r={3} />
      <circle cx={x} cy={y} r={3} />
      <circle cx={x + 9} cy={y} r={3} />
    </g>
  );
}

/** Short text lines inside a bubble or on a page. */
export function Lines({ x, y, widths, gap = 8, className = "stroke-ink" }: { x: number; y: number; widths: number[]; gap?: number; className?: string }) {
  return (
    <path d={widths.map((w, i) => `M${x} ${y + i * gap}h${w}`).join("")} className={className} strokeWidth={2.2} opacity={0.55} />
  );
}

type Mood = "smile" | "grin" | "frown" | "calm";

/**
 * A friendly AI character: rounded head with an antenna, a screen face and a body.
 * (x, y) is the top centre of its head; the body runs long so a table can hide it.
 */
export function Bot({
  x,
  y,
  s = 1,
  body,
  screen,
  mood = "smile",
}: {
  x: number;
  y: number;
  s?: number;
  body: string;
  screen: string;
  mood?: Mood;
}) {
  const mouth = {
    smile: "M-6 21q6 5 12 0",
    grin: "M-7 20q7 8 14 0Z",
    frown: "M-6 24q6-5 12 0",
    calm: "M-5 22q5 3 10 0",
  }[mood];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-22 125V62c0-13 9-22 22-22s22 9 22 22v63Z" className={body} />
      <path d="M-5 40h10v-6H-5Z" className="fill-line-strong" />
      <path d="M0 0v-10" />
      <circle cx="0" cy="-13" r="4.5" className={body} />
      <rect x="-21" y="0" width="42" height="35" rx="12" className="fill-surface" />
      <rect x="-14" y="7" width="28" height="21" rx="7" className={screen} stroke="none" />
      <g className="fill-ink" stroke="none">
        {mood === "calm" ? null : (
          <>
            <circle cx="-6" cy="15" r="2.7" />
            <circle cx="6" cy="15" r="2.7" />
          </>
        )}
      </g>
      {mood === "calm" && <path d="M-9 15q3-3 6 0M3 15q3-3 6 0" strokeWidth={2} />}
      <path d={mouth} className={mood === "grin" ? "fill-ink" : undefined} strokeWidth={2} />
      <circle cx="-11" cy="22" r="2.4" className="fill-terracotta/25" stroke="none" />
      <circle cx="11" cy="22" r="2.4" className="fill-terracotta/25" stroke="none" />
    </g>
  );
}

const SKIN = ["#F3D3B6", "#E3B18A", "#C88F64", "#A26C46", "#764A2F"];
const HAIR = { black: "#2B2026", grey: "#B7AFC2" };

/**
 * A person from the chest up, for seats behind tables. (x, y) is the top of the head.
 * `shirt` is a fill class (e.g. "fill-terracotta") or a hex colour.
 */
export function Person({
  x,
  y,
  s = 1,
  shirt,
  skin = 2,
  hair = "black",
  glasses = false,
  long = false,
}: {
  x: number;
  y: number;
  s?: number;
  shirt: string;
  skin?: number;
  hair?: keyof typeof HAIR;
  glasses?: boolean;
  long?: boolean;
}) {
  const shirtProps = shirt.startsWith("#") ? { fill: shirt } : { className: shirt };
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {long && <path d="M-17 44c-3-18-2-32 3-38 7-8 21-8 28 0 5 6 6 20 3 38Z" fill={HAIR[hair]} />}
      <path d="M-27 125V66c0-14 12-22 27-22s27 8 27 22v59Z" {...shirtProps} />
      <path d="M-6 36h12v10c-4 3-8 3-12 0Z" fill={SKIN[skin]} />
      <circle cx="0" cy="20" r="16" fill={SKIN[skin]} />
      <path d="M-16 18C-17 4-8-1 0-1s17 4 16 19c-3-6-8-9-14-9-3 3-10 4-15 2-1 2-2 4-3 7Z" fill={HAIR[hair]} />
      <g className="fill-ink" stroke="none">
        <circle cx="-5.5" cy="21" r="2" />
        <circle cx="5.5" cy="21" r="2" />
      </g>
      {glasses && <path d="M-11 18h9v7h-9ZM2 18h9v7H2ZM-2 20.5h4" strokeWidth={1.6} />}
      <path d="M-5 28q5 4 10 0" strokeWidth={2} />
      <circle cx="-10" cy="27" r="2.6" className="fill-terracotta/25" stroke="none" />
      <circle cx="10" cy="27" r="2.6" className="fill-terracotta/25" stroke="none" />
    </g>
  );
}

/** A small standing person, for paths and stages. (x, y) is the top of the head; about 80 units tall at s = 1. */
export function Figure({
  x,
  y,
  s = 1,
  shirt,
  skin = 2,
  hair = "black",
  glasses = false,
}: {
  x: number;
  y: number;
  s?: number;
  shirt: string;
  skin?: number;
  hair?: keyof typeof HAIR;
  glasses?: boolean;
}) {
  const shirtProps = shirt.startsWith("#") ? { fill: shirt } : { className: shirt };
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-9 54h7v24h-7ZM2 54h7v24H2Z" className="fill-ink" />
      <path d="M-15 56V34c0-7 6-11 15-11s15 4 15 11v22Z" {...shirtProps} />
      <path d="M-15 34-21 50M15 34l6 16" strokeWidth={3} />
      <circle cx="0" cy="12" r="12" fill={SKIN[skin]} />
      <path d="M-12 11C-13 0-6-3 0-3s13 3 12 14c-2-4-6-7-11-7-2 2-7 3-11 2Z" fill={HAIR[hair]} />
      <g className="fill-ink" stroke="none">
        <circle cx="-4.5" cy="13" r="1.7" />
        <circle cx="4.5" cy="13" r="1.7" />
      </g>
      {glasses && <path d="M-9 10.5h7v5h-7ZM2 10.5h7v5H2ZM-2 12.5h4" strokeWidth={1.5} />}
      <path d="M-4 18q4 3 8 0" strokeWidth={1.8} />
    </g>
  );
}
