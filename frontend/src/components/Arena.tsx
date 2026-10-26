"use client";

import { voice } from "@/lib/voice/player";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildFlow } from "@/config/flows";
import { DEBATERS } from "@/config/personas";
import { getRoom } from "@/config/rooms";
import { useBehindTheScenes, useWideScreen } from "@/hooks/useBehindTheScenes";
import { useDebate } from "@/hooks/useDebate";
import { useRoomDemo } from "@/hooks/useRoomDemo";
import { offersReplay, ReplayClock, type DebateReplay } from "@/lib/replay";
import { DebateSample } from "./debate/DebateSample";
import { DebateView } from "./debate/DebateView";
import { DebateForm } from "./landing/DebateForm";
import { Hero } from "./landing/Hero";
import { DemoNotice, slowNoticeKind } from "./replay/DemoNotice";
import { ReplayBar } from "./replay/ReplayBar";
import { TracePanel, TraceSheet, type TracePanelProps } from "./trace/TracePanel";

/**
 * The interactive part of the page: landing form on top, live debate below.
 * "Watch a demo" plays the recorded debate in a second useDebate, so a live
 * debate that is still starting (e.g. the server waking up) keeps going underneath.
 * "Behind the scenes" adds the agents' live trace: a sticky side panel on wide
 * screens, a sheet docked at the bottom on phones.
 */
export function Arena() {
  const { state, running, slow, start, reset } = useDebate();
  const demo = useDebate();
  const recording = useRoomDemo<DebateReplay>("debate");
  const [clock, setClock] = useState<ReplayClock | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Bumped on "New debate" (or "Try this example") to remount the form with a fresh topic.
  const [form, setForm] = useState({ key: 0, topic: "" });
  const room = getRoom("debate");
  const [behindTheScenes, setBehindTheScenes] = useBehindTheScenes();
  const wide = useWideScreen();
  // The panel asks the server for trace events, so the choice is read when a debate starts.
  const startDebate = (topic: string, rounds: number, language = "english") => {
    voice.stop(); // starting a debate stops anything being read aloud
    start(topic, rounds, behindTheScenes, language);
  };

  // Errors before the first turn (rate limit, server down, bad input) belong next to the form.
  const earlyError = state.phase === "error" && state.turns.length === 0 ? state.error : null;
  const showDebate = state.phase !== "idle" && !earlyError;

  // A replay that's replaced or closed drops whatever it still had waiting to play.
  useEffect(() => () => clock?.dispose(), [clock]);
  // ?demo=1 (the offline page's links): play the recorded debate as soon as it has loaded, once.
  const autoDemoDone = useRef(false);

  const replayDemo = demo.replay; // stable (useCallback)
  const watchDemo = useMemo(
    () =>
      recording
        ? () => {
            const next = new ReplayClock();
            setClock(next);
            void replayDemo(recording, next);
          }
        : undefined,
    [recording, replayDemo],
  );
  useEffect(() => {
    if (!autoDemoDone.current && watchDemo && new URLSearchParams(window.location.search).has("demo")) {
      autoDemoDone.current = true;
      watchDemo();
    }
  }, [watchDemo]);

  function exitDemo() {
    demo.reset();
    setClock(null);
  }

  // Offer the demo when the AI or server is unavailable, or while the server is slow to answer.
  const offerOnError = watchDemo && offersReplay(state.errorCode) ? watchDemo : undefined;
  const slowNotice = slowNoticeKind(slow, !!watchDemo);
  let notice = null;
  if (earlyError && offerOnError) notice = <DemoNotice kind="offer" onWatch={offerOnError} />;
  else if (slowNotice) notice = <DemoNotice kind={slowNotice} onWatch={watchDemo} />;

  // The panel follows whichever debate is on screen: the demo replay or the live one.
  const shown = clock ? demo.state : state;
  const tracePanel: TracePanelProps = {
    flow: buildFlow(room.flow, DEBATERS),
    trace: shown.trace,
    running: ["connecting", "debating", "judging"].includes(shown.phase),
    // Recordings made before "Behind the scenes" existed have no trace events.
    unavailable: !!clock && !recording?.events.some((e) => e.event === "node_start"),
    persona: (id) => DEBATERS.find((p) => p.id === id),
    nameOf: (id) => DEBATERS.find((p) => p.id === id)?.name ?? id,
    onClose: () => setBehindTheScenes(false),
  };

  function newDebate() {
    reset();
    setForm((f) => ({ key: f.key + 1, topic: "" }));
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Wait for the remount, then put the cursor back in the topic box.
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }

  /** "Try this example": put the example topic in the form and bring it into view. */
  function tryExample() {
    setForm((f) => ({ key: f.key + 1, topic: room.example.fill.message }));
    document.getElementById("debate-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }

  const panelClass = behindTheScenes ? (wide ? "grid grid-cols-[minmax(0,1fr)_20rem] gap-8" : "pb-16") : "";
  return (
    <div className={panelClass}>
      <div className="min-w-0">
        {clock && (
          <>
            <ReplayBar
              clock={clock}
              finished={demo.state.phase === "done"}
              onExit={exitDemo}
              className="sticky top-20 z-30 rounded-2xl border shadow-soft"
            />
            <div className="mt-8">
              <DebateView state={demo.state} onNewDebate={exitDemo} onRetry={exitDemo} demo />
            </div>
          </>
        )}
        {/* Hidden, not unmounted, during a replay: the typed topic and any live debate stay as they were. */}
        <div hidden={!!clock}>
          <Hero />
          <DebateForm
            key={form.key}
            initialTopic={form.topic}
            running={running}
            error={earlyError}
            notice={notice}
            onStart={startDebate}
            onWatchDemo={watchDemo}
            inputRef={inputRef}
          />
          {state.phase === "idle" && (
            <div className="mt-16">
              <DebateSample room={room} onTry={tryExample} />
            </div>
          )}
          {showDebate && (
            <div className="mt-14">
              <DebateView
                state={state}
                onNewDebate={newDebate}
                onRetry={() => startDebate(state.topic, state.rounds, state.language)}
                onWatchDemo={offerOnError}
              />
            </div>
          )}
        </div>
      </div>
      {behindTheScenes &&
        (wide ? (
          <aside className="sticky top-20 max-h-[calc(100dvh-6rem)] self-start overflow-y-auto rounded-3xl border border-line bg-surface shadow-soft">
            <TracePanel {...tracePanel} />
          </aside>
        ) : (
          <TraceSheet {...tracePanel} className="fixed inset-x-0 bottom-0 z-30 shadow-lift" />
        ))}
    </div>
  );
}
