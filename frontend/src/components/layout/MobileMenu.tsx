"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ROOMS } from "@/config/rooms";
import { GITHUB_URL } from "@/config/site";
import { CloseIcon, GitHubIcon, MenuIcon } from "../icons";
import { RoomMenuItem } from "./RoomMenuItem";

/**
 * Hamburger button + full-height drawer for small screens.
 * A modal dialog: focus moves into it, Tab stays inside, Escape or the backdrop closes it,
 * and the page behind doesn't scroll.
 */
export function MobileMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Cache Components keeps hidden pages mounted; never come back to an open drawer.
  useLayoutEffect(() => () => setOpen(false), []);

  // While open: lock page scroll, focus the drawer, and give focus back to the button on close.
  useEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      button?.focus();
    };
  }, [open]);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key !== "Tab") return;
    // Keep Tab cycling inside the drawer.
    const focusable = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>("a, button") ?? []);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }

  const close = () => setOpen(false);
  const linkClass = (href: string) =>
    `block rounded-xl px-3 py-2.5 text-base font-semibold transition hover:bg-sand focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none ${
      pathname === href ? "text-ink bg-sand" : "text-muted hover:text-ink"
    }`;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="grid size-10 place-items-center rounded-xl text-ink transition hover:bg-sand focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none md:hidden"
      >
        <MenuIcon className="size-5" />
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 md:hidden" onKeyDown={onKeyDown}>
            <div aria-hidden className="animate-fade-in absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={close} />
            <div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Site menu"
              className="animate-drawer-in scroll-thin absolute inset-y-0 right-0 flex w-[min(88vw,24rem)] flex-col overflow-y-auto border-l border-line bg-surface p-4"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="font-display text-lg font-semibold">Menu</span>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={close}
                  className="grid size-10 place-items-center rounded-xl text-muted transition hover:bg-sand hover:text-ink focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
                >
                  <CloseIcon className="size-5" />
                </button>
              </div>

              <nav aria-label="Mobile" className="flex flex-1 flex-col gap-1">
                <Link href="/" onClick={close} className={linkClass("/")} aria-current={pathname === "/" ? "page" : undefined}>
                  Home
                </Link>
                <p className="mt-3 px-3 pb-1 font-mono text-[10px] tracking-[0.2em] text-faint uppercase">Rooms</p>
                <ul className="space-y-0.5">
                  {ROOMS.map((room) => (
                    <li key={room.id}>
                      <RoomMenuItem room={room} active={pathname === room.href} onNavigate={close} />
                    </li>
                  ))}
                </ul>
                <div className="mt-3 border-t border-line pt-3">
                  <Link
                    href="/friends"
                    onClick={close}
                    className={linkClass("/friends")}
                    aria-current={pathname === "/friends" ? "page" : undefined}
                  >
                    My Friends
                  </Link>
                  <Link
                    href="/about"
                    onClick={close}
                    className={linkClass("/about")}
                    aria-current={pathname === "/about" ? "page" : undefined}
                  >
                    About
                  </Link>
                  <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-base font-semibold text-muted transition hover:bg-sand hover:text-ink focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
                  >
                    <GitHubIcon className="size-5" /> GitHub
                  </a>
                </div>
              </nav>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
