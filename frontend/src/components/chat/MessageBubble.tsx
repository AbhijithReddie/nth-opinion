import { FRIENDS_BY_ID } from "@/config/friends";
import type { ChatMessage, GroupSetup } from "@/lib/chatTypes";
import { Avatar } from "./Avatar";
import { formatTime, senderName } from "./chatNames";
import { MessageText } from "./MessageText";
import { Reactions } from "./Reactions";
import { ReplyQuote } from "./ReplyQuote";

interface MessageBubbleProps {
  message: ChatMessage;
  setup: GroupSetup;
  /** The message this one replies to, if any. */
  original: ChatMessage | undefined;
  /** True when the previous message has the same sender: hide the repeated name and avatar. */
  grouped: boolean;
  highlighted: boolean;
  onJump: (id: string) => void;
}

/** One chat message: friends on the left with avatar and coloured name, the user on the right. */
export function MessageBubble({ message, setup, original, grouped, highlighted, onJump }: MessageBubbleProps) {
  const mine = message.sender === "user";
  const friend = mine ? null : FRIENDS_BY_ID[message.sender as keyof typeof FRIENDS_BY_ID];
  const name = senderName(setup, message.sender);

  return (
    <li
      id={`msg-${message.id}`}
      className={`animate-message-in scroll-mt-24 rounded-2xl ${highlighted ? "animate-flash" : ""} ${grouped ? "mt-1" : "mt-3"}`}
    >
      <div className={`flex items-end gap-2 ${mine ? "justify-end" : ""}`}>
        {friend && (grouped ? <span className="size-8 shrink-0" /> : <Avatar id={friend.id} />)}

        <div className={`flex max-w-[82%] flex-col sm:max-w-[70%] ${mine ? "items-end" : "items-start"}`}>
          <div
            className={`relative rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed shadow-sm ${
              mine ? "rounded-br-md bg-brand-strong text-white" : "rounded-bl-md border border-white/[0.06] bg-arena-800 text-ink"
            }`}
          >
            {friend && !grouped && (
              <p className="mb-0.5 text-[13px] font-semibold" style={{ color: friend.color }}>
                {name}
              </p>
            )}
            {message.replyTo && <ReplyQuote original={original} setup={setup} onJump={onJump} />}
            <p className="break-words whitespace-pre-wrap">
              <span className="sr-only">{name}: </span>
              <MessageText text={message.text} setup={setup} />
            </p>
            <time
              dateTime={new Date(message.ts).toISOString()}
              className={`float-right mt-1 ml-3 text-[10px] leading-none ${mine ? "text-white/70" : "text-faint"}`}
            >
              {formatTime(message.ts)}
            </time>
          </div>
          <Reactions reactions={message.reactions} setup={setup} alignRight={mine} />
        </div>
      </div>
    </li>
  );
}
