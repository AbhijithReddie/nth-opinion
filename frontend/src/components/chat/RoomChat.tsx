"use client";

import { useState } from "react";
import { ROOM_CHATS, type RoomChatId } from "@/config/roomChats";
import { useBehindTheScenes } from "@/hooks/useBehindTheScenes";
import { useRoomDemo } from "@/hooks/useRoomDemo";
import { isValidSetup, useRoomChat, type RoomReplayPlayback } from "@/hooks/useRoomChat";
import { ReplayClock, type RoomReplay } from "@/lib/replay";
import { ReplayRoom } from "../replay/ReplayRoom";
import { ChatScreen } from "./ChatScreen";
import { SetupScreen } from "./setup/SetupScreen";

/**
 * A chat room: its setup screen until it's set up (or while editing), then the chat.
 * "Watch a demo" swaps in the room's recorded replay; the live chat keeps its state
 * (and any reply still loading) underneath, and comes back on "Exit replay".
 */
export default function RoomChat({ roomId }: { roomId: RoomChatId }) {
  const [behindTheScenes] = useBehindTheScenes();
  const chat = useRoomChat(ROOM_CHATS[roomId], undefined, behindTheScenes);
  // The example message to pre-fill in the composer after "Try this example" on the setup screen.
  const [draft, setDraft] = useState("");
  const recording = useRoomDemo<RoomReplay>(chat.config.roomId);
  const [playback, setPlayback] = useState<RoomReplayPlayback | null>(null);
  // A recording made with an older setup (renamed persona, new required field, ...) is not offered.
  const watchDemo =
    recording && isValidSetup(chat.config, recording.setup)
      ? () => setPlayback({ recording, clock: new ReplayClock() })
      : undefined;

  if (playback) {
    return (
      <main id="main" className="flex-1">
        <ReplayRoom config={chat.config} playback={playback} onExit={() => setPlayback(null)} />
      </main>
    );
  }

  if (chat.editing || !chat.setup) {
    return (
      <main id="main" className="flex-1">
        <SetupScreen
          config={chat.config}
          initial={chat.setup}
          onSave={chat.saveSetup}
          onCancel={
            chat.setup
              ? () => {
                  setDraft("");
                  chat.cancelEdit();
                }
              : undefined
          }
          onDraft={setDraft}
          onWatchDemo={watchDemo}
        />
      </main>
    );
  }

  return (
    <main id="main" className="flex-1">
      <ChatScreen chat={chat} setup={chat.setup} initialDraft={draft} onWatchDemo={watchDemo} />
    </main>
  );
}
