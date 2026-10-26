/**
 * "Build your own friend": the user's custom personas.
 *
 * They live only in this browser (localStorage, at most 12; the page still works
 * without storage) and are sent inline with room requests when used as a member
 * or guest. Rooms keep a copy of the ones they use in their setup, so a saved
 * room, a replay or a share card still works after a friend is edited or deleted.
 */

import { useSyncExternalStore } from "react";
import type { AvatarLook, Persona } from "@/config/personas";
import type { Language } from "@/config/roomChats";
import { API_URL, readError, StreamError } from "./sseClient";
import { loadJson, saveJson } from "./storage";

export const MAX_FRIENDS = 12;
/** Field limits, the same as the backend's (main.py CustomPersona). */
export const LIMITS = { name: 20, emoji: 8, personality: 300, speaking_habits: 200, typical_stance: 200, description: 300 };

/** Avatar options chosen by the persona builder (backend/persona_builder.py). */
export interface AvatarParams {
  face: NonNullable<AvatarLook["face"]>;
  skin: number;
  hair: NonNullable<AvatarLook["hair"]>;
  hair_colour: NonNullable<AvatarLook["hairColor"]>;
  accessory: "none" | NonNullable<AvatarLook["extras"]>[number];
  expression: NonNullable<AvatarLook["mood"]>;
}

export interface CustomPersona {
  /** "custom_" + a short random id. */
  id: string;
  name: string;
  emoji: string;
  /** Hex, one of PERSONA_COLOURS. */
  colour: string;
  personality: string;
  speaking_habits: string;
  typical_stance: string;
  avatar: AvatarParams;
}

/** What POST /api/personas/generate returns: a persona without an id yet. */
export type PersonaDraft = Omit<CustomPersona, "id">;

export const newFriendId = () => `custom_${Math.random().toString(36).slice(2, 10).padEnd(8, "0")}`;

/** The avatar parameters as the illustrated avatar's look (components/chat/Avatar.tsx). */
export function lookFromAvatar(a: AvatarParams): AvatarLook {
  return {
    face: a.face,
    skin: Math.min(5, Math.max(1, Math.round(a.skin))) as AvatarLook["skin"],
    hair: a.hair,
    hairColor: a.hair_colour,
    mood: a.expression,
    extras: a.accessory === "none" ? [] : [a.accessory],
  };
}

/** A custom persona in the shape every chat component uses. */
export function toPersona(c: CustomPersona): Persona {
  return { id: c.id, name: c.name, emoji: c.emoji, color: c.colour, tagline: c.personality, look: lookFromAvatar(c.avatar) };
}

/** The fields the room endpoints accept (the avatar is only drawn in the browser). */
export function toWire(c: CustomPersona) {
  const { id, name, emoji, colour, personality, speaking_habits, typical_stance } = c;
  return { id, name, emoji, colour, personality, speaking_habits, typical_stance };
}

function isCustomPersona(c: Partial<CustomPersona> | null): c is CustomPersona {
  return (
    !!c &&
    typeof c.id === "string" &&
    /^custom_[a-z0-9]{4,16}$/.test(c.id) &&
    [c.name, c.emoji, c.colour, c.personality, c.speaking_habits, c.typical_stance].every((v) => typeof v === "string" && v.trim()) &&
    !!c.avatar &&
    typeof c.avatar === "object"
  );
}

// --- the saved list: localStorage, with an in-memory copy so it works when storage is blocked ---
const KEY = "nth-opinion.friends.v1";
const listeners = new Set<() => void>();
let current: CustomPersona[] | null = null;
const EMPTY: CustomPersona[] = [];

function read(): CustomPersona[] {
  if (current === null) {
    const saved = loadJson<CustomPersona[]>(KEY);
    current = Array.isArray(saved) ? saved.filter(isCustomPersona).slice(0, MAX_FRIENDS) : [];
  }
  return current;
}

function write(next: CustomPersona[]) {
  current = next.slice(0, MAX_FRIENDS);
  saveJson(KEY, current);
  listeners.forEach((listener) => listener());
}

/** The saved friends, plus save / remove. Empty during server rendering. */
export function useCustomPersonas() {
  const friends = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read,
    () => EMPTY,
  );
  // save / remove are module functions, so they're stable across renders (safe in effect dependencies).
  return { friends, full: friends.length >= MAX_FRIENDS, save: saveFriend, remove: removeFriend };
}

/** Add a new friend or replace one with the same id. */
function saveFriend(friend: CustomPersona) {
  const list = read();
  write(list.some((f) => f.id === friend.id) ? list.map((f) => (f.id === friend.id ? friend : f)) : [...list, friend]);
}

function removeFriend(id: string) {
  write(read().filter((f) => f.id !== id));
}

/** Ask the backend to build a persona. Errors (refusals, rate limits, ...) are thrown as StreamError with a friendly message. */
export async function generatePersona(input: {
  description: string;
  name?: string;
  relationship?: string;
  language: Language;
}): Promise<PersonaDraft> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/personas/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, name: input.name || undefined, relationship: input.relationship || undefined }),
    });
  } catch {
    throw new StreamError("Can't reach the Nth Opinion server. Make sure the backend is running and try again.", "unreachable");
  }
  if (!response.ok) {
    const { detail, code } = await readError(response);
    throw new StreamError(detail ?? `Couldn't build your friend right now (error ${response.status}). Please try again.`, code);
  }
  return (await response.json()) as PersonaDraft;
}
