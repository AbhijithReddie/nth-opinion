import { useId } from "react";

/**
 * The Nth Opinion logo mark: a human at the centre with three AI figures (cyan,
 * coral, gold) around them in a semicircle, inside a speech bubble.
 * Same artwork as public/nth-opinion-icon.svg, inlined so it renders crisply and
 * needs no extra request.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  const gradientId = useId(); // unique per instance, so several logos on a page don't clash

  return (
    <svg viewBox="0 0 64 64" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={gradientId} x1="8" y1="2" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#9D8FFF" />
          <stop offset="1" stopColor="#5A47D6" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
        d="M18 2H46A14 14 0 0 1 60 16V38A14 14 0 0 1 46 52H26L14 61L18 52A14 14 0 0 1 4 38V16A14 14 0 0 1 18 2Z"
      />
      <AiFigure x={15} y={25} color="#2EE6D6" shoulders={[16, 12.5, 10.5]} />
      <AiFigure x={32} y={11} color="#FF5C7A" shoulders={[14, 11, 9.5]} />
      <AiFigure x={49} y={25} color="#F6C453" shoulders={[16, 12.5, 10.5]} />
      <g fill="#FFFFFF">
        <circle cx="32" cy="33" r="6" />
        <path d="M21 50C21 43 26 40.5 32 40.5S43 43 43 50Z" />
      </g>
    </svg>
  );
}

/**
 * One AI figure: antenna with a spark, rounded-square head with eyes, small shoulders.
 * (x, y) is the top centre of the head; `shoulders` are the y offsets of the shoulder curve (bottom, control, top).
 */
function AiFigure({ x, y, color, shoulders }: { x: number; y: number; color: string; shoulders: [number, number, number] }) {
  const [bottom, ctrl, top] = shoulders.map((o) => y + o);
  return (
    <g fill={color}>
      <path d={`M${x} ${y}V${y - 3.4}`} stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx={x} cy={y - 4.7} r="1.9" />
      <rect x={x - 4.5} y={y} width="9" height="8" rx="2.6" />
      <path d={`M${x - 5} ${bottom}C${x - 5} ${ctrl} ${x - 3} ${top} ${x} ${top}S${x + 5} ${ctrl} ${x + 5} ${bottom}Z`} />
      <circle cx={x - 1.8} cy={y + 4} r="1" fill="#231A5C" />
      <circle cx={x + 1.8} cy={y + 4} r="1" fill="#231A5C" />
    </g>
  );
}
