import { FRIENDS_BY_ID, type FriendId } from "@/config/friends";
import { TypingIndicator } from "../TypingIndicator";
import { Avatar } from "./Avatar";

/** The "..." bubble shown at the bottom of the chat while a friend is typing. */
export function TypingBubble({ id, name }: { id: FriendId; name: string }) {
  return (
    <li className="animate-message-in mt-3 flex items-end gap-2">
      <Avatar id={id} />
      <div className="rounded-2xl rounded-bl-md border border-white/[0.06] bg-arena-800 px-3.5 py-2.5">
        <p className="mb-1 text-[13px] font-semibold" style={{ color: FRIENDS_BY_ID[id].color }}>
          {name}
        </p>
        <TypingIndicator label={`${name} is typing`} className="text-muted" />
      </div>
    </li>
  );
}
