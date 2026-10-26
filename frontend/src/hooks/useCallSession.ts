"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { voice } from "@/lib/voice/player";
import { readHandsFree, setHandsFree } from "./useVoice";

/**
 * Being in a call (or the debate's Stage mode): joining turns voice output, captions
 * and hands-free on (the Join click also unlocks audio); ending puts them back the way
 * the user had them in chat. Also owns the optional camera self-view, which is only
 * ever shown locally and stopped when the call ends.
 */
export function useCallSession() {
  const [joined, setJoined] = useState(false);
  const before = useRef<{ enabled: boolean; captions: boolean; handsFree: boolean } | null>(null);
  const [camera, setCamera] = useState<MediaStream | null>(null);
  const cameraRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const join = useCallback(() => {
    const { enabled, captions } = voice.get();
    before.current ??= { enabled, captions, handsFree: readHandsFree() };
    voice.setEnabled(true); // inside the click: unlocks audio
    voice.setCaptions(true);
    setHandsFree(true);
    setJoined(true);
  }, []);

  const stopCamera = useCallback(() => {
    cameraRef.current?.getTracks().forEach((t) => t.stop());
    cameraRef.current = null;
    setCamera(null);
  }, []);

  const end = useCallback(() => {
    voice.stop();
    stopCamera();
    const saved = before.current;
    if (saved) {
      voice.setEnabled(saved.enabled);
      voice.setCaptions(saved.captions);
      setHandsFree(saved.handsFree);
    }
    before.current = null;
    setJoined(false);
  }, [stopCamera]);

  const toggleCamera = useCallback(async () => {
    if (camera) return stopCamera();
    setCameraError(null);
    try {
      // Video only, shown in the user's own tile. Never recorded or sent.
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      cameraRef.current = stream;
      setCamera(stream);
    } catch {
      setCameraError("Couldn't open your camera. Check your browser's camera permission.");
    }
  }, [camera, stopCamera]);

  // Leaving the page ends the call cleanly (camera off, settings restored).
  const endRef = useRef(end);
  useEffect(() => {
    endRef.current = end;
  });
  useEffect(() => () => endRef.current(), []);

  return { joined, join, end, camera, cameraError, toggleCamera, clearCameraError: () => setCameraError(null) };
}
