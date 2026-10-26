"use client";

import { useEffect, useRef } from "react";
import type { AvatarLook } from "@/config/personas";
import { MicIcon } from "../icons";
import { AnimatedAvatar } from "./AnimatedAvatar";

export const CAMERA_NOTE = "Your camera only shows here, in your own tile. It's never recorded, uploaded or sent anywhere.";

/**
 * Your tile: your initial (or, in Future You, your avatar), whether your mic is
 * listening, and your camera preview if you turned it on. The preview is a local
 * <video> of the stream; nothing is recorded or sent.
 */
export function YouTile({
  label,
  look,
  listening,
  micAvailable,
  camera,
  size = "tile",
}: {
  /** "You", or your name. */
  label: string;
  /** Show an avatar instead of an initial. */
  look?: AvatarLook;
  listening: boolean;
  /** False where voice input isn't supported (or in a replay). */
  micAvailable: boolean;
  camera: MediaStream | null;
  size?: "spotlight" | "tile" | "strip";
}) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (video.current) video.current.srcObject = camera;
  }, [camera]);

  const box = size === "strip" ? "w-24 p-2" : size === "spotlight" ? "w-full max-w-xs p-5" : "w-36 p-3 lg:w-44";
  const face = size === "strip" ? "size-14" : size === "spotlight" ? "size-40 sm:size-48" : "size-24 lg:size-32";
  const status = !micAvailable ? "" : listening ? "Listening" : "Mic off";

  return (
    <div
      role="group"
      aria-label={`You${status ? `, ${status.toLowerCase()}` : ""}`}
      className={`relative flex shrink-0 flex-col items-center rounded-3xl border bg-surface/85 shadow-soft backdrop-blur ${box} ${
        listening ? "border-transparent" : "border-line"
      }`}
      style={listening ? { boxShadow: "0 0 0 3px var(--color-primary), 0 0 28px -4px var(--color-primary)" } : undefined}
    >
      <div className={`relative grid place-items-center overflow-hidden rounded-full bg-primary-soft ${face}`}>
        {camera ? (
          <video ref={video} autoPlay muted playsInline title={CAMERA_NOTE} className="size-full -scale-x-100 object-cover" />
        ) : look ? (
          <AnimatedAvatar id="user" look={look} color="#9A3B2A" state="idle" className="size-full" />
        ) : (
          <span className="font-display text-4xl font-semibold text-primary-deep">{label.slice(0, 1).toUpperCase()}</span>
        )}
      </div>
      <p className={`mt-2 font-semibold text-ink ${size === "strip" ? "text-xs" : "text-sm"}`}>{label}</p>
      {status && (
        <p className={`flex items-center gap-1 text-[11px] ${listening ? "font-semibold text-primary-deep" : "text-muted"}`}>
          <MicIcon className="size-3" /> {status}
        </p>
      )}
    </div>
  );
}
