"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon, GavelIcon } from "../icons";

/** The judge's written decision memo, with a Copy button. */
export function DecisionMemo({ memo, topic }: { memo: string; topic: string }) {
  const paragraphs = memo.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <section
      aria-labelledby="memo-title"
      className="animate-fade-up relative overflow-hidden rounded-3xl border border-white/[0.08] bg-arena-900/80 backdrop-blur [animation-delay:200ms]"
    >
      <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl border border-judge/30 bg-judge/10 text-judge">
            <GavelIcon className="size-4.5" />
          </span>
          <div>
            <h2 id="memo-title" className="font-display text-lg leading-tight font-bold">
              Decision memo
            </h2>
            <p className="font-mono text-[11px] tracking-wider text-faint uppercase">From the judge&apos;s bench</p>
          </div>
        </div>
        <CopyButton text={`Motion: ${topic}\n\n${memo}`} />
      </header>
      <div className="space-y-4 px-5 py-5 font-[450] text-[15px] leading-7 text-ink/85 sm:px-8 sm:py-7 sm:text-base">
        {paragraphs.map((p, i) => (
          <p key={i} className={i === 0 ? "first-letter:float-left first-letter:mr-2 first-letter:font-display first-letter:text-5xl first-letter:leading-[0.9] first-letter:font-extrabold first-letter:text-judge" : ""}>
            {p}
          </p>
        ))}
      </div>
    </section>
  );
}

/** Copies text to the clipboard and briefly shows "Copied". */
function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed"); // e.g. clipboard blocked on a non-HTTPS page
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-live="polite"
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-muted transition hover:border-judge/40 hover:text-ink focus-visible:ring-2 focus-visible:ring-judge/60 focus-visible:outline-none"
    >
      {state === "copied" ? <CheckIcon className="size-4 text-pro" /> : <CopyIcon className="size-4" />}
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy"}
    </button>
  );
}
