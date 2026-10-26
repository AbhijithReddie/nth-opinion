/**
 * "Behind the scenes" mode: the backend's trace events (sent when a request has
 * behind_the_scenes: true, see backend/agent_trace.py) and a small reducer that
 * turns them, plus the normal room events, into what the panel shows for the
 * current turn.
 */

export type TraceEvent =
  | { type: "node_start"; node: string; label: string; round?: number }
  | { type: "node_end"; node: string; duration_ms: number }
  | { type: "director_decision"; action: "speak" | "react" | "end"; persona_id?: string | null; reply_to?: string | null; reason: string }
  | { type: "safety_check"; mode: "normal" | "supportive" };

export const TRACE_EVENT_TYPES = ["node_start", "node_end", "director_decision", "safety_check"];

export interface TraceDecision {
  id: number;
  action: "speak" | "react" | "end";
  personaId: string | null;
  reason: string;
  /** How long the director took, once its node has finished. */
  durationMs: number | null;
}

export interface TraceRun {
  id: number;
  node: string;
  label: string;
  durationMs: number | null;
}

export interface TraceState {
  /** The node running right now, if any. */
  active: string | null;
  /** The last hop between nodes; `n` changes on every hop so the arrow animation restarts. */
  hop: { from: string; to: string; n: number } | null;
  /** The node that ran last (where the next hop starts). */
  last: string | null;
  /** Each node's most recent duration. */
  durations: Record<string, number>;
  /** Director decisions this turn, newest first. */
  decisions: TraceDecision[];
  /** Node runs this turn, newest first (the Debate Arena's timeline). */
  runs: TraceRun[];
  safety: "normal" | "supportive" | null;
  round: number | null;
  messages: number;
  reactions: number;
  nodeRuns: number;
  /** Time spent inside nodes this turn (the agents' working time). */
  totalMs: number;
  /** True once any trace event has arrived. */
  hasTrace: boolean;
}

export const EMPTY_TRACE: TraceState = {
  active: null,
  hop: null,
  last: null,
  durations: {},
  decisions: [],
  runs: [],
  safety: null,
  round: null,
  messages: 0,
  reactions: 0,
  nodeRuns: 0,
  totalMs: 0,
  hasTrace: false,
};

/** Apply any room or debate event; events that aren't about the trace only update the counts. */
export function applyTrace(state: TraceState, event: { type: string }): TraceState {
  const e = event as TraceEvent | { type: "message" | "turn_end" | "reaction" };
  switch (e.type) {
    case "message":
    case "turn_end":
      return { ...state, messages: state.messages + 1 };
    case "reaction":
      return { ...state, reactions: state.reactions + 1 };
    case "node_start": {
      const id = state.runs.length + 1;
      return {
        ...state,
        hasTrace: true,
        active: e.node,
        hop: state.last ? { from: state.last, to: e.node, n: (state.hop?.n ?? 0) + 1 } : state.hop,
        round: e.round ?? state.round,
        runs: [{ id, node: e.node, label: e.label, durationMs: null }, ...state.runs],
      };
    }
    case "node_end": {
      const ms = Math.max(0, e.duration_ms);
      const finishRun = state.runs.findIndex((r) => r.node === e.node && r.durationMs === null);
      const finishDecision = state.decisions.findIndex((d) => d.durationMs === null);
      return {
        ...state,
        hasTrace: true,
        active: state.active === e.node ? null : state.active,
        last: e.node,
        durations: { ...state.durations, [e.node]: ms },
        runs: state.runs.map((r, i) => (i === finishRun ? { ...r, durationMs: ms } : r)),
        // The director's node ends right after its decision: that's how long the decision took.
        decisions:
          e.node === "director" ? state.decisions.map((d, i) => (i === finishDecision ? { ...d, durationMs: ms } : d)) : state.decisions,
        nodeRuns: state.nodeRuns + 1,
        totalMs: state.totalMs + ms,
      };
    }
    case "director_decision":
      return {
        ...state,
        hasTrace: true,
        decisions: [
          { id: state.decisions.length + 1, action: e.action, personaId: e.persona_id ?? null, reason: e.reason, durationMs: null },
          ...state.decisions,
        ],
      };
    case "safety_check":
      return { ...state, hasTrace: true, safety: e.mode };
    default:
      return state;
  }
}
