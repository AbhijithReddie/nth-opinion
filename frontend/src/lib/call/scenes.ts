/**
 * Call mode: how each room's call looks. `arrangement` places the tiles (desktop;
 * phones always use the spotlight layout), `decor` adds the room's set piece
 * (components/call/SceneDecor.tsx), `background` is the room-themed backdrop.
 */

import type { AvatarLook } from "@/config/personas";

export type Arrangement =
  /** A cosy grid: everyone together, you included. */
  | "grid"
  /** The cast in a row, facing you; you sit opposite (Pitch Tank, Interview Panel, Study Group, Roast & Toast). */
  | "facing"
  /** You in the middle, the others either side (Future You). */
  | "sides"
  /** Two podiums, the judge raised in the centre (Debate Arena's Stage mode). */
  | "podiums";

export type Decor = "none" | "spotlight" | "table" | "classroom" | "stage-mic" | "timeline" | "podiums";

export interface CallScene {
  arrangement: Arrangement;
  decor: Decor;
  /** Tailwind classes for the backdrop (Chai & Sage room colours). */
  background: string;
  /** What the call is called in this room ("Stage mode" for the debate). */
  name: string;
}

const SCENES: Record<string, CallScene> = {
  "group-chat": { arrangement: "grid", decor: "none", background: "bg-linear-to-b from-room-group-chat/25 to-canvas", name: "Call" },
  "shark-tank": { arrangement: "facing", decor: "spotlight", background: "bg-linear-to-b from-room-pitch/30 to-canvas", name: "Call" },
  "interview-panel": { arrangement: "facing", decor: "table", background: "bg-linear-to-b from-room-interview/25 to-canvas", name: "Call" },
  "future-you": { arrangement: "sides", decor: "timeline", background: "bg-linear-to-b from-room-future/30 to-canvas", name: "Call" },
  "study-group": { arrangement: "facing", decor: "classroom", background: "bg-linear-to-b from-room-study/25 to-canvas", name: "Call" },
  "roast-and-toast": { arrangement: "facing", decor: "stage-mic", background: "bg-linear-to-b from-room-roast/30 to-canvas", name: "Call" },
  debate: { arrangement: "podiums", decor: "podiums", background: "bg-linear-to-b from-room-debate/30 to-canvas", name: "Stage mode" },
};

export function sceneFor(roomId: string): CallScene {
  return SCENES[roomId] ?? SCENES["group-chat"];
}

/** The user's own avatar in Future You (and the base for their future selves). */
export const YOU_LOOK: AvatarLook = { skin: 3, hair: "tousled", hairColor: "black", mood: "smile" };

/**
 * Future You: the user's avatar aged. At 30 a little more settled; at 50 grey hair,
 * glasses and softer, rounder features. Original artwork only, never a real face.
 */
export function agedLook(years: 30 | 50, base: AvatarLook = YOU_LOOK): AvatarLook {
  if (years === 30) return { ...base, mood: "smile", extras: [...(base.extras ?? []), "stubble"] };
  return { ...base, face: "round", hairColor: "grey", mood: "calm", extras: ["round-glasses"] };
}

/** Looks used in call mode: Future You's selves are age variants of the user's avatar. */
export function callLook(personaId: string, look: AvatarLook): AvatarLook {
  if (personaId === "you30") return agedLook(30);
  if (personaId === "you50") return agedLook(50);
  return look;
}
