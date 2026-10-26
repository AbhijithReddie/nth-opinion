"use client";

import { useEffect, useRef } from "react";
import { voice, type SpeakRequest } from "@/lib/voice/player";

/**
 * Reads new messages aloud, in the order they arrive, while "Read replies aloud" is on.
 * `requests` is everything readable so far (finished messages only); whatever was
 * already there when the view opened (e.g. a restored chat) isn't read.
 */
export function useReadAloud(requests: SpeakRequest[]) {
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!seen.current) {
      seen.current = new Set(requests.map((r) => r.key));
      return;
    }
    for (const request of requests) {
      if (seen.current.has(request.key)) continue;
      seen.current.add(request.key);
      if (voice.get().enabled) voice.enqueue(request);
    }
  }, [requests]);

  // Leaving the room stops its voices.
  useEffect(() => () => voice.stop(), []);
}
