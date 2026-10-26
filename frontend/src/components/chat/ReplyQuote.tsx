import type { ChatMessage } from "@/lib/chatTypes";
import { useRoom } from "./RoomContext";

/**
 * The quoted message shown above a reply. Tapping it jumps to the original.
 * `inverse` is for the user's own terracotta bubble: white text instead of persona colours.
 */
export function ReplyQuote({ original, onJump, inverse = false }: { original: ChatMessage | undefined; onJump: (id: string) => void; inverse?: boolean }) {
  const { nameOf, persona } = useRoom();

  if (!original) {
    return (
      <div className={`mb-1.5 rounded-lg border-l-2 px-2.5 py-1.5 text-xs italic ${inverse ? "border-white/60 bg-white/15 text-white" : "border-line-strong bg-sand text-muted"}`}>
        Original message not available
      </div>
    );
  }
  const color = persona(original.sender)?.color ?? "var(--color-primary-deep)";
  const name = nameOf(original.sender);

  return (
    <button
      type="button"
      onClick={() => onJump(original.id)}
      aria-label={`Jump to ${name}'s message`}
      className={`mb-1.5 block w-full rounded-lg border-l-2 px-2.5 py-1.5 text-left transition focus-visible:ring-2 focus-visible:outline-none ${
        inverse ? "bg-white/15 hover:bg-white/25 focus-visible:ring-white/70" : "bg-sand hover:bg-sand-deep focus-visible:ring-primary/50"
      }`}
      style={{ borderColor: inverse ? "rgb(255 255 255 / 0.7)" : color }}
    >
      <span className="block text-xs font-semibold" style={{ color: inverse ? "#FFFFFF" : color }}>
        {name}
      </span>
      <span className={`line-clamp-2 text-xs ${inverse ? "text-white" : "text-muted"}`}>{original.text}</span>
    </button>
  );
}
