"use client";

import { useSyncExternalStore } from "react";
import { loadJson, saveJson } from "@/lib/storage";

/**
 * "Install app": the browser's install prompt (beforeinstallprompt, Chrome / Edge /
 * Android), or a hint on iPhone Safari, which has no prompt. Hidden once the app is
 * installed or running standalone, and for good once the user dismisses it.
 */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallState = "prompt" | "ios-hint" | "hidden";

const DISMISSED_KEY = "nth-opinion.install-dismissed";
let deferred: InstallPromptEvent | null = null;
let installed = false;
let dismissed: boolean | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

// Listen as early as possible: the event can fire before any component mounts.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own, subtle button instead of the browser's banner
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    notify();
  });
}

function standalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

function iosSafari(): boolean {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua);
}

function state(): InstallState {
  dismissed ??= loadJson<boolean>(DISMISSED_KEY) === true;
  if (installed || dismissed || standalone()) return "hidden";
  if (deferred) return "prompt";
  return iosSafari() ? "ios-hint" : "hidden";
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    state,
    () => "hidden",
  );
}

/** Show the browser's install dialog (the event can only be used once). */
export async function promptInstall() {
  const event = deferred;
  if (!event) return;
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === "accepted") installed = true;
  notify();
}

/** Never show it again on this device. */
export function dismissInstall() {
  dismissed = true;
  saveJson(DISMISSED_KEY, true);
  notify();
}
