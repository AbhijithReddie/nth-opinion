import { FRIENDS_BY_ID, isFriendId } from "@/config/friends";
import type { ChatMessage, GroupSetup } from "@/lib/chatTypes";
import { senderName } from "./chatNames";

/** The quoted message shown above a reply. Tapping it jumps to the original. */
export function ReplyQuote({
  original,
  setup,
  onJump,
}: {
  original: ChatMessage | undefined;
  setup: GroupSetup;
  onJump: (id: string) => void;
}) {
  if (!original) {
    return <div className="mb-1.5 rounded-lg border-l-2 border-white/20 bg-black/20 px-2.5 py-1.5 text-xs text-faint italic">Original message not available</div>;
  }
  const color = isFriendId(original.sender) ? FRIENDS_BY_ID[original.sender].color : "var(--color-brand)";

  return (
    <button
      type="button"
      onClick={() => onJump(original.id)}
      aria-label={`Jump to ${senderName(setup, original.sender)}'s message`}
      className="mb-1.5 block w-full rounded-lg border-l-2 bg-black/25 px-2.5 py-1.5 text-left transition hover:bg-black/35 focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none"
      style={{ borderColor: color }}
    >
      <span className="block text-xs font-semibold" style={{ color }}>
        {senderName(setup, original.sender)}
      </span>
      <span className="line-clamp-2 text-xs text-ink/70">{original.text}</span>
    </button>
  );
}
