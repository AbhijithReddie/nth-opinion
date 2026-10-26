import { useId } from "react";
import type { AvatarLook, Persona } from "@/config/personas";

/**
 * Illustrated persona avatars: one flat, hand-drawn style for every persona in
 * every room. Each face is built from the persona's `look` (skin, hair, mood,
 * accessories) and dressed in the persona's colour, so it stays recognisable at 24px.
 */

const SIZES = { xs: "size-6", sm: "size-8", md: "size-10", lg: "size-14", xl: "size-20" };

const INK = "#2B2240";
const BLUSH = "#E07A66";
const SKIN = { 1: "#F3D3B6", 2: "#E3B18A", 3: "#C88F64", 4: "#A26C46", 5: "#764A2F" } as const;
const HAIR = { black: "#2B2026", brown: "#5B3A29", grey: "#B7AFC2" } as const;

type Look = AvatarLook;
type HairStyle = NonNullable<Look["hair"]>;
type Mood = NonNullable<Look["mood"]>;

/** A persona's round avatar. Decorative by default (the name is always shown next to it); pass `label` to announce it. */
export function Avatar({
  persona,
  size = "sm",
  className = "",
  label,
}: {
  persona: Persona;
  size?: keyof typeof SIZES;
  className?: string;
  label?: string;
}) {
  return <PersonaFace look={persona.look} color={persona.color} label={label} className={`shrink-0 rounded-full ${SIZES[size]} ${className}`} />;
}

export function PersonaFace({ look, color, className, label }: { look: Look; color: string; className?: string; label?: string }) {
  const clipId = useId();
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
        {look.kind === "bot" ? <Bot look={look} color={color} /> : <Person look={look} color={color} />}
      </g>
      <circle cx="32" cy="32" r="31" fill="none" stroke={color} strokeOpacity={0.45} strokeWidth="2" />
    </svg>
  );
}

function Person({ look, color }: { look: Look; color: string }) {
  const skin = SKIN[look.skin ?? 3];
  const hair = HAIR[look.hairColor ?? "black"];
  const style = look.hair ?? "short";
  const extras = new Set(look.extras ?? []);
  const showEars = !["bob", "long", "wavy"].includes(style);

  return (
    <>
      <HairBack style={style} fill={hair} />
      {/* Shoulders and collar, in the persona's colour. */}
      <path d="M8 66C8 51 19 45.5 32 45.5S56 51 56 66Z" fill={color} />
      <path d="M26 46.6 32 52l6-5.4" fill="none" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {extras.has("tie") && <path d="M30.6 48.6h2.8l1 2.6-2.4 9-2.4-9Z" fill={INK} />}
      <path d="M27.5 37h9v9.6c-2.6 2-6.4 2-9 0Z" fill={skin} />
      <path d="M27.5 41.6c3 1.5 6 1.5 9 0" fill="none" stroke={INK} strokeOpacity={0.12} strokeWidth="2.4" />
      {showEars && (
        <>
          <circle cx="20" cy="30.5" r="2.8" fill={skin} />
          <circle cx="44" cy="30.5" r="2.8" fill={skin} />
        </>
      )}
      <ellipse cx="32" cy="29.5" rx="12" ry="13" fill={skin} />
      {(extras.has("stubble") || extras.has("beard")) && (
        <path
          d="M20.5 31c.5 9 5.5 12.5 11.5 12.5S43 40 43.5 31c-1.5 5-4.5 7.6-11.5 7.6S22 36 20.5 31Z"
          fill={hair}
          fillOpacity={extras.has("beard") ? 1 : 0.22}
        />
      )}
      <HairFront style={style} fill={hair} />
      <Face mood={look.mood ?? "smile"} brow={hair} />
      {extras.has("moustache") && (
        <path d="M27.8 34.4c1.8-1.4 3.2-1 4.2-.3 1-.7 2.4-1.1 4.2.3-1.8 1.1-3.2.8-4.2.4-1 .4-2.4.7-4.2-.4Z" fill={hair} />
      )}
      {extras.has("glasses") && (
        <g fill="#FFFFFF" fillOpacity={0.25} stroke={INK} strokeWidth="1.3">
          <rect x="23.1" y="27" width="7.8" height="6.4" rx="2.4" />
          <rect x="33.1" y="27" width="7.8" height="6.4" rx="2.4" />
          <path d="M30.9 29.6q1.1-.8 2.2 0M23.1 29.4h-2.4M40.9 29.4h2.4" fill="none" />
        </g>
      )}
      {extras.has("round-glasses") && (
        <g fill="#FFFFFF" fillOpacity={0.25} stroke={INK} strokeWidth="1.3">
          <circle cx="27" cy="30.2" r="3.9" />
          <circle cx="37" cy="30.2" r="3.9" />
          <path d="M30.9 29.8q1.1-.8 2.2 0M23.1 29.6h-2.4M40.9 29.6h2.4" fill="none" />
        </g>
      )}
      {extras.has("bindi") && <circle cx="32" cy="24.2" r="1.05" fill="#B0263A" />}
      {extras.has("earrings") && (
        <g fill="#F2CF63" stroke={INK} strokeWidth="0.6">
          <circle cx="19.8" cy="35" r="1.5" />
          <circle cx="44.2" cy="35" r="1.5" />
        </g>
      )}
      {extras.has("flower") && (
        <g>
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} cx={42.5 + 2.3 * Math.cos((a * Math.PI) / 180)} cy={17.5 + 2.3 * Math.sin((a * Math.PI) / 180)} r="2" fill="#F2B5C6" />
          ))}
          <circle cx="42.5" cy="17.5" r="1.3" fill="#F2CF63" />
        </g>
      )}
      {extras.has("cap") && (
        <g fill="#B84A36" stroke={INK} strokeWidth="1">
          <path d="M44.5 23.2c3.8-.2 5.6 1.3 5.2 2.6-2.1-.6-4-.8-6-.8Z" />
          <path d="M19.5 24.2C19.5 15.6 25 12.4 32 12.4S44.5 15.6 44.5 24.2C40 21.6 24 21.6 19.5 24.2Z" />
        </g>
      )}
      {extras.has("headphones") && (
        <g stroke={INK} strokeWidth="1.1">
          <path d="M18.4 30C18.4 14.6 45.6 14.6 45.6 30" fill="none" strokeWidth="2.4" />
          <rect x="15.4" y="26.4" width="5.6" height="8.4" rx="2.6" fill="#A895D8" />
          <rect x="43" y="26.4" width="5.6" height="8.4" rx="2.6" fill="#A895D8" />
        </g>
      )}
      {extras.has("sparkle") && (
        <g fill="#F2CF63" stroke={INK} strokeWidth="0.8" strokeLinejoin="round">
          <path d="M52 7.5 53.4 11.6 57.5 13 53.4 14.4 52 18.5 50.6 14.4 46.5 13 50.6 11.6Z" />
          <path d="M11 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" />
        </g>
      )}
      {extras.has("question") && (
        <path d="M47.5 12.6a3.6 3.6 0 1 1 5.2 3.2c-1.3.7-1.7 1.4-1.7 2.8M51 21.6v.1" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
      )}
    </>
  );
}

function Bot({ look, color }: { look: Look; color: string }) {
  const judge = look.extras?.includes("judge-cap");
  return (
    <>
      <path d="M10 66C10 52 20 47.5 32 47.5S54 52 54 66Z" fill={color} />
      {judge && <path d="M29.4 48.4h2.3v6.4h-2.3ZM32.3 48.4h2.3v6.4h-2.3Z" fill="#FFFFFF" />}
      <rect x="28" y="41" width="8" height="7.5" rx="2" fill="#D6C8B3" />
      {judge ? (
        <g stroke={INK} strokeWidth="1.2">
          <path d="M17.5 18.5C17.5 9.4 46.5 9.4 46.5 18.5Z" fill={INK} />
          <circle cx="32" cy="10.4" r="2.2" fill="#F2CF63" />
        </g>
      ) : (
        <g stroke={INK}>
          <path d="M32 15V9.6" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="32" cy="8.2" r="2.8" fill={color} strokeWidth="1.2" />
        </g>
      )}
      <g stroke={INK} strokeWidth="1.2">
        <rect x="11.6" y="24" width="4.6" height="10" rx="2" fill={color} />
        <rect x="47.8" y="24" width="4.6" height="10" rx="2" fill={color} />
      </g>
      <rect x="15" y="15.5" width="34" height="27.5" rx="10" fill="#FFFFFF" stroke={INK} strokeWidth="1.6" />
      <rect x="19.5" y="20" width="25" height="18.5" rx="7" fill={color} fillOpacity={0.16} />
      <g transform="translate(0 -1.8)">
        <Face mood={look.mood ?? "smile"} brow={INK} />
      </g>
    </>
  );
}

/** Hair that sits behind the head: long hair, buns, ponytails. */
function HairBack({ style, fill }: { style: HairStyle; fill: string }) {
  switch (style) {
    case "bob":
      return <path d="M17.2 41C15.6 24 20 14 32 14s16.4 10 14.8 27c-1.8 1.6-4.6 1.4-5.2-1H22.4c-.6 2.4-3.4 2.6-5.2 1Z" fill={fill} />;
    case "long":
      return <path d="M16.6 54C14.4 32 16.8 14.4 32 14c15.2.4 17.6 18 15.4 40-5.4 2-25.4 2-30.8 0Z" fill={fill} />;
    case "wavy":
      return (
        <path
          d="M16.8 46c-3.2-10-.4-15-.6-20 .4-8.6 6.8-12.4 15.8-12.4S47.4 17.4 47.8 26c-.2 5 2.6 10-.6 20-2.4 1.8-4.8.4-4.6-2H21.4c.2 2.4-2.2 3.8-4.6 2Z"
          fill={fill}
        />
      );
    case "bun":
      return <circle cx="32" cy="11.4" r="5.6" fill={fill} />;
    case "ponytail":
      return (
        <>
          <path d="M41 17c9.5-1.5 13 8 10 20-1.4-5-3.4-9-6.8-12Z" fill={fill} />
          <circle cx="43.4" cy="18.2" r="1.9" fill="#F2CF63" />
        </>
      );
    case "pigtails":
      return (
        <>
          <circle cx="16.4" cy="22" r="5.2" fill={fill} />
          <circle cx="47.6" cy="22" r="5.2" fill={fill} />
        </>
      );
    default:
      return null;
  }
}

/** Hair over the forehead. */
function HairFront({ style, fill }: { style: HairStyle; fill: string }) {
  switch (style) {
    case "side":
      return (
        <>
          <path d="M19.6 29c-1.2-10.4 5-15.8 12.8-15.8 8.2 0 13.6 5.8 12 15.8-.8-4-2.4-6.4-4.8-7.8-4 2.4-10 3.2-15.6 1.6-2 1.6-3.6 3.6-4.4 6.2Z" fill={fill} />
          <path d="M26 17.4q6-2.4 13 .4" fill="none" stroke="#FFFFFF" strokeOpacity={0.2} strokeWidth="1.4" strokeLinecap="round" />
        </>
      );
    case "spiky":
      return (
        <path
          d="m19.6 28-.6-7.8 3.6.6-.2-5.8 4.4 2.4 1.8-5.8 4 4 3.8-4.2 1.8 5.4 4.4-2.2-.2 5.4 2.8-.2-.8 8.2c-2-4.6-6.4-6.6-12.4-6.6S21.6 23.4 19.6 28Z"
          fill={fill}
        />
      );
    case "curly":
      return (
        <g fill={fill}>
          <circle cx="21.5" cy="23.5" r="5" />
          <circle cx="25.5" cy="17.8" r="5.4" />
          <circle cx="32" cy="15.4" r="6" />
          <circle cx="38.5" cy="17.8" r="5.4" />
          <circle cx="42.5" cy="23.5" r="5" />
          <circle cx="19.6" cy="28.5" r="3.2" />
          <circle cx="44.4" cy="28.5" r="3.2" />
        </g>
      );
    case "bob":
      return <path d="M19.8 27c.6-8.4 5.8-12 12.2-12s11.6 3.6 12.2 12c-2.8-4-7.2-5.2-12.2-5s-9.4 1-12.2 5Z" fill={fill} />;
    case "long":
    case "wavy":
      return <path d="M19.8 29c-.2-10.2 5.4-14.4 12.2-14 6.8-.4 12.4 3.8 12.2 14-1.6-5-6.6-8.4-11.6-9.4-4.2 1.8-9.8 4.6-12.8 9.4Z" fill={fill} />;
    case "bun":
    case "ponytail":
    case "pigtails":
      return <path d="M19.8 27.5c.2-8.9 5.6-12.9 12.2-12.9s12 4 12.2 12.9c-1.6-3.9-6.2-5.9-12.2-5.9s-10.6 2-12.2 5.9Z" fill={fill} />;
    case "buzz":
      return <path d="M20.2 25.5c.4-7.5 5.4-10.3 11.8-10.3s11.4 2.8 11.8 10.3c-3.8-2.9-19.8-2.9-23.6 0Z" fill={fill} />;
    case "tousled":
      return (
        <path
          d="M19.6 28.6C18.2 19 23.6 13 32 13s14.2 5.6 12.4 15.6c-1-3.6-2.8-5.6-5.4-6.6-.8 1.6-3.6 2.2-5.6.6-2 1.8-6 1.8-7.4-.4-2.6 1.2-5.2 3.2-6.4 6.4Z"
          fill={fill}
        />
      );
    case "short":
    default:
      return <path d="M19.6 28.5c-1-10 5-14.9 12.4-14.9s13.4 4.9 12.4 14.9c-1-4-3.4-6.5-6.9-7.3-4.5 2.2-11 2.2-14.9 1.1-1.6 1.5-2.5 3.5-3 6.2Z" fill={fill} />;
  }
}

/** Eyes, brows, mouth and blush for a mood. Coordinates match the person's head; bots shift it up. */
function Face({ mood, brow }: { mood: Mood; brow: string }) {
  const closedEyes = mood === "calm" || mood === "laugh";
  const blush = mood !== "flat" && mood !== "frown";
  const brows: Record<Mood, string> = {
    smile: "M24.8 26q2.2-1 4.4-.2M34.8 25.8q2.2-.8 4.4.2",
    grin: "M24.8 25.6q2.2-1.2 4.4-.4M34.8 25.2q2.2-.8 4.4.4",
    laugh: "M24.8 25.4q2.2-1.4 4.4-.4M34.8 25q2.2-1 4.4.4",
    smirk: "M24.8 26q2.2-1 4.4-.2M34.8 24.6q2.2-1.4 4.4-.2",
    flat: "M25 25.8h4.2M34.8 25.8H39",
    frown: "m24.8 25 4.6 1.6M34.6 26.6l4.6-1.6",
    calm: "M24.8 26q2.2-.8 4.4 0M34.8 26q2.2-.8 4.4 0",
    confused: "M24.8 26.4q2.2-1.6 4.4-1M34.8 24.4l4.4 1.2",
  };
  const mouths: Record<Mood, React.ReactNode> = {
    smile: <path d="M28 35.6q4 3.6 8 0" fill="none" stroke={INK} strokeWidth="1.7" strokeLinecap="round" />,
    calm: <path d="M29 35.8q3 2.2 6 0" fill="none" stroke={INK} strokeWidth="1.7" strokeLinecap="round" />,
    smirk: <path d="M28.5 36.6q4 1.2 7.5-1.8" fill="none" stroke={INK} strokeWidth="1.7" strokeLinecap="round" />,
    flat: <path d="M29 36.6h6" fill="none" stroke={INK} strokeWidth="1.7" strokeLinecap="round" />,
    frown: <path d="M28.6 38q3.4-3.2 6.8 0" fill="none" stroke={INK} strokeWidth="1.7" strokeLinecap="round" />,
    grin: (
      <>
        <path d="M27.4 35.2q4.6 6.4 9.2 0Z" fill={INK} stroke={INK} strokeWidth="1" strokeLinejoin="round" />
        <path d="M28.8 35.9h6.4" stroke="#FFFFFF" strokeWidth="1" />
      </>
    ),
    laugh: (
      <>
        <path d="M27 34.8q5 8.2 10 0Z" fill={INK} stroke={INK} strokeWidth="1" strokeLinejoin="round" />
        <ellipse cx="32" cy="38.6" rx="2.4" ry="1.2" fill="#E07A66" />
      </>
    ),
    confused: <ellipse cx="32" cy="37" rx="1.8" ry="2.1" fill={INK} />,
  };

  return (
    <>
      {blush && (
        <g fill={BLUSH} fillOpacity={0.3}>
          <circle cx="24.4" cy="34.4" r="2.2" />
          <circle cx="39.6" cy="34.4" r="2.2" />
        </g>
      )}
      <path d={brows[mood]} fill="none" stroke={brow} strokeWidth="1.5" strokeLinecap="round" />
      {closedEyes ? (
        <path d="M25 30.6q2-2 4 0M35 30.6q2-2 4 0" fill="none" stroke={INK} strokeWidth="1.7" strokeLinecap="round" />
      ) : (
        <g>
          <circle cx="27" cy="30.2" r={mood === "confused" ? 1.5 : 1.7} fill={INK} />
          <circle cx="37" cy="30.2" r={mood === "confused" ? 2.1 : 1.7} fill={INK} />
          <circle cx="27.6" cy="29.6" r="0.5" fill="#FFFFFF" />
          <circle cx="37.6" cy="29.6" r="0.5" fill="#FFFFFF" />
        </g>
      )}
      {mouths[mood]}
    </>
  );
}
