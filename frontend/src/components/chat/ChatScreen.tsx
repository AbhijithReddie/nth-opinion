"use client";

import { useMemo, useState, type ReactNode } from "react";
import { buildFlow } from "@/config/flows";
import { resolvePersona } from "@/config/roomChats";
import { getRoom } from "@/config/rooms";
import { useBehindTheScenes, useWideScreen } from "@/hooks/useBehindTheScenes";
import { useReadAloud } from "@/hooks/useReadAloud";
import { useCallSession } from "@/hooks/useCallSession";
import { sceneFor } from "@/lib/call/scenes";
import { CallView } from "../call/CallView";
import { JoinCall } from "../call/JoinCall";
import type { RoomChatController } from "@/hooks/useRoomChat";
import type { RoomSetup } from "@/lib/chatTypes";
import { offersReplay } from "@/lib/replay";
import type { SpeakRequest } from "@/lib/voice/player";
import { CloseIcon, RefreshIcon } from "../icons";
import { DemoNotice, slowNoticeKind } from "../replay/DemoNotice";
import { TracePanel, TraceSheet, type TracePanelProps } from "../trace/TracePanel";
import { CaptionsBar } from "../voice/VoiceOutput";
import { Avatar } from "./Avatar";
import { ChatHeader } from "./ChatHeader";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";
import { RoomProvider } from "./RoomContext";
import { SafetyBanner } from "./SafetyBanner";

/**
 * The chat itself: header, support banner, messages, any error, and the composer.
 * Fills the screen below the navbar (64px + its 1px bottom border), so only the message list scrolls.
 * `initialDraft` pre-fills the composer, e.g. after "Try this example" on the setup screen.
 * `onWatchDemo` (rooms with a recording) offers the demo replay when the AI is slow or unavailable.
 * `replayBar` turns this into a replay: the controls replace the composer and the chat menu.
 * With "Behind the scenes" on, the agents' live trace sits beside the chat (a docked
 * sheet above the composer on phones), so the conversation stays usable.
 * The header's Chat / Call switch shows the same conversation as a group video call
 * (components/call/CallView.tsx); both views share `chat`, so nothing is lost.
 */
export function ChatScreen({
  chat,
  setup,
  initialDraft = "",
  onWatchDemo,
  replayBar,
  traceUnavailable = false,
}: {
  chat: RoomChatController;
  setup: RoomSetup;
  initialDraft?: string;
  onWatchDemo?: () => void;
  replayBar?: ReactNode;
  /** A replay recorded without trace events. */
  traceUnavailable?: boolean;
}) {
  const { config } = chat;
  // Rooms with modes get a button that switches to the next mode (Roast -> Toast -> Roast...).
  const modes = config.modes ?? [];
  const nextMode = modes.length > 1 ? modes[(modes.findIndex((m) => m.id === chat.mode) + 1) % modes.length] : undefined;
  // Bumping `key` remounts the composer with new text (from "Try this example" in the empty chat).
  const [draft, setDraft] = useState({ text: initialDraft, key: 0 });

  function clearChat() {
    if (window.confirm("Clear this chat? Your setup stays, the messages are deleted.")) chat.clearChat();
  }

  const [behindTheScenes, setBehindTheScenes] = useBehindTheScenes();
  const wide = useWideScreen();
  const trace: TracePanelProps = {
    flow: buildFlow(getRoom(config.roomId).flow, [...setup.participants, ...(setup.guests ?? []).map((g) => ({ ...g, guest: true }))]),
    trace: chat.trace,
    running: chat.replying,
    unavailable: traceUnavailable,
    persona: (id) => resolvePersona(config, setup, id),
    nameOf: (id) =>
      [...setup.participants, ...(setup.guests ?? [])].find((p) => p.id === id)?.name ?? resolvePersona(config, setup, id)?.name ?? "Someone",
    onClose: () => setBehindTheScenes(false),
  };

  // Read new replies aloud (when that's on): persona messages and the support banner, never reactions.
  const readable = useMemo<SpeakRequest[]>(() => {
    const requests: SpeakRequest[] = chat.items.flatMap((item) =>
      item.kind === "message" && item.sender !== "user"
        ? [{ key: item.id, speakerId: item.sender, speakerName: trace.nameOf(item.sender), text: item.text, language: setup.language, emotion: item.emotion }]
        : [],
    );
    if (chat.safety) requests.push({ key: `safety:${chat.safety}`, speakerId: "system", speakerName: "Support", text: chat.safety });
    return requests;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- names only change with the setup
  }, [chat.items, chat.safety, setup]);
  useReadAloud(readable);
  const speakerAvatar = (id: string) => {
    const meta = resolvePersona(config, setup, id);
    return meta ? <Avatar persona={meta} /> : null;
  };

  // Chat or Call view of the same conversation.
  const [view, setView] = useState<"chat" | "call">("chat");
  const call = useCallSession();
  const inCall = view === "call";
  const scene = sceneFor(config.roomId);
  const everyone = [...setup.participants, ...(setup.guests ?? [])];
  const callControls = (
    <>
      {!replayBar && (
        <button
          type="button"
          onClick={chat.requestSummary}
          disabled={!chat.hasUserMessage || chat.summarizing}
          className="inline-flex h-11 items-center rounded-full border border-primary/30 bg-primary-soft px-3.5 text-sm font-semibold text-primary-deep transition hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none disabled:opacity-40"
        >
          {chat.summarizing ? config.summary.loading : config.summary.button}
        </button>
      )}
      {nextMode && !replayBar && (
        <button
          type="button"
          onClick={() => chat.switchMode(nextMode.id)}
          className="inline-flex h-11 items-center rounded-full border border-line-strong bg-surface px-3.5 text-sm font-semibold text-ink transition hover:bg-sand focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
        >
          {nextMode.switchLabel}
        </button>
      )}
    </>
  );

  const slowNotice = slowNoticeKind(chat.slow, !!onWatchDemo);
  const errorActions = (
    <>
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
    </>
  );

  return (
    <RoomProvider
      value={{
        config,
        setup,
        demo: !!replayBar,
        items: chat.items,
        userTexts: chat.items.flatMap((item) => (item.kind === "message" && item.sender === "user" ? [item.text] : [])),
      }}
    >
      <div className={behindTheScenes && wide ? "mx-auto flex w-full max-w-6xl" : "contents"}>
        <div className={`mx-auto flex h-[calc(100dvh-65px)] w-full min-w-0 flex-col overflow-hidden chat-paper sm:border-x sm:border-line sm:shadow-soft ${inCall ? "max-w-6xl" : "max-w-3xl"}`}>
          <ChatHeader
            typing={chat.typing}
            mode={chat.mode}
            // No menu in a replay: there's nothing to edit or clear.
            onEdit={replayBar ? undefined : chat.editSetup}
            onClearChat={replayBar ? undefined : clearChat}
            onWatchDemo={onWatchDemo}
            view={view}
            onView={setView}
            callName={scene.name}
          />
          {chat.safety && <SafetyBanner text={chat.safety} onDismiss={chat.dismissSafety} />}

          {inCall ? (
            call.joined ? (
              <CallView
                chat={chat}
                setup={setup}
                persona={trace.persona}
                nameOf={trace.nameOf}
                replay={!!replayBar}
                camera={{ stream: call.camera, error: call.cameraError, onToggle: call.toggleCamera, onClearError: call.clearCameraError }}
                behindTheScenes={{ on: behindTheScenes, onToggle: () => setBehindTheScenes(!behindTheScenes) }}
                extraControls={callControls}
                traceSheet={behindTheScenes && !wide ? <TraceSheet {...trace} /> : null}
                onSwitchToChat={() => setView("chat")}
                onEnd={() => {
                  call.end();
                  setView("chat");
                }}
              />
            ) : (
              <JoinCall
                title={setup.title}
                modeName={scene.name}
                people={everyone.flatMap((p) => {
                  const meta = trace.persona(p.id);
                  return meta ? [{ ...meta, name: p.name }] : [];
                })}
                onJoin={call.join}
                onCancel={() => setView("chat")}
                background={scene.background}
              />
            )
          ) : (
          <>
          <MessageList items={chat.items} typing={chat.typing} onTryExample={(text) => setDraft((d) => ({ text, key: d.key + 1 }))} />

          {chat.error &&
            (onWatchDemo && offersReplay(chat.error.code) ? (
              <DemoNotice kind="offer" onWatch={onWatchDemo} className="mx-3 mb-2 sm:mx-4">
                {errorActions}
              </DemoNotice>
            ) : (
              <div role="alert" className="animate-fade-in mx-3 mb-2 flex items-center gap-2 rounded-xl border border-con/30 bg-con-soft px-3 py-2 text-sm sm:mx-4">
                <p className="min-w-0 flex-1 text-ink">{chat.error.message}</p>
                {errorActions}
              </div>
            ))}
          {!chat.error && slowNotice && <DemoNotice kind={slowNotice} onWatch={onWatchDemo} className="mx-3 mb-2 sm:mx-4" />}
          {behindTheScenes && !wide && <TraceSheet {...trace} />}
          <CaptionsBar avatar={speakerAvatar} />

          {!replayBar && (
            <Composer
              key={draft.key}
              initialText={draft.text}
              autoFocus={draft.key > 0 || !!initialDraft}
              onSend={chat.send}
              language={setup.language}
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
          )}
          </>
          )}
          {/* One place for both views, so switching never remounts it (it holds the pause state). */}
          {replayBar}
        </div>
        {behindTheScenes && wide && (
          <aside className="h-[calc(100dvh-65px)] w-88 shrink-0 overflow-y-auto border-r border-line bg-surface">
            <TracePanel {...trace} />
          </aside>
        )}
      </div>
    </RoomProvider>
  );
}
