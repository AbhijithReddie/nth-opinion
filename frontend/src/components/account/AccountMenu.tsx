"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut, useAuth } from "@/hooks/useAuth";
import { openSignIn } from "./signInDialog";

const LINKS = [
  { href: "/conversations", label: "My conversations" },
  { href: "/friends", label: "My Friends" },
  { href: "/settings", label: "Settings" },
];

/** Navbar: "Sign in" for guests; signed in, your initial with a menu. Hidden when accounts aren't set up. */
export function AccountMenu() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  if (auth.status === "off") return null;
  if (auth.status !== "signed-in") {
    return (
      <button
        type="button"
        onClick={openSignIn}
        disabled={auth.status === "loading"}
        className="inline-flex h-9 items-center rounded-lg border border-line-strong bg-surface px-3 text-sm font-semibold text-ink transition hover:bg-sand focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none disabled:opacity-50"
      >
        Sign in
      </button>
    );
  }

  const initial = (auth.user.email ?? "?").slice(0, 1).toUpperCase();
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${auth.user.email ?? "signed in"}`}
        className="grid size-9 place-items-center rounded-full bg-primary font-display text-base font-semibold text-white transition hover:bg-primary-deep focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {initial}
      </button>
      {open && (
        <div role="menu" className="animate-fade-in absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-line bg-surface p-1.5 shadow-lift">
          <p className="truncate px-3 py-2 text-xs text-muted">{auth.user.email}</p>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} role="menuitem" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-sand">
              {l.label}
            </Link>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-con-deep hover:bg-con-soft"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
