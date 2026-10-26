"use client";

import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { accountsConfigured, supabase } from "@/lib/supabase";

/**
 * Who's signed in, shared by every component. Supabase keeps the session (and
 * refreshes its access token); this mirrors it for React.
 * "off": accounts aren't configured, everything works as a guest.
 */
export type AuthState =
  | { status: "off" | "loading" | "signed-out"; user: null }
  | { status: "signed-in"; user: { id: string; email: string | null } };

const OFF: AuthState = { status: "off", user: null };
const LOADING: AuthState = { status: "loading", user: null };
let state: AuthState = accountsConfigured ? LOADING : OFF;
const listeners = new Set<() => void>();
let started = false;

function fromSession(session: Session | null): AuthState {
  return session?.user ? { status: "signed-in", user: { id: session.user.id, email: session.user.email ?? null } } : { status: "signed-out", user: null };
}

function set(next: AuthState) {
  // Same user: keep the same object, so components don't re-render on token refreshes.
  if (next.status === state.status && next.user?.id === state.user?.id) return;
  state = next;
  listeners.forEach((l) => l());
}

function start() {
  const client = supabase();
  if (started || !client) return;
  started = true;
  void client.auth.getSession().then(({ data }) => set(fromSession(data.session)));
  client.auth.onAuthStateChange((_event, session) => set(fromSession(session)));
}

export function useAuth(): AuthState {
  return useSyncExternalStore(
    (listener) => {
      start();
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => (accountsConfigured ? LOADING : OFF),
  );
}

export const authState = () => state;

/** The current access token (refreshed by Supabase when needed), or null as a guest. */
export async function accessToken(): Promise<string | null> {
  const client = supabase();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Email a magic link that signs in and comes back to /auth/callback (then to `next`). */
export async function sendMagicLink(email: string, next = "/"): Promise<string | null> {
  const client = supabase();
  if (!client) return "Sign-in isn't available right now.";
  const redirect = new URL("/auth/callback", window.location.origin);
  redirect.searchParams.set("next", next);
  const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect.toString() } });
  if (!error) return null;
  return error.status === 429 ? "Too many sign-in emails. Wait a minute and try again." : "Couldn't send the sign-in link. Check the address and try again.";
}

export async function signOut() {
  await supabase()?.auth.signOut();
}
