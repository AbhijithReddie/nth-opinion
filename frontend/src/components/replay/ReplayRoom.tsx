"use client";

import { useEffect } from "react";
import type { RoomChatConfig } from "@/config/roomChats";
import { useRoomChat, type RoomReplayPlayback } from "@/hooks/useRoomChat";
import { ChatScreen } from "../chat/ChatScreen";
import { ReplayBar } from "./ReplayBar";

/**
 * A chat room playing its demo recording: the same hook and ChatScreen as the
 * live room, with the replay controls in place of the composer.
 */
export function ReplayRoom({ config, playback, onExit }: { config: RoomChatConfig; playback: RoomReplayPlayback; onExit: () => void }) {
  const chat = useRoomChat(config, playback);
  // Leaving the replay: drop whatever is still waiting to play.
  useEffect(() => () => playback.clock.dispose(), [playback]);

  const finished = playback.recording.summary
    ? chat.items.some((item) => item.kind === "summary")
    : chat.items.length > 1 && !chat.replying;

  return (
    <ChatScreen
      chat={chat}
      setup={playback.recording.setup}
      replayBar={<ReplayBar clock={playback.clock} finished={finished} onExit={onExit} className="border-t" />}
      // Recordings made before "Behind the scenes" existed have no trace events.
      traceUnavailable={!playback.recording.events.some((e) => e.event === "node_start")}
    />
  );
}
