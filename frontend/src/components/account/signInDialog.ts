"use client";

import { useSyncExternalStore } from "react";

/** Open the sign-in dialog from anywhere (it's rendered once, by AccountManager). */
let open = false;
const listeners = new Set<() => void>();

function set(next: boolean) {
  open = next;
  listeners.forEach((l) => l());
}

export const openSignIn = () => set(true);
export const closeSignIn = () => set(false);

export function useSignInOpen(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open,
    () => false,
  );
}
