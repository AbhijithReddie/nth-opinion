"use client";

import { useCallback, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { ROOMS } from "@/config/rooms";
import { useDismiss } from "@/hooks/useDismiss";
import { ChevronDownIcon } from "../icons";
import { RoomMenuItem } from "./RoomMenuItem";

/**
 * Desktop "Rooms" dropdown (disclosure pattern): a button that shows a panel of room links.
 * Arrow keys move between rooms, Escape or an outside click closes it.
 */
export function RoomsMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const active = ROOMS.some((r) => pathname === r.href);

  const close = useCallback((reason?: "escape" | "outside") => {
    setOpen(false);
    if (reason === "escape") buttonRef.current?.focus();
  }, []);
  useDismiss(open, [buttonRef, panelRef], close);

  // Cache Components keeps hidden pages mounted; make sure the menu is closed when we come back.
  useLayoutEffect(() => () => setOpen(false), []);

  function items() {
    return Array.from(panelRef.current?.querySelectorAll<HTMLElement>("[data-menu-item]") ?? []);
  }

  function focusItem(index: number) {
    const list = items();
    list[(index + list.length) % list.length]?.focus();
  }

  function onButtonKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => focusItem(0));
    }
  }

  function onPanelKeyDown(e: KeyboardEvent) {
    const current = items().indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(current + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(current - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusItem(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusItem(-1);
    }
  }

  return (
    <div
      className="relative"
      onBlur={(e) => {
        // Close when keyboard focus moves outside the button and panel.
        if (open && e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onButtonKeyDown}
        className={`inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium transition hover:bg-sand hover:text-ink focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none ${
          open || active ? "text-ink" : "text-muted"
        }`}
      >
        Rooms
        <ChevronDownIcon className={`size-4 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          onKeyDown={onPanelKeyDown}
          className="animate-fade-in absolute top-full left-1/2 mt-2 w-[min(92vw,34rem)] -translate-x-1/2 rounded-2xl border border-line bg-surface p-2 shadow-lift backdrop-blur-xl"
        >
          <p className="px-2.5 pt-1.5 pb-2 font-mono text-[10px] tracking-[0.2em] text-faint uppercase">All rooms</p>
          <ul className="grid gap-0.5 sm:grid-cols-2">
            {ROOMS.map((room) => (
              <li key={room.id}>
                <RoomMenuItem room={room} active={pathname === room.href} onNavigate={() => setOpen(false)} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
