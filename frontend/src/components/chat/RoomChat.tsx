"use client";

import { useMemo, useState } from "react";
import { ROOM_CHATS, type RoomChatId } from "@/config/roomChats";
import { useBehindTheScenes } from "@/hooks/useBehindTheScenes";
import { useRoomDemo } from "@/hooks/useRoomDemo";
import { DOC_LABELS, useRoomDocuments } from "@/lib/documents";
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
  const demoOk = !!recording && isValidSetup(chat.config, recording.setup);
  const watchDemo = demoOk ? () => setPlayback({ recording: recording!, clock: new ReplayClock() }) : undefined;
  // ?demo=1 (the offline page's links): play the demo as soon as the recording has loaded.
  const [autoDemo, setAutoDemo] = useState(() => new URLSearchParams(window.location.search).has("demo"));
  const autoPlayback = useMemo(() => (autoDemo && demoOk ? { recording: recording!, clock: new ReplayClock() } : null), [autoDemo, demoOk, recording]);
  const active = playback ?? autoPlayback;

  // Documents live in memory only: after a reload, a room that relied on one (instead of pasted text) asks for it again.
  const documents = useRoomDocuments(chat.config.roomId);
  const missingDoc = chat.setup
    ? chat.config.contextFields.find(
        (f) => f.required && f.replacedBy && !chat.setup!.context[f.id]?.trim() && !documents.some((d) => d.doc_type === f.replacedBy),
      )?.replacedBy
    : undefined;

  if (active) {
    return (
      <main id="main" className="flex-1">
        <ReplayRoom
          config={chat.config}
          playback={active}
          onExit={() => {
            setPlayback(null);
            setAutoDemo(false);
          }}
        />
      </main>
    );
  }

  if (chat.editing || !chat.setup || missingDoc) {
    return (
      <main id="main" className="flex-1">
        <SetupScreen
          config={chat.config}
          initial={chat.setup}
          onSave={chat.saveSetup}
          notice={
            missingDoc
              ? `Please add your ${DOC_LABELS[missingDoc].toLowerCase()} again: documents are only kept until you reload or close the page.`
              : undefined
          }
          onCancel={
            chat.setup && !missingDoc
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
