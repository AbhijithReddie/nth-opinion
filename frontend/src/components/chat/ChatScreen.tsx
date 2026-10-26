"use client";

import { useState } from "react";
import type { RoomChatController } from "@/hooks/useRoomChat";
import type { RoomSetup } from "@/lib/chatTypes";
import { CloseIcon, RefreshIcon } from "../icons";
import { ChatHeader } from "./ChatHeader";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";
import { RoomProvider } from "./RoomContext";
import { SafetyBanner } from "./SafetyBanner";

/**
 * The chat itself: header, support banner, messages, any error, and the composer.
 * Fills the screen below the navbar (64px + its 1px bottom border), so only the message list scrolls.
 * `initialDraft` pre-fills the composer, e.g. after "Try this example" on the setup screen.
 */
export function ChatScreen({ chat, setup, initialDraft = "" }: { chat: RoomChatController; setup: RoomSetup; initialDraft?: string }) {
  const { config } = chat;
  // Rooms with modes get a button that switches to the next mode (Roast -> Toast -> Roast...).
  const modes = config.modes ?? [];
  const nextMode = modes.length > 1 ? modes[(modes.findIndex((m) => m.id === chat.mode) + 1) % modes.length] : undefined;
  // Bumping `key` remounts the composer with new text (from "Try this example" in the empty chat).
  const [draft, setDraft] = useState({ text: initialDraft, key: 0 });

  function clearChat() {
    if (window.confirm("Clear this chat? Your setup stays, the messages are deleted.")) chat.clearChat();
  }

  return (
    <RoomProvider value={{ config, setup }}>
      <div className="mx-auto flex h-[calc(100dvh-65px)] w-full max-w-3xl flex-col overflow-hidden chat-paper sm:border-x sm:border-line sm:shadow-soft">
        <ChatHeader typing={chat.typing} mode={chat.mode} onEdit={chat.editSetup} onClearChat={clearChat} />
        {chat.safety && <SafetyBanner text={chat.safety} onDismiss={chat.dismissSafety} />}

        <MessageList items={chat.items} typing={chat.typing} onTryExample={(text) => setDraft((d) => ({ text, key: d.key + 1 }))} />

        {chat.error && (
          <div role="alert" className="animate-fade-in mx-3 mb-2 flex items-center gap-2 rounded-xl border border-con/30 bg-con-soft px-3 py-2 text-sm sm:mx-4">
            <p className="min-w-0 flex-1 text-ink">{chat.error.message}</p>
            <button
              type="button"
              onClick={chat.retry}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-con-deep px-2.5 text-xs font-semibold text-white transition hover:bg-ink focus-visible:ring-2 focus-visible:ring-con/60 focus-visible:outline-none"
            >
              <RefreshIcon className="size-3.5" /> Try again
            </button>
            <button
              type="button"
              onClick={chat.dismissError}
              aria-label="Dismiss error"
              className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-ink focus-visible:ring-2 focus-visible:ring-con/60 focus-visible:outline-none"
            >
              <CloseIcon className="size-4" />
            </button>
          </div>
        )}

        <Composer
          key={draft.key}
          initialText={draft.text}
          autoFocus={draft.key > 0 || !!initialDraft}
          onSend={chat.send}
          onSummary={chat.requestSummary}
          canSummarize={chat.hasUserMessage}
          summarizing={chat.summarizing}
          replying={chat.replying}
          labels={{
            summary: config.summary.button,
            summaryLoading: config.summary.loading,
            placeholder: config.composer.placeholder,
            note: config.composer.note,
          }}
          modeSwitch={nextMode && { label: nextMode.switchLabel, onClick: () => chat.switchMode(nextMode.id) }}
        />
      </div>
    </RoomProvider>
  );
}
