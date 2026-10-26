import type { RoomMeta } from "@/config/rooms";

/** Small line glyphs for each room, drawn in currentColor with a soft fill. */
const GLYPHS: Record<string, React.ReactNode> = {
  debate: (
    <>
      <path d="M12 4v16M7 20h10M5 7h14" />
      <path d="m5 7-3 7a3.5 3.5 0 0 0 6 0L5 7ZM19 7l-3 7a3.5 3.5 0 0 0 6 0l-3-7Z" fill="currentColor" fillOpacity={0.2} />
    </>
  ),
  "group-chat": (
    <>
      <path d="M3 6a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H9l-4 3v-3.2A3 3 0 0 1 3 10Z" fill="currentColor" fillOpacity={0.2} />
      <path d="M17 8h1a3 3 0 0 1 3 3v4a3 3 0 0 1-2 2.8V21l-4-3h-3a3 3 0 0 1-2.8-2" />
    </>
  ),
  "shark-tank": (
    <>
      <path d="M4 20V14M10 20v-9M16 20v-5" />
      <path d="M3 9l6-4 4 3 8-5" />
      <path d="M17 3h4v4" />
      <path d="M2 20h20" />
    </>
  ),
  "interview-panel": (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2.5" fill="currentColor" fillOpacity={0.2} />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" />
    </>
  ),
  "future-you": (
    <>
      <path d="M6 3h12M6 21h12" />
      <path d="M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9" />
      <path d="M9 19c1-2 5-2 6 0Z" fill="currentColor" fillOpacity={0.35} />
    </>
  ),
  "roast-and-toast": (
    <path
      d="M12 2c4 4 6 7.5 6 11a6 6 0 0 1-12 0c0-2.5 1.2-4.2 2.5-5.5 0 2 1 3 2 3 0-3-.5-5.5 1.5-8.5Z"
      fill="currentColor"
      fillOpacity={0.2}
    />
  ),
  "study-group": (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2Z" fill="currentColor" fillOpacity={0.2} />
      <path d="M4 20a2 2 0 0 1 2-2h13v3H6a2 2 0 0 1-2-1ZM9 8h6" />
    </>
  ),
};

/** A room's glyph in a tile tinted with the room's accent. Decorative: the room's title is always next to it. */
export function RoomIcon({ room, className = "size-10 rounded-xl", glyphClassName = "size-5" }: { room: RoomMeta; className?: string; glyphClassName?: string }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center ${className}`}
      style={{ backgroundColor: `color-mix(in srgb, ${room.accent} 24%, white)`, color: room.accentInk }}
    >
      <svg viewBox="0 0 24 24" className={glyphClassName} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
        {GLYPHS[room.id]}
      </svg>
    </span>
  );
}
