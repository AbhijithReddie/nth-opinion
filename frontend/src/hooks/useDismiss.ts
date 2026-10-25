"use client";

import { useEffect, type RefObject } from "react";

/**
 * Closes a popup (menu, dropdown) on Escape or on a pointer press outside `refs`.
 * Only listens while `open` is true.
 */
export function useDismiss(open: boolean, refs: RefObject<HTMLElement | null>[], onDismiss: (reason: "escape" | "outside") => void) {
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (refs.every((ref) => !ref.current?.contains(target))) onDismiss("outside");
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss("escape");
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
    // refs are stable ref objects; onDismiss may change identity each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onDismiss]);
}
