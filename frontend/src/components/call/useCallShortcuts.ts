"use client";

import { useEffect, useRef } from "react";
import { voice } from "@/lib/voice/player";

/** Call shortcuts: M toggles the mic, C toggles captions (not while typing in a box). */
export function useCallShortcuts({ onMic }: { onMic?: () => void }) {
  const micRef = useRef(onMic);
  useEffect(() => {
    micRef.current = onMic;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      const key = e.key.toLowerCase();
      if (key === "m" && micRef.current) {
        e.preventDefault();
        micRef.current();
      } else if (key === "c") {
        e.preventDefault();
        voice.setCaptions(!voice.get().captions);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
