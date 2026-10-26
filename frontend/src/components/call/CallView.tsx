"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { MESSAGE_MAX } from "@/config/roomChats";
import type { Persona } from "@/config/personas";
import { useDictation } from "@/hooks/useDictation";
import { useHandsFree, useRecognitionLanguage, useSpeechInputSupported, useVoice, setHandsFree } from "@/hooks/useVoice";
import type { RoomChatController } from "@/hooks/useRoomChat";
import type { RoomSetup } from "@/lib/chatTypes";
import { callLook, sceneFor, YOU_LOOK } from "@/lib/call/scenes";
import { voice } from "@/lib/voice/player";
import { Avatar } from "../chat/Avatar";
import { CloseIcon, SendIcon } from "../icons";
import { CaptionsBar } from "../voice/VoiceOutput";
import type { AvatarState } from "./AnimatedAvatar";
import { CallControls } from "./CallControls";
import { CallStage, type StageTile } from "./CallStage";
import type { TileReaction } from "./CallTile";
import { useCallShortcuts } from "./useCallShortcuts";
import { YouTile } from "./YouTile";

/**
 * A room as a group video call. It shares the chat's state (`chat`), so switching
 * between Chat and Call never loses messages. Personas are animated tiles that
 * speak with lip sync while their replies are read aloud; you talk with the mic
 * (or type in the box under the stage). With hands-free on, what you say is sent
 * when you stop, and the mic opens again once the room has finished replying.
 */
export function CallView({
  chat,
  setup,
  persona,
  nameOf,
  replay,
  camera,
  behindTheScenes,
  extraControls,
  traceSheet,
  onSwitchToChat,
  onEnd,
}: {
  chat: RoomChatController;
  setup: RoomSetup;
  persona: (id: string) => Persona | undefined;
  nameOf: (id: string) => string;
  /** Demo replays: no mic, typing or camera (the replay controls sit below the call). */
  replay?: boolean;
  camera: { stream: MediaStream | null; error: string | null; onToggle: () => void; onClearError: () => void };
  behindTheScenes: { on: boolean; onToggle: () => void };
  /** The room's summary and mode buttons. */
  extraControls?: ReactNode;
  /** The docked "Behind the scenes" sheet on small screens. */
  traceSheet?: ReactNode;
  onSwitchToChat: () => void;
  onEnd: () => void;
}) {
  const { config } = chat;
  const scene = sceneFor(config.roomId);
  const { speaking, enabled, captions } = useVoice();
  const handsFree = useHandsFree();
  const micSupported = useSpeechInputSupported() && !replay;

  // --- reactions float up from the reacting persona's tile (new ones only) -------------
  const [floating, setFloating] = useState<(TileReaction & { personaId: string })[]>([]);
  const seenReactions = useRef<Set<string> | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    const all = chat.items.flatMap((item) => (item.kind === "message" ? item.reactions.map((r) => ({ key: `${item.id}:${r.friendId}:${r.emoji}`, personaId: r.friendId, emoji: r.emoji })) : []));
    if (!seenReactions.current) {
      seenReactions.current = new Set(all.map((r) => r.key));
      return;
    }
    const fresh = all.filter((r) => !seenReactions.current!.has(r.key));
    if (!fresh.length) return;
    fresh.forEach((r) => seenReactions.current!.add(r.key));
    // Shown from the next tick and gone after the float-up animation (timers outlive re-renders).
    timers.current.push(
      setTimeout(() => setFloating((f) => [...f, ...fresh]), 0),
      setTimeout(() => setFloating((f) => f.filter((r) => !fresh.includes(r))), 1600),
    );
  }, [chat.items]);

  // --- tiles --------------------------------------------------------------------------
  const messages = chat.items.filter((i) => i.kind === "message");
  const lastPersonaMessage = [...messages].reverse().find((m) => m.sender !== "user");
  const people = [...setup.participants.map((p) => ({ ...p, guest: false })), ...(setup.guests ?? []).map((g) => ({ ...g, guest: true }))];
  const tiles: StageTile[] = people.flatMap((p) => {
    const meta = persona(p.id);
    if (!meta) return [];
    const state: AvatarState =
      speaking?.speakerId === p.id ? "speaking" : chat.typing.includes(p.id) ? "thinking" : floating.some((r) => r.personaId === p.id) ? "reacting" : "idle";
    return [
      {
        persona: { id: p.id, name: p.name, color: meta.color, look: callLook(p.id, meta.look), guest: p.guest },
        state,
        expression: state === "speaking" ? (speaking?.emotion ?? "neutral") : undefined,
        reactions: floating.filter((r) => r.personaId === p.id),
      },
    ];
  });
  const activeId = speaking?.speakerId ?? chat.typing[0] ?? lastPersonaMessage?.sender ?? null;

  // --- talking: mic + an editable draft ---------------------------------------------------
  const [draft, setDraft] = useState("");
  const [micLang] = useRecognitionLanguage(setup.language);
  const relisten = useRef(false); // hands-free: open the mic again after the room replies
  const dictation = useDictation(micLang, (text, final) => {
    if (final && handsFree && text.trim()) {
      if (chat.send(text.slice(0, MESSAGE_MAX))) {
        setDraft("");
        relisten.current = true;
        return;
      }
    }
    setDraft(text.slice(0, MESSAGE_MAX));
  });
  const { start: startListening, stop: stopListening } = dictation;
  const mic = micSupported ? { listening: dictation.listening, start: startListening, stop: stopListening } : undefined;

  // Hands-free: once the room is quiet again (no replies coming, nothing being read), listen again.
  const quiet = !chat.replying && !speaking && !dictation.listening;
  useEffect(() => {
    if (!quiet || !relisten.current || !handsFree || !micSupported) return;
    const timer = setTimeout(() => {
      if (voice.get().speaking || voice.get().queued) return;
      relisten.current = false;
      startListening();
    }, 700);
    return () => clearTimeout(timer);
  }, [quiet, handsFree, micSupported, startListening]);

  function send(e?: FormEvent) {
    e?.preventDefault();
    dictation.stop();
    voice.stop(); // sending stops the room reading aloud
    if (chat.send(draft)) setDraft("");
  }

  useCallShortcuts({ onMic: mic ? dictation.toggle : undefined });

  // Screen readers hear each new message whole (the captions bar is visual).
  const announced = lastPersonaMessage ? `${nameOf(lastPersonaMessage.sender)}: ${lastPersonaMessage.text}` : "";

  // A summary (poll, offers, scorecard...) arrived: offer to see it in chat, where it can be shared or downloaded.
  const summaries = chat.items.filter((i) => i.kind !== "message").length;
  const [summariesSeen, setSummariesSeen] = useState(summaries);

  const speakerAvatar = (id: string) => {
    const meta = persona(id);
    return meta ? <Avatar persona={meta} /> : null;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p aria-live="polite" className="sr-only">
        {announced}
      </p>
      <CallStage
        scene={scene}
        tiles={tiles}
        activeId={activeId}
        you={(size) => (
          <YouTile
            key="you"
            label="You"
            look={config.roomId === "future-you" ? YOU_LOOK : undefined}
            listening={dictation.listening}
            micAvailable={micSupported}
            camera={camera.stream}
            size={size}
          />
        )}
      />

      {summaries > summariesSeen && (
        <div role="status" className="animate-fade-in mx-3 mb-2 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary-soft px-3 py-2 text-sm">
          <p className="min-w-0 flex-1 font-semibold text-primary-deep">The results are in.</p>
          <button type="button" onClick={onSwitchToChat} className="h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-deep">
            See them in chat
          </button>
          <button type="button" aria-label="Dismiss" onClick={() => setSummariesSeen(summaries)} className="grid size-8 place-items-center rounded-lg text-muted hover:text-ink">
            <CloseIcon className="size-4" />
          </button>
        </div>
      )}
      {chat.error && (
        <div role="alert" className="mx-3 mb-2 flex items-center gap-2 rounded-xl border border-con/30 bg-con-soft px-3 py-2 text-sm">
          <p className="min-w-0 flex-1">{chat.error.message}</p>
          <button type="button" onClick={chat.retry} className="h-8 rounded-lg bg-con-deep px-3 text-xs font-semibold text-white hover:bg-ink">
            Try again
          </button>
        </div>
      )}
      {(camera.error || dictation.error) && (
        <p role="alert" className="mx-3 mb-2 flex items-center gap-2 rounded-xl border border-con/30 bg-con-soft px-3 py-2 text-sm">
          <span className="flex-1">{camera.error ?? dictation.error}</span>
          <button type="button" aria-label="Dismiss" onClick={camera.error ? camera.onClearError : dictation.clearError} className="text-muted hover:text-ink">
            <CloseIcon className="size-4" />
          </button>
        </p>
      )}

      {/* Captions: the live karaoke bar while a reply is read; with voice off, the latest message. */}
      {speaking ? (
        <CaptionsBar avatar={speakerAvatar} />
      ) : (
        captions &&
        !enabled &&
        lastPersonaMessage && (
          <div className="flex items-center gap-2.5 border-t border-line bg-surface/95 px-3 py-2">
            {speakerAvatar(lastPersonaMessage.sender)}
            <p className="line-clamp-2 min-w-0 flex-1 text-sm text-muted">
              <span className="font-semibold text-ink">{nameOf(lastPersonaMessage.sender)}: </span>
              {lastPersonaMessage.text}
            </p>
          </div>
        )
      )}
      {traceSheet}

      {!replay && (
        <form onSubmit={send} className="flex items-center gap-2 border-t border-line bg-surface/95 px-3 py-2">
          <label htmlFor="call-input" className="sr-only">
            Say or type something
          </label>
          <input
            id="call-input"
            value={draft}
            maxLength={MESSAGE_MAX}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={dictation.listening ? "Listening…" : micSupported ? (handsFree ? "Tap the mic and talk, or type" : "Tap the mic, or type") : "Type a message"}
            className="h-10 min-w-0 flex-1 rounded-full border border-line-strong bg-canvas px-4 text-base text-ink placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none sm:text-sm"
          />
          <button type="submit" disabled={!draft.trim()} aria-label="Send message" className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-white transition hover:bg-primary-deep disabled:bg-sand-deep disabled:text-muted">
            <SendIcon className="size-4.5" />
          </button>
        </form>
      )}
      <CallControls
        mic={mic}
        handsFree={micSupported ? { on: handsFree, onChange: setHandsFree } : undefined}
        camera={replay ? undefined : { on: !!camera.stream, onToggle: camera.onToggle }}
        behindTheScenes={behindTheScenes}
        switchLabel="Switch to chat"
        onSwitch={onSwitchToChat}
        onEnd={onEnd}
        extra={extraControls}
      />
    </div>
  );
}
