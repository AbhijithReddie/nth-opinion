"use client";

import type { ReactNode } from "react";
import type { Emotion } from "@/lib/chatTypes";
import type { CallScene } from "@/lib/call/scenes";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { AvatarState } from "./AnimatedAvatar";
import { CallTile, type TilePersona, type TileReaction } from "./CallTile";
import { Podium, SceneDecor } from "./SceneDecor";

export interface StageTile {
  persona: TilePersona;
  state: AvatarState;
  expression?: Emotion;
  reactions: TileReaction[];
}

/**
 * The call's stage. Desktop: the room's arrangement on its themed backdrop.
 * Phones: a spotlight on the active speaker, everyone else in a scrollable strip.
 * `you` renders the user's tile at a given size (null: no user tile, e.g. the debate).
 */
export function CallStage({
  scene,
  tiles,
  activeId,
  you,
}: {
  scene: CallScene;
  tiles: StageTile[];
  /** Who the phone spotlight follows: the speaker, or whoever is thinking or spoke last. */
  activeId: string | null;
  you: ((size: "spotlight" | "tile" | "strip") => ReactNode) | null;
}) {
  const desktop = useMediaQuery("(min-width: 768px)");
  const tile = (t: StageTile, size: "spotlight" | "tile" | "strip" = "tile") => <CallTile key={t.persona.id} {...t} size={size} />;

  if (!desktop) {
    const active = tiles.find((t) => t.persona.id === activeId) ?? tiles[0];
    const others = tiles.filter((t) => t !== active);
    return (
      <div className={`flex min-h-0 flex-1 flex-col ${scene.background}`}>
        <div className="grid min-h-0 flex-1 place-items-center px-4 py-3">{active && tile(active, "spotlight")}</div>
        <div className="scroll-thin flex shrink-0 gap-2 overflow-x-auto px-3 pb-3" aria-label="Everyone in the call">
          {others.map((t) => tile(t, "strip"))}
          {you?.("strip")}
        </div>
      </div>
    );
  }

  const cast = tiles.map((t) => tile(t));
  let layout: ReactNode;
  switch (scene.arrangement) {
    case "facing":
      layout = (
        <div className="relative z-10 flex h-full flex-col items-center justify-between gap-6 py-6">
          <div className="flex flex-wrap items-end justify-center gap-5">{cast}</div>
          {you?.("tile")}
        </div>
      );
      break;
    case "sides": {
      const half = Math.ceil(tiles.length / 2);
      layout = (
        <div className="relative z-10 flex h-full items-center justify-center gap-6 lg:gap-10">
          {cast.slice(0, half)}
          {you?.("tile")}
          {cast.slice(half)}
        </div>
      );
      break;
    }
    case "podiums": {
      // Pro on the left, the judge raised in the middle, Con on the right.
      const order = ["pro", "judge", "con"].map((id) => tiles.find((t) => t.persona.id === id)).filter(Boolean) as StageTile[];
      layout = (
        <div className="relative z-10 flex h-full items-center justify-center gap-6 lg:gap-12">
          {order.map((t) => (
            <div key={t.persona.id} className={t.persona.id === "judge" ? "mb-10" : ""}>
              {tile(t)}
              <Podium color={t.persona.color} tall={t.persona.id === "judge"} />
            </div>
          ))}
        </div>
      );
      break;
    }
    default:
      layout = (
        <div className="relative z-10 flex h-full flex-wrap content-center items-center justify-center gap-5">
          {cast}
          {you?.("tile")}
        </div>
      );
  }

  return (
    <div className={`relative min-h-0 flex-1 overflow-hidden px-4 ${scene.background}`}>
      <SceneDecor decor={scene.decor} />
      {layout}
    </div>
  );
}
