"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useDismiss } from "@/hooks/useDismiss";
import { MoreIcon, PencilIcon, TrashIcon } from "../icons";

/** The chat header's "⋮" menu: edit the room setup, clear the chat. */
export function ChatMenu({ editLabel, onEdit, onClearChat }: { editLabel: string; onEdit: () => void; onClearChat: () => void }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const menuId = useId();

  const close = useCallback((reason?: "escape" | "outside") => {
    setOpen(false);
    if (reason === "escape") buttonRef.current?.focus();
  }, []);
  useDismiss(open, [buttonRef, menuRef], close);

  function choose(action: () => void) {
    setOpen(false);
    action();
  }

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-sand focus-visible:bg-sand focus-visible:outline-none";

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Chat options"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          setOpen((o) => !o);
          requestAnimationFrame(() => menuRef.current?.querySelector("button")?.focus());
        }}
        className="grid size-10 place-items-center rounded-xl text-muted transition hover:bg-sand hover:text-ink focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
      >
        <MoreIcon className="size-5" />
      </button>
      {open && (
        <ul
          ref={menuRef}
          id={menuId}
          role="menu"
          onKeyDown={(e) => {
            // Up/Down move between the two items.
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
            e.preventDefault();
            const items = Array.from(menuRef.current?.querySelectorAll("button") ?? []);
            const next = (items.indexOf(document.activeElement as HTMLButtonElement) + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
            items[next]?.focus();
          }}
          className="animate-fade-in absolute top-full right-0 z-20 mt-1 w-52 rounded-xl border border-line bg-surface p-1 shadow-lift"
        >
          <li role="none">
            <button type="button" role="menuitem" onClick={() => choose(onEdit)} className={itemClass}>
              <PencilIcon className="size-4 text-muted" /> {editLabel}
            </button>
          </li>
          <li role="none">
            <button type="button" role="menuitem" onClick={() => choose(onClearChat)} className={`${itemClass} text-con-deep`}>
              <TrashIcon className="size-4" /> Clear chat
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
