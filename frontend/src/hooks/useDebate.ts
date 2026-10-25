"use client";

/**
 * All debate state lives here: a reducer that turns SSE events into a list of
 * turns, a verdict and a phase, plus start/reset actions for the UI.
 */

import { useCallback, useEffect, useReducer, useRef } from "react";
import { DebateError, streamDebate } from "@/lib/api";
import type { DebateEvent, Phase, Turn, Verdict } from "@/lib/types";

export interface DebateState {
  phase: Phase;
  topic: string;
  rounds: number;
  turns: Turn[];
  verdict: Verdict | null;
  error: string | null;
}

type Action =
  | { type: "start"; topic: string; rounds: number }
  | { type: "event"; event: DebateEvent }
  | { type: "fail"; message: string }
  | { type: "reset" };

const initialState: DebateState = {
  phase: "idle",
  topic: "",
  rounds: 2,
  turns: [],
  verdict: null,
  error: null,
};

/** Replace the newest turn by `speaker` that is still streaming. */
function updateOpenTurn(turns: Turn[], speaker: Turn["speaker"], update: (t: Turn) => Turn): Turn[] {
  const index = turns.findLastIndex((t) => t.speaker === speaker && !t.complete);
  if (index === -1) return turns;
  const next = turns.slice();
  next[index] = update(turns[index]);
  return next;
}

function applyEvent(state: DebateState, event: DebateEvent): DebateState {
  switch (event.type) {
    case "turn_start":
      return {
        ...state,
        phase: "debating",
        turns: [...state.turns, { speaker: event.speaker, round: event.round, text: "", complete: false }],
      };

    case "token":
      return {
        ...state,
        turns: updateOpenTurn(state.turns, event.speaker, (t) => ({ ...t, text: t.text + event.text })),
      };

    case "turn_end": {
      // turn_end carries the final text (with the word limit applied), so it wins over the streamed tokens.
      let turns = updateOpenTurn(state.turns, event.speaker, (t) => ({ ...t, text: event.text, complete: true }));
      if (turns === state.turns) {
        turns = [...turns, { speaker: event.speaker, round: event.round, text: event.text, complete: true }];
      }
      // Con closes each round; after Con's last round it's the judge's turn.
      const lastTurn = event.speaker === "con" && event.round >= state.rounds;
      return { ...state, turns, phase: lastTurn ? "judging" : "debating" };
    }

    case "judge":
      return {
        ...state,
        phase: "done",
        verdict: { scores: event.scores, winner: event.winner, memo: event.memo },
      };

    case "done":
      return state.verdict
        ? state
        : { ...state, phase: "error", error: "The debate ended without a verdict. Please try again." };

    case "error":
      return { ...state, phase: "error", error: event.message };
  }
}

function reducer(state: DebateState, action: Action): DebateState {
  switch (action.type) {
    case "start":
      return { ...initialState, phase: "connecting", topic: action.topic, rounds: action.rounds };
    case "event":
      // Ignore stray events after the debate has ended or been reset.
      if (state.phase === "idle" || state.phase === "error") return state;
      return applyEvent(state, action.event);
    case "fail":
      return state.phase === "error" ? state : { ...state, phase: "error", error: action.message };
    case "reset":
      return initialState;
  }
}

export function useDebate() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const controllerRef = useRef<AbortController | null>(null);

  const start = useCallback(async (topic: string, rounds: number) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    dispatch({ type: "start", topic, rounds });

    try {
      await streamDebate(topic, rounds, (event) => dispatch({ type: "event", event }), controller.signal);
    } catch (err) {
      if (controller.signal.aborted) return; // the user reset or started over; not an error
      dispatch({
        type: "fail",
        message: err instanceof DebateError ? err.message : "Something unexpected went wrong. Please try again.",
      });
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    dispatch({ type: "reset" });
  }, []);

  // Stop any running stream when the page unmounts.
  useEffect(() => () => controllerRef.current?.abort(), []);

  const running = state.phase === "connecting" || state.phase === "debating" || state.phase === "judging";
  return { state, running, start, reset };
}
