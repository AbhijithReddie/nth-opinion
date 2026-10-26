"use client";

import { useRef, useState } from "react";
import { getRoom } from "@/config/rooms";
import { useDebate } from "@/hooks/useDebate";
import { DebateSample } from "./debate/DebateSample";
import { DebateView } from "./debate/DebateView";
import { DebateForm } from "./landing/DebateForm";
import { Hero } from "./landing/Hero";

/** The interactive part of the page: landing form on top, live debate below. */
export function Arena() {
  const { state, running, start, reset } = useDebate();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Bumped on "New debate" (or "Try this example") to remount the form with a fresh topic.
  const [form, setForm] = useState({ key: 0, topic: "" });
  const room = getRoom("debate");

  // Errors before the first turn (rate limit, server down, bad input) belong next to the form.
  const earlyError = state.phase === "error" && state.turns.length === 0 ? state.error : null;
  const showDebate = state.phase !== "idle" && !earlyError;

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

  return (
    <>
      <Hero />
      <DebateForm key={form.key} initialTopic={form.topic} running={running} error={earlyError} onStart={start} inputRef={inputRef} />
      {state.phase === "idle" && (
        <div className="mt-16">
          <DebateSample room={room} onTry={tryExample} />
        </div>
      )}
      {showDebate && (
        <div className="mt-14">
          <DebateView state={state} onNewDebate={newDebate} onRetry={() => start(state.topic, state.rounds)} />
        </div>
      )}
    </>
  );
}
