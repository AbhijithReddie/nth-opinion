"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { openSignIn } from "./signInDialog";

/** Account pages: shows `children(userId)` when signed in, and a friendly message otherwise. */
export function RequireAccount({ what, children }: { what: string; children: (userId: string) => ReactNode }) {
  const auth = useAuth();
  if (auth.status === "signed-in") return <>{children(auth.user.id)}</>;
  return (
    <div className="rounded-3xl border border-line bg-surface p-8 text-center shadow-soft">
      {auth.status === "off" ? (
        <p className="text-muted">Accounts aren&apos;t available on this site. Everything else works without one.</p>
      ) : auth.status === "loading" ? (
        <p role="status" className="text-muted">
          Loading…
        </p>
      ) : (
        <>
          <p className="text-ink">Sign in to see {what}.</p>
          <button type="button" onClick={openSignIn} className="mt-4 h-10 rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-deep">
            Sign in
          </button>
        </>
      )}
    </div>
  );
}
