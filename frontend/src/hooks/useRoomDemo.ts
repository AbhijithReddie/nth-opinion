"use client";

import { useEffect, useState } from "react";
import { loadReplay, type Replay } from "@/lib/replay";
import { wakeServer } from "@/lib/sseClient";

/**
 * Every room page calls this when it opens. It pings the backend so a sleeping
 * free server starts waking up now, and loads the room's demo recording.
 * Returns the recording, or null while loading or if the room has none
 * (then the demo buttons stay hidden).
 */
export function useRoomDemo<R extends Replay = Replay>(roomId: string): R | null {
  const [recording, setRecording] = useState<R | null>(null);

  useEffect(() => {
    wakeServer();
    let active = true;
    void loadReplay(roomId).then((r) => {
      if (active) setRecording(r as R | null);
    });
    return () => {
      active = false;
    };
  }, [roomId]);

  return recording;
}
