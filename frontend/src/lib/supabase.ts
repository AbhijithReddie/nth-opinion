/**
 * Supabase, used ONLY for signing in (email magic links). All account data goes
 * through our backend (lib/account.ts), which verifies the access token.
 * Without NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY, sign-in is hidden.
 * The key is the project's publishable key ("sb_publishable_..."), safe to ship to browsers.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Sign-in is set up for this site. */
export const accountsConfigured = Boolean(URL && KEY);

let client: SupabaseClient | null = null;

/** The browser's Supabase client (null on the server or when accounts aren't configured). */
export function supabase(): SupabaseClient | null {
  if (!accountsConfigured || typeof window === "undefined") return null;
  client ??= createBrowserClient(URL, KEY);
  return client;
}
