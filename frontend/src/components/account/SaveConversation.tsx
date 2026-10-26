"use client";

import type { SaveStatus } from "@/hooks/useConversationSave";

/** Header pill while "Save conversation" is on: saving, saved, or why it couldn't. */
export function SaveStatusPill({ status }: { status: SaveStatus }) {
  const text = status.kind === "saving" ? "Saving…" : status.kind === "error" ? "Not saved" : "Saved";
  return (
    <span
      role="status"
      title={status.kind === "error" ? status.message : "This conversation saves to your account after each turn"}
      className={`hidden shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold sm:inline ${
        status.kind === "error" ? "border-con/40 bg-con-soft text-con-deep" : "border-line-strong bg-sand text-muted"
      }`}
    >
      {text}
      {status.kind === "error" && <span className="sr-only">: {status.message}</span>}
    </span>
  );
}

/**
 * The conversation triggered the safety layer: ask before saving it. "Don't save" is
 * the default (focused first), and turns saving off for this room.
 */
export function SaveSafetyDialog({ onAnswer }: { onAnswer: (save: boolean) => void }) {
  return (
    <div role="alertdialog" aria-labelledby="save-safety-title" aria-describedby="save-safety-text" className="animate-fade-in border-b border-line bg-surface px-4 py-3">
      <p id="save-safety-title" className="text-sm font-semibold">
        Save this conversation?
      </p>
      <p id="save-safety-text" className="mt-0.5 text-sm text-muted">
        It touched on something difficult. It won&apos;t be saved to your account unless you say so.
      </p>
      <div className="mt-2 flex gap-2">
        <button type="button" autoFocus onClick={() => onAnswer(false)} className="h-8 rounded-lg bg-ink px-3 text-xs font-semibold text-white">
          Don&apos;t save
        </button>
        <button type="button" onClick={() => onAnswer(true)} className="h-8 rounded-lg border border-line-strong px-3 text-xs font-semibold hover:bg-sand">
          Save it
        </button>
      </div>
    </div>
  );
}
