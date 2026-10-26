/**
 * The backend's account endpoints (backend/accounts_api.py). Each call sends the
 * Supabase access token as "Authorization: Bearer ..."; the backend works out who
 * the user is from it. Guests never call these.
 */

import { accessToken } from "@/hooks/useAuth";
import type { ChatItem, RoomSetup } from "./chatTypes";
import type { CustomPersona } from "./customPersonas";
import { API_URL, readError } from "./sseClient";

export interface Profile {
  user_id: string;
  email: string | null;
  display_name: string | null;
  preferred_language: string | null;
  memory_enabled: boolean;
}

export interface ConversationSummary {
  id: string;
  room_id: string;
  title: string;
  safety_flagged: boolean;
  created_at: string;
  updated_at: string;
}

export interface Conversation extends ConversationSummary {
  setup: Partial<RoomSetup>;
  messages: ChatItem[];
  result: unknown;
}

export interface ConversationData {
  room_id: string;
  title: string;
  setup: Partial<RoomSetup>;
  messages: ChatItem[];
  result: unknown;
  safety_flagged: boolean;
}

/** A friendly message, plus why: "accounts_disabled", "auth_required", "session_expired", "limit", "not_found", ... */
export class AccountError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

// Listeners for an expired session (AccountManager shows "Please sign in again").
const expiredListeners = new Set<() => void>();
export function onSessionExpired(listener: () => void) {
  expiredListeners.add(listener);
  return () => {
    expiredListeners.delete(listener);
  };
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  if (!token) throw new AccountError("Sign in to use this.", "auth_required");
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new AccountError("Couldn't reach the server. Check your connection and try again.", "unreachable");
  }
  if (response.ok) return (await response.json()) as T;
  const { detail, code } = await readError(response);
  if (code === "session_expired") expiredListeners.forEach((l) => l());
  throw new AccountError(detail ?? "Something went wrong. Please try again.", code ?? `http_${response.status}`);
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

/** Whether the backend has accounts turned on (it needs DATABASE_URL and SUPABASE_URL). */
export async function accountsAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`${API_URL}/api/account/status`);
    return r.ok && (await r.json()).enabled === true;
  } catch {
    return false;
  }
}

export const account = {
  profile: () => call<Profile>("/api/me"),
  updateProfile: (changes: { display_name?: string; preferred_language?: string }) => call<Profile>("/api/me", json("PATCH", changes)),
  exportData: () => call<unknown>("/api/me/export"),
  deleteAccount: () => call<{ deleted: boolean; sign_out: boolean }>("/api/me", { method: "DELETE" }),

  personas: () => call<{ personas: CustomPersona[] }>("/api/personas").then((r) => r.personas),
  savePersonas: (personas: CustomPersona[]) => call<{ personas: CustomPersona[] }>("/api/personas", json("PUT", { personas })).then((r) => r.personas),

  conversations: () => call<{ conversations: ConversationSummary[]; max: number }>("/api/conversations"),
  conversation: (id: string) => call<Conversation>(`/api/conversations/${encodeURIComponent(id)}`),
  createConversation: (data: ConversationData) => call<ConversationSummary>("/api/conversations", json("POST", data)),
  updateConversation: (id: string, changes: Partial<ConversationData>) =>
    call<ConversationSummary>(`/api/conversations/${encodeURIComponent(id)}`, json("PUT", changes)),
  deleteConversation: (id: string) => call<{ deleted: boolean }>(`/api/conversations/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

// --- what a saved conversation contains ----------------------------------------------------
const MAX_MESSAGES = 200;
const MAX_BYTES = 190_000; // a little under the backend's 200 KB
const SETUP_KEYS = ["title", "participants", "guests", "language", "context", "custom"] as const;

/**
 * The room as it will be saved: the setup's people, language and details only (never
 * uploaded documents or their digests; those aren't part of the setup and the backend
 * strips them again), and the latest messages that fit the limits.
 */
export function conversationData(roomId: string, setup: RoomSetup, items: ChatItem[], safetyFlagged: boolean): ConversationData {
  const cleanSetup: Partial<RoomSetup> = {};
  for (const key of SETUP_KEYS) if (setup[key] !== undefined) Object.assign(cleanSetup, { [key]: setup[key] });
  let messages = items.slice(-MAX_MESSAGES);
  while (messages.length > 1 && new Blob([JSON.stringify(messages)]).size > MAX_BYTES) messages = messages.slice(Math.ceil(messages.length / 10));
  const summary = [...items].reverse().find((i) => i.kind !== "message");
  const firstMessage = items.find((i) => i.kind === "message" && i.sender === "user");
  const title = (setup.title || (firstMessage?.kind === "message" ? firstMessage.text : "") || "Conversation").trim().slice(0, 120);
  return { room_id: roomId, title, setup: cleanSetup, messages, result: summary ?? null, safety_flagged: safetyFlagged };
}
