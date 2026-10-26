"use client";

import Link from "next/link";
import { useId, useState } from "react";
import type { Flow } from "@/config/flows";
import type { Persona } from "@/config/personas";
import type { TraceDecision, TraceState } from "@/lib/trace";
import { Avatar } from "../chat/Avatar";
import { ChevronDownIcon, CloseIcon, EyeIcon, HeartIcon } from "../icons";
import { FlowDiagram, formatMs } from "./FlowDiagram";

export interface TracePanelProps {
  flow: Flow;
  trace: TraceState;
  /** A request is in progress (the room is replying, or the debate is running). */
  running: boolean;
  /** A replay recorded without trace events. */
  unavailable?: boolean;
  persona: (id: string) => Persona | undefined;
  nameOf: (id: string) => string;
  onClose: () => void;
}

/** One line for what the agents are doing now, also used as the mobile sheet's summary. */
export function traceStatus({ flow, trace, running, unavailable }: Pick<TracePanelProps, "flow" | "trace" | "running" | "unavailable">) {
  if (unavailable) return "Not recorded for this replay";
  if (trace.active) return trace.runs.find((r) => r.node === trace.active)?.label ?? "Working...";
  if (running) return "Waiting for the next step...";
  if (!trace.hasTrace) return flow.kind === "debate" ? "Start a debate to watch" : "Send a message to watch";
  return "Done, your turn";
}

function decisionText(d: TraceDecision, nameOf: (id: string) => string) {
  if (d.action === "end") return "Hands it back to you";
  return `${nameOf(d.personaId ?? "")} ${d.action === "speak" ? "speaks" : "reacts"}`;
}

/**
 * "Behind the scenes": the room's live agent graph, the director's decisions,
 * and stats for the current turn. `header` is off inside the mobile sheet,
 * which has its own title bar.
 */
export function TracePanel(props: TracePanelProps & { header?: boolean }) {
  const { flow, trace, unavailable, persona, onClose, header = true } = props;
  const director = flow.kind === "director";

  return (
    <section aria-label="Behind the scenes" className="space-y-5 p-4">
      {header && (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <EyeIcon className="size-5 text-accent-deep" /> Behind the scenes
            </h2>
            <p aria-live="polite" className="truncate text-xs text-muted">
              {traceStatus(props)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close behind the scenes"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-sand hover:text-ink focus-visible:ring-2 focus-visible:ring-accent-deep/50 focus-visible:outline-none"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>
      )}

      {unavailable ? (
        <p className="rounded-xl border border-line bg-sand px-3 py-2.5 text-sm text-ink">
          Behind-the-scenes data isn&apos;t available for this replay.
        </p>
      ) : (
        <>
          <div className="rounded-2xl border border-line bg-canvas p-2">
            <FlowDiagram flow={flow} trace={trace} persona={persona} />
            {!director && trace.round !== null && <p className="text-center font-mono text-[11px] text-muted">Round {trace.round}</p>}
          </div>

          {director && trace.safety && (
            <p
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                trace.safety === "supportive" ? "border border-support/30 bg-support-soft font-medium text-support" : "text-muted"
              }`}
            >
              <HeartIcon className="size-4 shrink-0" />
              {trace.safety === "supportive"
                ? "Supportive mode on: the jokes stop and everyone is gentle."
                : "Safety check: all clear."}
            </p>
          )}

          {trace.plan && <Plan plan={trace.plan} persona={persona} nameOf={props.nameOf} />}
          <Timeline {...props} />
          <Stats trace={trace} director={director} />
        </>
      )}

      <Explainer text={flow.explainer} />
    </section>
  );
}

/** Fast mode: the whole turn as the director planned it in one call (the timeline below shows what actually happened). */
function Plan({ plan, persona, nameOf }: { plan: NonNullable<TraceState["plan"]>; persona: TracePanelProps["persona"]; nameOf: TracePanelProps["nameOf"] }) {
  return (
    <div>
      <h3 className="font-mono text-[11px] tracking-[0.16em] text-muted uppercase">Plan for this turn</h3>
      <p className="mt-1 text-sm text-muted">{plan.reason}</p>
      <ol className="mt-2 space-y-1.5" aria-label="Planned steps, in order">
        {plan.steps.map((s, i) => {
          const who = persona(s.personaId);
          return (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="w-5 shrink-0 pt-1 text-right font-mono text-[11px] text-muted">{i + 1}.</span>
              {who && <Avatar persona={who} size="xs" />}
              <span className="min-w-0">
                <span className="font-semibold">
                  {nameOf(s.personaId)} {s.action === "speak" ? "speaks" : "reacts"}
                </span>
                <span className="text-muted"> · {s.reason}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Timeline({ flow, trace, persona, nameOf }: TracePanelProps) {
  const director = flow.kind === "director";
  const items = director ? trace.decisions : trace.runs;
  return (
    <div>
      <h3 className="font-mono text-[11px] tracking-[0.16em] text-muted uppercase">{director ? "Director's decisions" : "Steps"}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          {director ? "Nothing yet. Send a message to watch the director at work." : "Nothing yet. Start a debate to watch the agents at work."}
        </p>
      ) : (
        <ol className="mt-2 space-y-2" aria-label={director ? "Director's decisions, newest first" : "Steps, newest first"}>
          {director
            ? trace.decisions.map((d) => {
                const who = d.personaId ? persona(d.personaId) : undefined;
                return (
                  <li key={d.id} className="animate-fade-in flex gap-2.5 rounded-xl border border-line bg-surface p-2.5">
                    {who ? <Avatar persona={who} /> : <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sand text-sm" aria-hidden>↩</span>}
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline justify-between gap-2 text-sm font-semibold">
                        {decisionText(d, nameOf)}
                        {d.durationMs !== null && <span className="shrink-0 font-mono text-[11px] font-normal text-muted">{formatMs(d.durationMs)}</span>}
                      </p>
                      <p className="text-sm text-muted">{d.reason}</p>
                    </div>
                  </li>
                );
              })
            : trace.runs.map((r) => {
                const who = persona(r.node);
                return (
                  <li key={r.id} className="animate-fade-in flex items-center gap-2.5 rounded-xl border border-line bg-surface p-2.5 text-sm">
                    {who && <Avatar persona={who} />}
                    <span className="min-w-0 flex-1 font-semibold">{r.label}</span>
                    <span className="shrink-0 font-mono text-[11px] text-muted">{r.durationMs === null ? "running" : formatMs(r.durationMs)}</span>
                  </li>
                );
              })}
        </ol>
      )}
    </div>
  );
}

function Stats({ trace, director }: { trace: TraceState; director: boolean }) {
  const stats = [
    { label: "Messages", value: trace.messages },
    ...(director ? [{ label: "Reactions", value: trace.reactions }] : []),
    { label: "Node runs", value: trace.nodeRuns },
    { label: "Agent time", value: formatMs(trace.totalMs) },
  ];
  return (
    <div>
      <h3 className="font-mono text-[11px] tracking-[0.16em] text-muted uppercase">This turn</h3>
      <dl className="mt-2 grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-line bg-surface px-3 py-2">
            <dt className="text-xs text-muted">{s.label}</dt>
            <dd className="font-display text-lg font-semibold">{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Explainer({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="text-sm">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded font-semibold text-accent-deep underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-accent-deep/50 focus-visible:outline-none"
      >
        What am I looking at?
        <ChevronDownIcon className={`size-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div id={id} className="mt-2 space-y-2 text-muted">
          <p>{text}</p>
          <Link href="/about" className="font-semibold text-accent-deep underline underline-offset-4">
            More about how it works
          </Link>
        </div>
      )}
    </div>
  );
}

/** The panel on phones: a bar docked at the bottom that expands into a scrollable sheet. */
export function TraceSheet({ className = "", ...props }: TracePanelProps & { className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return (
    <div className={`border-t border-line-strong bg-surface ${className}`}>
      <div className="flex items-center gap-1 pr-1">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((e) => !e)}
          className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left text-sm focus-visible:ring-2 focus-visible:ring-accent-deep/50 focus-visible:outline-none focus-visible:ring-inset"
        >
          <EyeIcon className="size-4 shrink-0 text-accent-deep" />
          <span className="shrink-0 font-semibold">Behind the scenes</span>
          <span aria-live="polite" className="min-w-0 truncate text-muted">
            · {traceStatus(props)}
          </span>
          <ChevronDownIcon className={`ml-auto size-4 shrink-0 transition ${expanded ? "" : "rotate-180"}`} />
        </button>
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Close behind the scenes"
          className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-sand hover:text-ink focus-visible:ring-2 focus-visible:ring-accent-deep/50 focus-visible:outline-none"
        >
          <CloseIcon className="size-4" />
        </button>
      </div>
      {expanded && (
        <div id={id} className="max-h-[50dvh] overflow-y-auto border-t border-line">
          <TracePanel {...props} header={false} />
        </div>
      )}
    </div>
  );
}
