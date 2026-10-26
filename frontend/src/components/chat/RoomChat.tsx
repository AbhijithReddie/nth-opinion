"use client";

import { useState } from "react";
import { ROOM_CHATS, type RoomChatId } from "@/config/roomChats";
import { useRoomChat } from "@/hooks/useRoomChat";
import { ChatScreen } from "./ChatScreen";
import { SetupScreen } from "./setup/SetupScreen";

/** A chat room: its setup screen until it's set up (or while editing), then the chat. */
export default function RoomChat({ roomId }: { roomId: RoomChatId }) {
  const chat = useRoomChat(ROOM_CHATS[roomId]);
  // The example message to pre-fill in the composer after "Try this example" on the setup screen.
  const [draft, setDraft] = useState("");

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
        />
      </main>
    );
  }

  return (
    <main id="main" className="flex-1">
      <ChatScreen chat={chat} setup={chat.setup} initialDraft={draft} />
    </main>
  );
}
