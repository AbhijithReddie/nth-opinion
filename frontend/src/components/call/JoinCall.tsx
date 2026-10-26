"use client";

import type { Persona } from "@/config/personas";
import { Avatar } from "../chat/Avatar";
import { PhoneIcon } from "../icons";

/**
 * "Join call": a ringing phone with the cast around it. The Join button is the click
 * that unlocks audio (browsers only allow sound after one), so voice output can start.
 */
export function JoinCall({
  title,
  modeName,
  people,
  onJoin,
  onCancel,
  background,
}: {
  title: string;
  /** "Call" or "Stage mode". */
  modeName: string;
  people: Persona[];
  onJoin: () => void;
  onCancel: () => void;
  background: string;
}) {
  return (
    <div className={`animate-fade-in grid min-h-0 flex-1 place-items-center px-6 py-10 text-center ${background}`}>
      <div className="flex max-w-sm flex-col items-center">
        <div className="relative grid size-28 place-items-center">
          {/* Ripples and a ringing phone (still, under reduced motion). */}
          <span aria-hidden className="animate-ripple absolute inset-0 rounded-full bg-primary/25 motion-reduce:hidden" />
          <span aria-hidden className="animate-ripple absolute inset-0 rounded-full bg-primary/20 [animation-delay:0.6s] motion-reduce:hidden" />
          <span className="relative grid size-20 place-items-center rounded-full bg-primary text-white shadow-lift">
            <PhoneIcon className="animate-ring size-9 motion-reduce:animate-none" />
          </span>
        </div>
        <div className="mt-6 flex -space-x-3" aria-hidden>
          {people.map((p) => (
            <Avatar key={p.id} persona={p} size="lg" className="ring-4 ring-surface" />
          ))}
        </div>
        <h2 className="mt-5 font-display text-2xl font-semibold text-balance">{title}</h2>
        <p className="mt-1 text-sm text-muted">
          {people.map((p) => p.name).join(", ")} {people.length === 1 ? "is" : "are"} ringing you…
        </p>
        <p className="mt-3 text-xs text-faint">Voice, captions and hands-free turn on in {modeName.toLowerCase()}. You can switch any of them off.</p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-11 items-center rounded-full border border-line-strong bg-surface px-5 text-sm font-semibold text-ink transition hover:bg-sand focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onJoin}
            autoFocus
            className="inline-flex h-11 items-center gap-2 rounded-full bg-sage-deep px-6 text-sm font-semibold text-white shadow-lift transition hover:bg-ink focus-visible:ring-2 focus-visible:ring-sage/60 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-95"
          >
            <PhoneIcon className="size-4" /> Join {modeName === "Call" ? "call" : modeName.toLowerCase()}
          </button>
        </div>
      </div>
    </div>
  );
}
