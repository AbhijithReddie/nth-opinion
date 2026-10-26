"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { accountsConfigured, supabase } from "@/lib/supabase";

/**
 * Where the email magic link lands: swap the one-time code for a session (Supabase
 * keeps it in this browser), then go back to the page the user signed in from.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") ?? "/";
    const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/"; // only our own pages
    const code = params.get("code");
    const client = supabase();
    if (!client) return; // not configured: the message below says so
    void (async () => {
      if (code) await client.auth.exchangeCodeForSession(code).catch(() => null);
      // The client may already have swapped the code itself (detectSessionInUrl), so the session decides.
      const { data } = await client.auth.getSession();
      if (data.session) router.replace(safeNext);
      else setError("This sign-in link has expired or was already used. Request a new one from Sign in.");
    })();
  }, [router]);

  return (
    <main id="main" className="mx-auto grid w-full max-w-md flex-1 place-items-center px-4 py-24 text-center">
      {!accountsConfigured ? (
        <p role="alert">Sign-in isn&apos;t available on this site right now.</p>
      ) : error ? (
        <p role="alert" className="text-ink">
          {error}
        </p>
      ) : (
        <p role="status" className="text-muted">
          Signing you in…
        </p>
      )}
    </main>
  );
}
