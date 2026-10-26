"use client";

import { useSyncExternalStore } from "react";
import { loadJson, saveJson } from "@/lib/storage";

/**
 * The "Behind the scenes" toggle, shared by every room and remembered in
 * localStorage (the storage helpers never throw, and an in-memory copy keeps
 * the toggle working when storage is blocked). Off during server rendering,
 * so pages hydrate cleanly and switch on right after.
 */
const KEY = "nth-opinion.behind-the-scenes";
const listeners = new Set<() => void>();
let current: boolean | null = null;

function read(): boolean {
  if (current === null) current = loadJson<boolean>(KEY) === true;
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setBehindTheScenes(on: boolean) {
  current = on;
  saveJson(KEY, on);
  listeners.forEach((listener) => listener());
}

export function useBehindTheScenes(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, read, () => false);
  return [on, setBehindTheScenes];
}

const WIDE = "(min-width: 1024px)";

/** True when the screen is wide enough for the side panel (Tailwind's `lg`); false while server rendering. */
export function useWideScreen(): boolean {
  return useSyncExternalStore(
    (listener) => {
      const query = window.matchMedia(WIDE);
      query.addEventListener("change", listener);
      return () => query.removeEventListener("change", listener);
    },
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
}
