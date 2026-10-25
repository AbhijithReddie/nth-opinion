/**
 * The six Group Chat friends, for the UI. Ids must match backend/rooms/group_chat.py
 * (GET /api/rooms returns the same data if you'd rather fetch it).
 */

export type FriendId = "rohit" | "priya" | "vikram" | "ananya" | "arjun" | "meera";

export interface FriendMeta {
  id: FriendId;
  name: string;
  emoji: string;
  color: string;
  tagline: string;
}

export const FRIENDS: FriendMeta[] = [
  { id: "rohit", name: "Rohit", emoji: "😏", color: "#F97316", tagline: "Sarcastic roaster who secretly gives the best advice" },
  { id: "priya", name: "Priya", emoji: "🌸", color: "#EC4899", tagline: "Warm and supportive, asks how you actually feel" },
  { id: "vikram", name: "Vikram", emoji: "🧐", color: "#38BDF8", tagline: "Blunt realist who points out the risks" },
  { id: "ananya", name: "Ananya", emoji: "✨", color: "#FACC15", tagline: "Cheerful hype friend, ALL CAPS and emojis" },
  { id: "arjun", name: "Arjun", emoji: "😤", color: "#EF4444", tagline: "Hot-headed, angry on your behalf, fiercely loyal" },
  { id: "meera", name: "Meera", emoji: "🍵", color: "#A78BFA", tagline: "Calm, wise, elder-sibling energy" },
];

export const FRIENDS_BY_ID = Object.fromEntries(FRIENDS.map((f) => [f.id, f])) as Record<FriendId, FriendMeta>;

export const MIN_FRIENDS = 3;
export const MAX_FRIENDS = 4;
export const NAME_MAX = 20;

export const LANGUAGES = [
  { id: "english", label: "English", hint: "Casual, with Indian slang" },
  { id: "hinglish", label: "Hinglish", hint: "Hindi + English" },
  { id: "tenglish", label: "Tenglish", hint: "Telugu + English" },
] as const;

export type Language = (typeof LANGUAGES)[number]["id"];

export function isFriendId(id: string): id is FriendId {
  return id in FRIENDS_BY_ID;
}
