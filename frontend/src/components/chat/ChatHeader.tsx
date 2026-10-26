import { BehindTheScenesToggle } from "../trace/BehindTheScenesToggle";
import { ChatBubbleIcon, PhoneIcon } from "../icons";
import type { ConversationSave } from "@/hooks/useConversationSave";
import { SaveStatusPill } from "../account/SaveConversation";
import { VoiceToggle } from "../voice/VoiceOutput";
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
  onWatchDemo,
  view = "chat",
  onView,
  callName = "Call",
  save,
}: {
  typing: string[];
  /** Current mode id, for rooms with modes. */
  mode: string | null;
  /** Leave out onEdit and onClearChat to hide the menu (demo replays). */
  onEdit?: () => void;
  onClearChat?: () => void;
  onWatchDemo?: () => void;
  /** Chat or Call view (the call has its own voice and "Behind the scenes" controls). */
  view?: "chat" | "call";
  onView?: (view: "chat" | "call") => void;
  callName?: string;
  /** Signed-in users: the "Save conversation" toggle (in the menu) and its status. */
  save?: ConversationSave;
}) {
  const { config, setup, persona, nameOf } = useRoom();
  const modeLabel = config.modes?.find((m) => m.id === mode)?.label;
  const typingNames = typing.map(nameOf);
  const everyone = [...setup.participants, ...(setup.guests ?? [])];
  const guestNames = (setup.guests ?? []).map((g) => `${g.name} (guest)`);
  const status = typingNames.length
    ? typingLabel(typingNames)
    : `${[...setup.participants.map((p) => p.name), ...guestNames].join(", ")}, You`;

  return (
    <header className="flex items-center gap-3 border-b border-line bg-surface/90 px-3 py-2.5 backdrop-blur sm:px-4">
      <div className="flex -space-x-2.5" aria-hidden>
        {everyone.map((p) => {
          const meta = persona(p.id);
          return meta ? <Avatar key={p.id} persona={meta} className="ring-2 ring-surface" /> : null;
        })}
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-base leading-tight font-semibold sm:text-lg">{setup.title}</h1>
        <p aria-live="polite" className={`truncate text-xs ${typingNames.length ? "font-medium text-pro-deep" : "text-muted"}`}>
          {status}
        </p>
      </div>
      {modeLabel && (
        <span className="shrink-0 rounded-full border border-line-strong bg-sand px-2.5 py-1 text-xs font-semibold" aria-label={`Mode: ${modeLabel}`}>
          {modeLabel}
        </span>
      )}
      {save?.available && save.on && <SaveStatusPill status={save.status} />}
      {onView && <ViewSwitch view={view} onView={onView} callName={callName} />}
      {view === "chat" && (
        <>
          <VoiceToggle />
          <BehindTheScenesToggle compact />
        </>
      )}
      {onEdit && onClearChat && (
        <ChatMenu
          editLabel={config.copy.editMenu}
          onEdit={onEdit}
          onClearChat={onClearChat}
          onWatchDemo={onWatchDemo}
          save={save?.available ? { on: save.on, onChange: save.setOn } : undefined}
        />
      )}
    </header>
  );
}

/** The Chat / Call switch: two views of the same conversation. */
export function ViewSwitch({ view, onView, callName, chatName = "Chat" }: { view: "chat" | "call"; onView: (view: "chat" | "call") => void; callName: string; chatName?: string }) {
  const option = (id: "chat" | "call", label: string, icon: React.ReactNode) => (
    <button
      type="button"
      aria-pressed={view === id}
      onClick={() => onView(id)}
      className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none ${
        view === id ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink"
      }`}
    >
      {icon}
      <span className="sr-only sm:not-sr-only">{label}</span>
    </button>
  );
  return (
    <div role="group" aria-label="View" className="flex shrink-0 items-center gap-0.5 rounded-lg border border-line-strong bg-sand p-0.5">
      {option("chat", chatName, <ChatBubbleIcon className="size-3.5" />)}
      {option("call", callName, <PhoneIcon className="size-3.5" />)}
    </div>
  );
}
