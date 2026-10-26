"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { sendMagicLink } from "@/hooks/useAuth";
import { CloseIcon } from "../icons";
import { closeSignIn, useSignInOpen } from "./signInDialog";

/** Sign in with an email magic link (Google sign-in comes later). Accounts are optional. */
export function SignInModal() {
  const open = useSignInOpen();
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "sending" | "sent" } | { kind: "error"; message: string }>({ kind: "idle" });
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeSignIn();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState({ kind: "sending" });
    const error = await sendMagicLink(email.trim(), pathname);
    setState(error ? { kind: "error", message: error } : { kind: "sent" });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" onClick={closeSignIn}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-in-title"
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-up w-full max-w-sm rounded-3xl border border-line bg-surface p-6 shadow-lift"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="sign-in-title" className="font-display text-2xl font-semibold">
            Sign in
          </h2>
          <button type="button" onClick={closeSignIn} aria-label="Close" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-sand hover:text-ink">
            <CloseIcon className="size-4" />
          </button>
        </div>
        {state.kind === "sent" ? (
          <p role="status" className="mt-3 text-sm leading-relaxed text-ink">
            Check your email: we sent a sign-in link to <strong>{email}</strong>. Open it on this device to finish signing in.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-3">
            <p className="text-sm leading-relaxed text-muted">
              Optional: sign in to save conversations and keep your own friends across devices. Everything works without an account.
            </p>
            <label htmlFor="sign-in-email" className="block text-sm font-semibold">
              Email
            </label>
            <input
              ref={input}
              id="sign-in-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 w-full rounded-xl border border-line-strong bg-canvas px-4 text-base text-ink focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
            />
            {state.kind === "error" && (
              <p role="alert" className="text-sm text-con-deep">
                {state.message}
              </p>
            )}
            <button
              type="submit"
              disabled={state.kind === "sending" || !email.trim()}
              className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-white transition hover:bg-primary-deep focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
            >
              {state.kind === "sending" ? "Sending…" : "Email me a sign-in link"}
            </button>
            <p className="text-xs text-faint">
              See the <a href="/privacy" className="underline hover:text-ink">privacy page</a> for what we store.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
