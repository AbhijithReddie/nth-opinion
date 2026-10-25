import { TypingIndicator } from "../TypingIndicator";
import { Avatar } from "./Avatar";
import { useRoom } from "./RoomContext";

/** The "..." bubble shown at the bottom of the chat while a persona is typing. */
export function TypingBubble({ id }: { id: string }) {
  const { persona, nameOf } = useRoom();
  const meta = persona(id);
  if (!meta) return null;
  const name = nameOf(id);

  return (
    <li className="animate-message-in mt-3 flex items-end gap-2">
      <Avatar persona={meta} />
      <div className="rounded-2xl rounded-bl-md border border-white/[0.06] bg-arena-800 px-3.5 py-2.5">
        <p className="mb-1 text-[13px] font-semibold" style={{ color: meta.color }}>
          {name}
        </p>
        <TypingIndicator label={`${name} is typing`} className="text-muted" />
      </div>
    </li>
  );
}
