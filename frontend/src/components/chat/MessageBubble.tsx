import type { ChatMessage } from "@/lib/chatTypes";
import { Avatar } from "./Avatar";
import { formatTime } from "./chatNames";
import { MessageText } from "./MessageText";
import { Reactions } from "./Reactions";
import { ReplyQuote } from "./ReplyQuote";
import { useRoom } from "./RoomContext";

interface MessageBubbleProps {
  message: ChatMessage;
  /** The message this one replies to, if any. */
  original: ChatMessage | undefined;
  /** True when the previous message has the same sender: hide the repeated name and avatar. */
  grouped: boolean;
  highlighted: boolean;
  onJump: (id: string) => void;
}

/** One chat message: personas on the left with avatar and coloured name, the user on the right. */
export function MessageBubble({ message, original, grouped, highlighted, onJump }: MessageBubbleProps) {
  const { persona, nameOf } = useRoom();
  const mine = message.sender === "user";
  const author = mine ? undefined : persona(message.sender);
  const name = nameOf(message.sender);

  return (
    <li
      id={`msg-${message.id}`}
      className={`animate-message-in scroll-mt-24 rounded-2xl ${highlighted ? "animate-flash" : ""} ${grouped ? "mt-1" : "mt-3"}`}
    >
      <div className={`flex items-end gap-2 ${mine ? "justify-end" : ""}`}>
        {!mine && (grouped || !author ? <span className="size-8 shrink-0" /> : <Avatar persona={author} />)}

        <div className={`flex max-w-[82%] flex-col sm:max-w-[70%] ${mine ? "items-end" : "items-start"}`}>
          <div
            className={`relative rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed shadow-soft ${
              mine ? "rounded-br-md bg-primary text-white" : "rounded-bl-md border border-line bg-surface text-ink"
            }`}
          >
            {!mine && !grouped && (
              <p className="mb-0.5 text-[13px] font-semibold" style={{ color: author?.color }}>
                {name}
              </p>
            )}
            {message.replyTo && <ReplyQuote original={original} onJump={onJump} inverse={mine} />}
            <p className="break-words whitespace-pre-wrap">
              <span className="sr-only">{name}: </span>
              <MessageText text={message.text} inverse={mine} />
            </p>
            <time
              dateTime={new Date(message.ts).toISOString()}
              className={`float-right mt-1 ml-3 text-[10px] leading-none ${mine ? "text-white/90" : "text-faint"}`}
            >
              {formatTime(message.ts)}
            </time>
          </div>
          <Reactions reactions={message.reactions} alignRight={mine} />
        </div>
      </div>
    </li>
  );
}
