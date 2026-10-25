import type { ChatMessage } from "@/lib/chatTypes";
import { useRoom } from "./RoomContext";

/** The quoted message shown above a reply. Tapping it jumps to the original. */
export function ReplyQuote({ original, onJump }: { original: ChatMessage | undefined; onJump: (id: string) => void }) {
  const { nameOf, persona } = useRoom();

  if (!original) {
    return (
      <div className="mb-1.5 rounded-lg border-l-2 border-white/20 bg-black/20 px-2.5 py-1.5 text-xs text-faint italic">
        Original message not available
      </div>
    );
  }
  const color = persona(original.sender)?.color ?? "var(--color-brand)";
  const name = nameOf(original.sender);

  return (
    <button
      type="button"
      onClick={() => onJump(original.id)}
      aria-label={`Jump to ${name}'s message`}
      className="mb-1.5 block w-full rounded-lg border-l-2 bg-black/25 px-2.5 py-1.5 text-left transition hover:bg-black/35 focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none"
      style={{ borderColor: color }}
    >
      <span className="block text-xs font-semibold" style={{ color }}>
        {name}
      </span>
      <span className="line-clamp-2 text-xs text-ink/70">{original.text}</span>
    </button>
  );
}
