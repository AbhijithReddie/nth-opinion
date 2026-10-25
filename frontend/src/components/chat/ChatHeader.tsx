import { FRIENDS_BY_ID, type FriendId } from "@/config/friends";
import type { GroupSetup } from "@/lib/chatTypes";
import { Avatar } from "./Avatar";
import { ChatMenu } from "./ChatMenu";
import { typingLabel } from "./chatNames";

/** Group name, stacked friend avatars, and a live status line ("Rohit is typing..." or the member list). */
export function ChatHeader({
  setup,
  typing,
  onEditGroup,
  onClearChat,
}: {
  setup: GroupSetup;
  typing: FriendId[];
  onEditGroup: () => void;
  onClearChat: () => void;
}) {
  const names = Object.fromEntries(setup.friends.map((f) => [f.id, f.name]));
  const typingNames = typing.map((id) => names[id] ?? FRIENDS_BY_ID[id].name);
  const status = typingNames.length ? typingLabel(typingNames) : `${setup.friends.map((f) => f.name).join(", ")}, You`;

  return (
    <header className="flex items-center gap-3 border-b border-white/[0.06] bg-arena-900/90 px-3 py-2.5 backdrop-blur sm:px-4">
      <div className="flex -space-x-2.5" aria-hidden>
        {setup.friends.map((f) => (
          <Avatar key={f.id} id={f.id} className="ring-2 ring-arena-900" />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-base leading-tight font-bold sm:text-lg">{setup.groupName}</h1>
        <p aria-live="polite" className={`truncate text-xs ${typingNames.length ? "text-cyan" : "text-muted"}`}>
          {status}
        </p>
      </div>
      <ChatMenu onEditGroup={onEditGroup} onClearChat={onClearChat} />
    </header>
  );
}
