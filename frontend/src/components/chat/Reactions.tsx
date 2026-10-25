import type { ChatReaction } from "@/lib/chatTypes";
import { useRoom } from "./RoomContext";

/** Emoji reactions under a message, grouped by emoji ("❤️ 2"), with who reacted in the tooltip. */
export function Reactions({ reactions, alignRight }: { reactions: ChatReaction[]; alignRight: boolean }) {
  const { nameOf } = useRoom();
  if (reactions.length === 0) return null;

  const groups = new Map<string, string[]>();
  for (const r of reactions) groups.set(r.emoji, [...(groups.get(r.emoji) ?? []), nameOf(r.friendId)]);

  return (
    <ul className={`-mt-1.5 flex flex-wrap gap-1 ${alignRight ? "justify-end pr-2" : "pl-2"}`}>
      {[...groups].map(([emoji, names]) => {
        const label = `${names.join(", ")} reacted ${emoji}`;
        return (
          <li
            key={emoji}
            title={label}
            aria-label={label}
            className="animate-pop inline-flex items-center gap-1 rounded-full border border-white/10 bg-arena-800 px-1.5 py-0.5 text-xs shadow-md shadow-black/30"
          >
            <span aria-hidden>{emoji}</span>
            {names.length > 1 && <span className="font-mono text-[10px] text-muted">{names.length}</span>}
          </li>
        );
      })}
    </ul>
  );
}
