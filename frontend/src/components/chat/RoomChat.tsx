"use client";

import { ROOM_CHATS, type RoomChatId } from "@/config/roomChats";
import { useRoomChat } from "@/hooks/useRoomChat";
import { ChatScreen } from "./ChatScreen";
import { SetupScreen } from "./setup/SetupScreen";

/** A chat room: its setup screen until it's set up (or while editing), then the chat. */
export default function RoomChat({ roomId }: { roomId: RoomChatId }) {
  const chat = useRoomChat(ROOM_CHATS[roomId]);

  if (chat.editing || !chat.setup) {
    return (
      <main id="main" className="flex-1">
        <SetupScreen
          config={chat.config}
          initial={chat.setup}
          onSave={chat.saveSetup}
          onCancel={chat.setup ? () => chat.cancelEdit() : undefined}
        />
      </main>
    );
  }

  return (
    <main id="main" className="flex-1">
      <ChatScreen chat={chat} setup={chat.setup} />
    </main>
  );
}
