"use client";

import { useGroupChat } from "@/hooks/useGroupChat";
import { ChatScreen } from "./ChatScreen";
import { SetupScreen } from "./setup/SetupScreen";

/** The Group Chat room: the setup screen until a group exists (or while editing it), then the chat. */
export default function GroupChat() {
  const chat = useGroupChat();

  if (chat.editing || !chat.setup) {
    return (
      <main id="main" className="flex-1">
        <SetupScreen initial={chat.setup} onSave={chat.saveSetup} onCancel={chat.setup ? () => chat.cancelEdit() : undefined} />
      </main>
    );
  }

  return (
    <main id="main" className="flex-1">
      <ChatScreen chat={chat} setup={chat.setup} />
    </main>
  );
}
