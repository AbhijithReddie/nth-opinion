"use client";

import dynamic from "next/dynamic";
import type { RoomChatId } from "@/config/roomChats";
import { TypingIndicator } from "../TypingIndicator";

/**
 * Loads a chat room in the browser only. The room restores itself from
 * localStorage, which doesn't exist on the server, so rendering it there would
 * flash the wrong screen and cause hydration mismatches.
 */
const RoomChat = dynamic(() => import("./RoomChat"), {
  ssr: false,
  loading: () => (
    <main id="main" className="grid flex-1 place-items-center py-24 text-muted">
      <TypingIndicator label="Loading the room" />
    </main>
  ),
});

export function RoomChatLoader({ roomId }: { roomId: RoomChatId }) {
  return <RoomChat roomId={roomId} />;
}
