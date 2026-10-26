"use client";

import { useId } from "react";
import { edgeMatches, type Flow, type FlowNode } from "@/config/flows";
import type { Persona } from "@/config/personas";
import type { TraceState } from "@/lib/trace";
import { PersonaFace } from "../chat/Avatar";

const BOX = { w: 84, h: 30 }; // step boxes (safety check, director, your turn)
const AVATAR_R = 21; // persona circles

export const formatMs = (ms: number) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);

/** Where a line towards (dx, dy) leaves the node's outline. */
function exitPoint(node: FlowNode, dx: number, dy: number) {
  const len = Math.hypot(dx, dy) || 1;
  const t = node.personaId
    ? (AVATAR_R + 3) / len
    : Math.min((BOX.w / 2 + 3) / Math.abs(dx || 1e-6), (BOX.h / 2 + 3) / Math.abs(dy || 1e-6));
  return { x: node.x + dx * t, y: node.y + dy * t };
}

/**
 * The room's agent graph as an SVG. The running node glows, the arrow of the
 * latest hop animates, and every node shows how long it last took.
 * Animations are switched off for people who prefer reduced motion (globals.css).
 */
export function FlowDiagram({ flow, trace, persona }: { flow: Flow; trace: TraceState; persona: (id: string) => Persona | undefined }) {
  const id = useId();
  const nodes = new Map(flow.nodes.map((n) => [n.id, n]));
  const activeLabel = flow.nodes.find((n) => n.id === trace.active)?.label;

  return (
    <svg
      viewBox="0 0 300 200"
      className="w-full"
      role="img"
      aria-label={`Diagram of how this room's agents run. ${activeLabel ? `Running now: ${activeLabel}.` : "Nothing running right now."}`}
    >
      <defs>
        {(["idle", "hot"] as const).map((kind) => (
          <marker key={kind} id={`${id}-${kind}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10Z" className={kind === "hot" ? "fill-primary-deep" : "fill-line-strong"} />
          </marker>
        ))}
      </defs>

      {flow.edges.map((edge) => {
        const from = nodes.get(edge.from)!;
        const to = nodes.get(edge.to)!;
        const hot = !!trace.hop && edgeMatches(edge, trace.hop);
        // A bent edge curves around a control point pushed sideways from the midpoint.
        const mx = (from.x + to.x) / 2 - (to.y - from.y) * (edge.bend ?? 0);
        const my = (from.y + to.y) / 2 + (to.x - from.x) * (edge.bend ?? 0);
        const a = exitPoint(from, mx - from.x, my - from.y);
        const b = exitPoint(to, mx - to.x, my - to.y);
        const marker = `url(#${id}-${hot ? "hot" : "idle"})`;
        return (
          <path
            // A new key on every hop restarts the arrow animation.
            key={`${edge.from}-${edge.to}-${hot ? trace.hop!.n : "idle"}`}
            d={`M${a.x} ${a.y}Q${mx} ${my} ${b.x} ${b.y}`}
            fill="none"
            strokeWidth={hot ? 2 : 1.5}
            className={hot ? "trace-edge-hot stroke-primary-deep" : "stroke-line-strong"}
            markerEnd={marker}
            markerStart={edge.twoWay ? marker : undefined}
          />
        );
      })}

      {flow.nodes.map((node) => {
        const active = trace.active === node.id;
        const ms = trace.durations[node.id];
        const who = node.personaId ? persona(node.personaId) : undefined;
        const labelY = node.personaId ? node.y + AVATAR_R + 13 : node.y + 4;
        return (
          <g key={node.id}>
            {node.personaId ? (
              <>
                {active && <circle cx={node.x} cy={node.y} r={AVATAR_R + 6} className="trace-node-glow fill-primary/30" />}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={AVATAR_R}
                  strokeWidth={active ? 2.5 : 1.5}
                  className={`fill-surface ${active ? "stroke-primary-deep" : "stroke-line-strong"}`}
                />
                {who && (
                  <foreignObject x={node.x - 17} y={node.y - 17} width={34} height={34}>
                    <PersonaFace look={who.look} color={who.color} className="size-[34px] rounded-full" />
                  </foreignObject>
                )}
              </>
            ) : (
              <>
                {active && (
                  <rect
                    x={node.x - BOX.w / 2 - 5}
                    y={node.y - BOX.h / 2 - 5}
                    width={BOX.w + 10}
                    height={BOX.h + 10}
                    rx={14}
                    className="trace-node-glow fill-primary/30"
                  />
                )}
                <rect
                  x={node.x - BOX.w / 2}
                  y={node.y - BOX.h / 2}
                  width={BOX.w}
                  height={BOX.h}
                  rx={10}
                  strokeWidth={active ? 2.5 : 1.5}
                  className={active ? "fill-primary-soft stroke-primary-deep" : "fill-surface stroke-line-strong"}
                />
              </>
            )}
            <text x={node.x} y={labelY} textAnchor="middle" className="fill-ink text-[11px] font-semibold">
              {node.label.length > 14 ? `${node.label.slice(0, 13)}…` : node.label}
            </text>
            {ms !== undefined && (
              <text
                x={node.x}
                y={node.personaId ? labelY + 12 : node.y + BOX.h / 2 + 12}
                textAnchor="middle"
                className="fill-muted font-mono text-[9px]"
              >
                {formatMs(ms)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
