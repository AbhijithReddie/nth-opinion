"use client";

import { DEBATERS } from "@/config/personas";
import type { DebateState } from "@/hooks/useDebate";
import { useVoice } from "@/hooks/useVoice";
import type { Speaker } from "@/lib/types";
import { sceneFor } from "@/lib/call/scenes";
import { Avatar } from "../chat/Avatar";
import { CaptionsBar } from "../voice/VoiceOutput";
import type { AvatarState } from "./AnimatedAvatar";
import { CallControls } from "./CallControls";
import { CallStage, type StageTile } from "./CallStage";
import { useCallShortcuts } from "./useCallShortcuts";

const ROLES: Record<string, string> = { pro: "For the motion", con: "Against the motion", judge: "Scores both sides" };

/**
 * The Debate Arena's "Stage mode": Pro and Con at their podiums, the Judge raised in
 * the middle, each speech read aloud with lip sync and captions. It shows the same
 * debate as the Arena view; the verdict still appears below.
 */
export function StageView({
  state,
  behindTheScenes,
  onSwitch,
  onEnd,
}: {
  state: DebateState;
  behindTheScenes: { on: boolean; onToggle: () => void };
  onSwitch: () => void;
  onEnd: () => void;
}) {
  const { speaking, enabled, captions } = useVoice();
  const scene = sceneFor("debate");
  const { phase, turns } = state;
  useCallShortcuts({});

  // Who's "thinking": the side whose speech is still being written, or the judge while judging.
  const streaming = turns.find((t) => !t.complete);
  const last = turns.at(-1);
  const nextUp: Speaker | null = phase === "connecting" || (phase === "debating" && !streaming) ? (!last || last.speaker === "con" ? "pro" : "con") : null;
  const thinking = phase === "judging" ? "judge" : (streaming?.speaker ?? nextUp);

  const tiles: StageTile[] = DEBATERS.map((p) => {
    const avatarState: AvatarState = speaking?.speakerId === p.id ? "speaking" : thinking === p.id ? "thinking" : "idle";
    return { persona: { id: p.id, name: p.name, color: p.color, look: p.look, role: ROLES[p.id] }, state: avatarState, reactions: [] };
  });
  const activeId = speaking?.speakerId ?? thinking ?? "judge";
  const latest = streaming ?? last;
  const finished = turns.filter((t) => t.complete).at(-1);

  return (
    <div className="flex h-[min(78dvh,46rem)] flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-soft">
      <p aria-live="polite" className="sr-only">
        {finished ? `${finished.speaker === "pro" ? "Pro" : "Con"}, round ${finished.round}: ${finished.text}` : ""}
      </p>
      <CallStage scene={scene} tiles={tiles} activeId={activeId} you={null} />
      {speaking ? (
        <CaptionsBar avatar={(id) => {
          const meta = DEBATERS.find((d) => d.id === id);
          return meta ? <Avatar persona={meta} /> : null;
        }} />
      ) : (
        captions &&
        !enabled &&
        latest?.text && (
          // Voice off: the speech as it's written, as a caption.
          <p className="line-clamp-2 border-t border-line bg-surface/95 px-4 py-2 text-sm text-muted">
            <span className="font-semibold text-ink">{latest.speaker === "pro" ? "Pro" : "Con"}: </span>
            {latest.text}
          </p>
        )
      )}
      <CallControls behindTheScenes={behindTheScenes} switchLabel="Switch to arena" onSwitch={onSwitch} onEnd={onEnd} />
    </div>
  );
}
