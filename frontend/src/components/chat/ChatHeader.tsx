import { Avatar } from "./Avatar";
import { ChatMenu } from "./ChatMenu";
import { typingLabel } from "./chatNames";
import { useRoom } from "./RoomContext";

/** Room title, stacked avatars, and a live status line ("Rohit is typing..." or the member list). */
export function ChatHeader({
  typing,
  mode,
  onEdit,
  onClearChat,
}: {
  typing: string[];
  /** Current mode id, for rooms with modes. */
  mode: string | null;
  onEdit: () => void;
  onClearChat: () => void;
}) {
  const { config, setup, persona, nameOf } = useRoom();
  const modeLabel = config.modes?.find((m) => m.id === mode)?.label;
  const typingNames = typing.map(nameOf);
  const status = typingNames.length ? typingLabel(typingNames) : `${setup.participants.map((p) => p.name).join(", ")}, You`;

  return (
    <header className="flex items-center gap-3 border-b border-white/[0.06] bg-arena-900/90 px-3 py-2.5 backdrop-blur sm:px-4">
      <div className="flex -space-x-2.5" aria-hidden>
        {setup.participants.map((p) => {
          const meta = persona(p.id);
          return meta ? <Avatar key={p.id} persona={meta} className="ring-2 ring-arena-900" /> : null;
        })}
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-base leading-tight font-bold sm:text-lg">{setup.title}</h1>
        <p aria-live="polite" className={`truncate text-xs ${typingNames.length ? "text-cyan" : "text-muted"}`}>
          {status}
        </p>
      </div>
      {modeLabel && (
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold" aria-label={`Mode: ${modeLabel}`}>
          {modeLabel}
        </span>
      )}
      <ChatMenu editLabel={config.copy.editMenu} onEdit={onEdit} onClearChat={onClearChat} />
    </header>
  );
}
