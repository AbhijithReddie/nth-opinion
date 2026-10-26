"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DEBATERS } from "@/config/personas";
import { useBehindTheScenes } from "@/hooks/useBehindTheScenes";
import { useCallSession } from "@/hooks/useCallSession";
import { sceneFor } from "@/lib/call/scenes";
import { JoinCall } from "../call/JoinCall";
import { StageView } from "../call/StageView";
import { hashOf } from "@/config/voices";
import { useReadAloud } from "@/hooks/useReadAloud";
import type { SpeakRequest } from "@/lib/voice/player";
import type { DebateState } from "@/hooks/useDebate";
import { SIDES } from "@/lib/sides";
import type { Speaker, Turn } from "@/lib/types";
import { ErrorBanner } from "../ErrorBanner";
import { getRoom } from "@/config/rooms";
import { DemoNotice } from "../replay/DemoNotice";
import { DownloadReportButton } from "../share/DownloadReportButton";
import { ShareButton } from "../share/ShareDialog";
import { DecisionMemo } from "./DecisionMemo";
import { JudgeDeliberating } from "./JudgeDeliberating";
import { NewDebateButton } from "./NewDebateButton";
import { Scorecard } from "./Scorecard";
import { TopicHeader } from "./TopicHeader";
import { TurnCard } from "./TurnCard";
import { CaptionsBar } from "../voice/VoiceOutput";

const SPEAKER_NAMES = { pro: "Pro", con: "Con", judge: "The Judge" } as const;

/** What can be read aloud from a debate: each finished speech, then the decision memo. Keys change with the text, so a re-run is read again. */
export function debateSpeech(turns: Turn[], memo: string | undefined, language: string): SpeakRequest[] {
  const requests: SpeakRequest[] = turns
    .filter((t) => t.complete && t.text.trim())
    .map((t) => ({ key: `debate:${t.speaker}:${t.round}:${hashOf(t.text)}`, speakerId: t.speaker, speakerName: SPEAKER_NAMES[t.speaker], text: t.text, language }));
  if (memo) requests.push({ key: `debate:memo:${hashOf(memo)}`, speakerId: "judge", speakerName: SPEAKER_NAMES.judge, text: memo, language });
  return requests;
}

/** A small round badge for the captions bar: P, C or the gavel colour for the judge. */
function sideBadge(id: string) {
  const look = id === "pro" ? "bg-pro-soft text-pro-deep" : id === "con" ? "bg-con-soft text-con-deep" : "bg-judge-soft text-judge-deep";
  return <span aria-hidden className={`grid size-8 shrink-0 place-items-center rounded-full font-display text-sm font-semibold ${look}`}>{id === "judge" ? "J" : id === "pro" ? "P" : "C"}</span>;
}

interface DebateViewProps {
  state: DebateState;
  onNewDebate: () => void;
  onRetry: () => void;
  /** Offers the demo replay on the error, when the AI is unavailable and there's a recording. */
  onWatchDemo?: () => void;
  /** This is a demo replay (the share card says so). */
  demo?: boolean;
}

/** Who speaks next while no turn is streaming: Pro opens each round, Con answers it. */
function nextTurn(turns: Turn[]): { speaker: Speaker; round: number } {
  const last = turns.at(-1);
  if (!last) return { speaker: "pro", round: 1 };
  return last.speaker === "pro" ? { speaker: "con", round: last.round } : { speaker: "pro", round: last.round + 1 };
}

/** The live debate: topic, Pro/Con turns round by round, then the judge's verdict. */
export function DebateView({ state, onNewDebate, onRetry, onWatchDemo, demo = false }: DebateViewProps) {
  const { phase, topic, rounds, turns, verdict, error } = state;
  const verdictRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  // Read each finished speech and the memo aloud, when that's on (also for demo replays).
  const speech = useMemo(() => debateSpeech(turns, verdict?.memo, state.language), [turns, verdict, state.language]);
  useReadAloud(speech);

  // Arena or Stage mode (a video-call view of the same debate).
  const [view, setView] = useState<"chat" | "call">("chat");
  const stage = useCallSession();
  const [behindTheScenes, setBehindTheScenes] = useBehindTheScenes();
  const onStage = view === "call" && stage.joined;

  // Bring the arena into view when a debate starts, and the verdict when it lands (not over the stage).
  useEffect(() => {
    if (phase === "connecting") sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [phase]);
  useEffect(() => {
    if (verdict && !onStage) verdictRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [verdict, onStage]);

  if (phase === "idle") return null;

  // A placeholder card for whoever is about to speak, so there's never a silent gap.
  const waitingForTurn = (phase === "connecting" || phase === "debating") && turns.every((t) => t.complete);
  const pending = waitingForTurn ? nextTurn(turns) : null;
  const roundCount = Math.max(pending?.round ?? 0, ...turns.map((t) => t.round));

  /** The card for one side in one round: a real turn, the pending placeholder, or an empty slot. */
  function cell(speaker: Speaker, round: number) {
    const turn = turns.find((t) => t.speaker === speaker && t.round === round);
    if (turn) {
      const request = turn.complete ? speech.find((r) => r.speakerId === speaker && r.key.startsWith(`debate:${speaker}:${round}:`)) : undefined;
      return <TurnCard speaker={speaker} round={round} text={turn.text} streaming={!turn.complete} speech={request} />;
    }
    if (pending?.speaker === speaker && pending.round === round) {
      return <TurnCard speaker={speaker} round={round} text="" streaming />;
    }
    return <div className="hidden md:block" />; // keeps Con in the right-hand column
  }

  return (
    <section ref={sectionRef} aria-label="Debate" className="scroll-mt-24 space-y-6">
      <TopicHeader topic={topic} rounds={rounds} phase={phase} onNewDebate={onNewDebate} view={view} onView={setView} />

      {view === "call" &&
        (stage.joined ? (
          <StageView
            state={state}
            behindTheScenes={{ on: behindTheScenes, onToggle: () => setBehindTheScenes(!behindTheScenes) }}
            onSwitch={() => setView("chat")}
            onEnd={() => {
              stage.end();
              setView("chat");
            }}
          />
        ) : (
          <div className="flex h-[min(78dvh,40rem)] overflow-hidden rounded-3xl border border-line shadow-soft">
            <JoinCall title={topic} modeName="Stage mode" people={DEBATERS} onJoin={stage.join} onCancel={() => setView("chat")} background={sceneFor("debate").background} />
          </div>
        ))}

      {/* Column labels; on phones the cards stack in speaking order instead. */}
      {view === "chat" && roundCount > 0 && (
        <div className="hidden grid-cols-2 gap-5 md:grid" aria-hidden>
          {(["pro", "con"] as Speaker[]).map((s) => (
            <div key={s} className="flex items-center gap-3 px-1">
              <span className={`font-display text-lg font-semibold ${SIDES[s].text}`}>{SIDES[s].label}</span>
              <span className="text-sm text-muted">{SIDES[s].stance} the motion</span>
              <span className={`h-px flex-1 ${SIDES[s].bar} opacity-30`} />
            </div>
          ))}
        </div>
      )}

      <div className={`space-y-5 ${view === "call" ? "hidden" : ""}`}>
        {Array.from({ length: roundCount }, (_, i) => i + 1).map((round) => (
          <div key={round} className="grid items-start gap-3 md:grid-cols-2 md:gap-5">
            {cell("pro", round)}
            {cell("con", round)}
          </div>
        ))}
      </div>

      {phase === "judging" && view === "chat" && <JudgeDeliberating />}

      {verdict && (
        <div ref={verdictRef} className="scroll-mt-24 space-y-6">
          <Scorecard verdict={verdict} />
          <DecisionMemo memo={verdict.memo} topic={topic} speech={speech.find((r) => r.key.startsWith("debate:memo:"))} />
        </div>
      )}

      {phase === "error" && error && onWatchDemo && <DemoNotice kind="offer" onWatch={onWatchDemo} />}
      {phase === "error" && error && (
        <ErrorBanner message={error}>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-10 items-center rounded-xl bg-con-deep px-4 text-sm font-semibold text-white transition hover:bg-ink focus-visible:ring-2 focus-visible:ring-con/60 focus-visible:outline-none"
          >
            Try again
          </button>
          <NewDebateButton onClick={onNewDebate} />
        </ErrorBanner>
      )}

      {!onStage && <CaptionsBar avatar={sideBadge} className="sticky bottom-0 z-20 -mx-1 rounded-2xl border shadow-lift" />}

      {phase === "done" && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {verdict && <ShareButton result={{ kind: "debate", topic, verdict }} room={getRoom("debate")} demo={demo} />}
          {verdict && (
            <DownloadReportButton
              input={() => ({ kind: "debate", roomTitle: getRoom("debate").title, demo, topic, rounds, turns, verdict })}
            />
          )}
          <NewDebateButton onClick={onNewDebate} />
        </div>
      )}
    </section>
  );
}
