"use client";

import dynamic from "next/dynamic";
import { TypingIndicator } from "../TypingIndicator";

/**
 * Loads the Group Chat in the browser only. The chat restores itself from
 * localStorage, which doesn't exist on the server, so rendering it there would
 * flash the wrong screen and cause hydration mismatches.
 */
const GroupChat = dynamic(() => import("./GroupChat"), {
  ssr: false,
  loading: () => (
    <main id="main" className="grid flex-1 place-items-center py-24 text-muted">
      <TypingIndicator label="Loading the group chat" />
    </main>
  ),
});

export function GroupChatLoader() {
  return <GroupChat />;
}
