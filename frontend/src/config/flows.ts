/**
 * The "Behind the scenes" diagrams. Each room's `flow` (config/rooms.ts) says
 * how its agents run; buildFlow turns that and the people in the room into
 * nodes and arrows. Node ids match the backend's trace events
 * ("safety_check", "director", "persona:<id>", "your_turn", "pro", "con", "judge").
 * Coordinates are in the diagram's 300 x 200 viewBox.
 */

export type FlowKind = "director" | "debate";

export interface FlowNode {
  id: string;
  label: string;
  x: number;
  y: number;
  /** A persona's avatar (with `personaId`), or a labelled box for the other steps. */
  personaId?: string;
}

export interface FlowEdge {
  from: string;
  to: string;
  /** Arrowheads at both ends: the director <-> persona loop. */
  twoWay?: boolean;
  /** Bend the arrow sideways (positive = to the left of its direction). */
  bend?: number;
}

export interface Flow {
  kind: FlowKind;
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** "What am I looking at?", in 3-4 sentences. */
  explainer: string;
}

const EXPLAINERS: Record<FlowKind, string> = {
  director:
    "Every persona here is its own AI agent with a personality. Before anyone replies, a safety check reads your " +
    "message and switches the room to supportive mode if you seem to be struggling. Then a separate director agent " +
    "reads the chat and decides, one step at a time, who speaks, who reacts, or when to hand it back to you, while " +
    "rules in the code make sure nobody dominates. The diagram lights up each step as it happens.",
  debate:
    "Pro and Con are two AI agents arguing opposite sides of your motion. Pro opens each round and Con rebuts it, " +
    "for as many rounds as you chose. Then a Judge agent reads the whole transcript and scores both sides on logic, " +
    "evidence and rebuttal. The diagram lights up each step as it happens.",
};

export function buildFlow(kind: FlowKind, people: { id: string; name: string }[]): Flow {
  if (kind === "debate") {
    const name = (id: string) => people.find((p) => p.id === id)?.name ?? id;
    return {
      kind,
      nodes: [
        { id: "pro", label: name("pro"), x: 60, y: 50, personaId: "pro" },
        { id: "con", label: name("con"), x: 240, y: 50, personaId: "con" },
        { id: "judge", label: name("judge"), x: 150, y: 140, personaId: "judge" },
      ],
      edges: [
        { from: "pro", to: "con", bend: 0.25 },
        { from: "con", to: "pro", bend: 0.25 }, // the next round
        { from: "con", to: "judge" },
      ],
      explainer: EXPLAINERS.debate,
    };
  }

  // Room engine: safety check -> director -> (persona -> director)* -> your turn.
  const personas = people.map((p, i) => ({
    id: `persona:${p.id}`,
    label: p.name,
    x: Math.round((300 * (i + 0.5)) / people.length),
    y: 140,
    personaId: p.id,
  }));
  return {
    kind,
    nodes: [
      { id: "safety_check", label: "Safety check", x: 52, y: 36 },
      { id: "director", label: "Director", x: 150, y: 36 },
      { id: "your_turn", label: "Your turn", x: 248, y: 36 },
      ...personas,
    ],
    edges: [
      { from: "safety_check", to: "director" },
      { from: "director", to: "your_turn" },
      ...personas.map((p) => ({ from: "director", to: p.id, twoWay: true })),
    ],
    explainer: EXPLAINERS.director,
  };
}

/** True if the hop between two nodes travelled along this edge. */
export function edgeMatches(edge: FlowEdge, hop: { from: string; to: string }): boolean {
  return (edge.from === hop.from && edge.to === hop.to) || (!!edge.twoWay && edge.from === hop.to && edge.to === hop.from);
}
