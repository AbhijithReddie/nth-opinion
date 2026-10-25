"use client";

import { useRef, useState } from "react";
import { useDebate } from "@/hooks/useDebate";
import { DebateView } from "./debate/DebateView";
import { DebateForm } from "./landing/DebateForm";
import { Hero } from "./landing/Hero";

/** The interactive part of the page: landing form on top, live debate below. */
export function Arena() {
  const { state, running, start, reset } = useDebate();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Bumped on "New debate" to remount the form, which clears its topic and rounds.
  const [formKey, setFormKey] = useState(0);

  // Errors before the first turn (rate limit, server down, bad input) belong next to the form.
  const earlyError = state.phase === "error" && state.turns.length === 0 ? state.error : null;
  const showDebate = state.phase !== "idle" && !earlyError;

  function newDebate() {
    reset();
    setFormKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Wait for the remount, then put the cursor back in the topic box.
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }

  return (
    <>
      <Hero />
      <DebateForm key={formKey} running={running} error={earlyError} onStart={start} inputRef={inputRef} />
      {showDebate && (
        <div className="mt-14">
          <DebateView state={state} onNewDebate={newDebate} onRetry={() => start(state.topic, state.rounds)} />
        </div>
      )}
    </>
  );
}
