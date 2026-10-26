"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { voice } from "@/lib/voice/player";
import { listen } from "@/lib/voice/speechInput";

/**
 * Tap-to-talk for one text box: start/stop listening, the live transcript,
 * the mic level and a friendly error. Starting the mic stops any voice output.
 * `onText(text, final)` gets the transcript as it grows; the box decides what to do with it.
 */
export function useDictation(lang: string, onText: (text: string, final: boolean) => void) {
  const [listening, setListening] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const session = useRef<{ stop: () => void } | null>(null);
  const textRef = useRef(onText);
  useEffect(() => {
    textRef.current = onText;
  });

  const start = useCallback(() => {
    if (session.current) return; // already listening
    voice.stop(); // never talk over the user
    setError(null);
    setListening(true);
    session.current = listen({
      lang,
      onText: (text, final) => textRef.current(text, final),
      onLevel: setLevel,
      onEnd: (message) => {
        session.current = null;
        setListening(false);
        setError(message);
      },
    });
  }, [lang]);

  const stop = useCallback(() => session.current?.stop(), []);
  const toggle = useCallback(() => (session.current ? stop() : start()), [start, stop]);

  // Stop listening when the box goes away.
  useEffect(() => () => session.current?.stop(), []);

  return { listening, level, error, start, toggle, stop, clearError: () => setError(null) };
}
