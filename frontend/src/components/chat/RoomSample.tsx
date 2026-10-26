"use client";

import type { RoomChatConfig } from "@/config/roomChats";
import type { RoomExample } from "@/config/rooms";
import type { ChatItem, ChatMessage, RoomSetup } from "@/lib/chatTypes";
import { MessageBubble } from "./MessageBubble";
import { ModeDivider } from "./ModeDivider";
import { RoomProvider } from "./RoomContext";
import { SummaryCard } from "./SummaryCard";

/** Sample times start at 7:30 pm, one minute apart. Fixed, so the sample looks the same every time. */
const SAMPLE_START = new Date(2026, 0, 1, 19, 30).getTime();

/** The setup the sample was "recorded" with: the example's title and details, and everyone who speaks. */
function sampleSetup(config: RoomChatConfig, example: RoomExample): RoomSetup {
  const speakers = new Set<string>(config.cast.defaults);
  for (const line of example.conversation) if ("sender" in line) speakers.add(line.sender);
  return {
    title: example.fill.title ?? config.title.default,
    participants: config.personas.filter((p) => speakers.has(p.id)).map((p) => ({ id: p.id, name: p.name })),
    language: "english",
    context: example.fill.context ?? {},
  };
}

function sampleItems(example: RoomExample): ChatItem[] {
  const items: ChatItem[] = example.conversation.map((line, i) => {
    const ts = SAMPLE_START + i * 60_000;
    if ("mode" in line) return { kind: "mode", id: `sample-${i}`, ts, mode: line.mode };
    return {
      kind: "message",
      id: `sample-${i}`,
      sender: line.sender,
      text: line.text,
      replyTo: line.replyTo === undefined ? null : `sample-${line.replyTo}`,
      mentions: [],
      reactions: (line.reactions ?? []).map((r) => ({ friendId: r.by, emoji: r.emoji })),
      ts,
    };
  });
  const { result } = example;
  if (result.type !== "verdict") {
    items.push({ kind: "summary", id: "sample-result", ts: SAMPLE_START + items.length * 60_000, ...result });
  }
  return items;
}

/**
 * A room's hand-written sample conversation, drawn with the real chat bubbles and
 * result card so it looks exactly like the room. Static: nothing is sent anywhere.
 */
export function RoomSample({ config, example }: { config: RoomChatConfig; example: RoomExample }) {
  const setup = sampleSetup(config, example);
  const items = sampleItems(example);
  const byId = new Map(items.filter((i): i is ChatMessage => i.kind === "message").map((m) => [m.id, m]));

  function jumpTo(id: string) {
    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <RoomProvider value={{ config, setup }}>
      <ol aria-label="Sample messages" className="flex flex-col">
        {items.map((item, i) => {
          if (item.kind === "summary") return <SummaryCard key={item.id} item={item} />;
          if (item.kind === "mode") return <ModeDivider key={item.id} mode={item.mode} />;
          const prev = items[i - 1];
          const grouped = prev?.kind === "message" && prev.sender === item.sender && !item.replyTo;
          return (
            <MessageBubble
              key={item.id}
              message={item}
              original={item.replyTo ? byId.get(item.replyTo) : undefined}
              grouped={grouped}
              highlighted={false}
              onJump={jumpTo}
            />
          );
        })}
      </ol>
    </RoomProvider>
  );
}
