/**
 * The AI personas of each room, for the UI. Ids must match the backend
 * room configs (backend/rooms/*.py); GET /api/rooms returns the same data.
 */

/**
 * How a persona's illustrated avatar looks (drawn by components/chat/Avatar.tsx).
 * People get a face, hair and an accessory; the Debate Arena's speakers are little robots.
 */
export interface AvatarLook {
  kind?: "person" | "bot";
  /** Head shape (default oval). */
  face?: "oval" | "round" | "square";
  /** Skin tone, 1 (lightest) to 5 (deepest). */
  skin?: 1 | 2 | 3 | 4 | 5;
  hair?: "short" | "side" | "spiky" | "curly" | "bob" | "long" | "wavy" | "bun" | "ponytail" | "pigtails" | "buzz" | "tousled";
  hairColor?: "black" | "brown" | "grey";
  mood?: "smile" | "grin" | "laugh" | "smirk" | "flat" | "frown" | "calm" | "confused";
  extras?: ("glasses" | "round-glasses" | "stubble" | "beard" | "moustache" | "bindi" | "earrings" | "flower" | "tie" | "headphones" | "sparkle" | "question" | "cap" | "judge-cap")[];
}

export interface Persona {
  id: string;
  name: string;
  emoji: string;
  /**
   * Hex accent colour for names, avatars and mentions. Dark enough to pass WCAG AA
   * as text on every light surface (white, canvas and sand).
   */
  color: string;
  /** One-line personality for setup cards. */
  tagline: string;
  look: AvatarLook;
}

// Text-safe persona colours, from the Chai & Sage palette and its neighbours.
// Within a room no two personas share a colour. Custom personas pick from the same list
// (backend/persona_builder.py has a copy).
export const PERSONA_COLOURS = {
  ember: "#A0521D",
  rose: "#A8407F",
  teal: "#2D6B73",
  gold: "#876000",
  crimson: "#B0263A",
  plum: "#6B52B0",
  sage: "#3F6B4E",
  terracotta: "#9A3B2A",
} as const;
const C = PERSONA_COLOURS;

export const GROUP_CHAT_FRIENDS: Persona[] = [
  {
    id: "rohit",
    name: "Rohit",
    emoji: "😏",
    color: C.ember,
    tagline: "Sarcastic roaster who secretly gives the best advice",
    look: { skin: 3, hair: "side", mood: "smirk", extras: ["stubble"] },
  },
  {
    id: "priya",
    name: "Priya",
    emoji: "🌸",
    color: C.rose,
    tagline: "Warm and supportive, asks how you actually feel",
    look: { skin: 2, hair: "long", mood: "smile", extras: ["flower", "earrings"] },
  },
  {
    id: "vikram",
    name: "Vikram",
    emoji: "🧐",
    color: C.teal,
    tagline: "Blunt realist who points out the risks",
    look: { skin: 4, hair: "short", mood: "flat", extras: ["glasses"] },
  },
  {
    id: "ananya",
    name: "Ananya",
    emoji: "✨",
    color: C.gold,
    tagline: "Cheerful hype friend, ALL CAPS and emojis",
    look: { skin: 2, hair: "ponytail", mood: "laugh", extras: ["sparkle"] },
  },
  {
    id: "arjun",
    name: "Arjun",
    emoji: "😤",
    color: C.crimson,
    tagline: "Hot-headed, angry on your behalf, fiercely loyal",
    look: { skin: 4, hair: "spiky", mood: "frown" },
  },
  {
    id: "meera",
    name: "Meera",
    emoji: "🍵",
    color: C.plum,
    tagline: "Calm, wise, elder-sibling energy",
    look: { skin: 3, hair: "bun", mood: "calm", extras: ["bindi"] },
  },
];

export const SHARKS: Persona[] = [
  {
    id: "kavya",
    name: "Kavya",
    emoji: "📊",
    color: C.teal,
    tagline: "The Numbers Investor: unit economics or nothing",
    look: { skin: 3, hair: "bob", mood: "smile", extras: ["glasses", "earrings"] },
  },
  {
    id: "aditya",
    name: "Aditya",
    emoji: "🚀",
    color: C.plum,
    tagline: "The Visionary: asks how big this can get",
    look: { skin: 2, hair: "wavy", mood: "grin", extras: ["sparkle"] },
  },
  {
    id: "rustom",
    name: "Rustom",
    emoji: "🤨",
    color: C.gold,
    tagline: "The Skeptic: finds every hole",
    look: { skin: 1, hair: "buzz", hairColor: "grey", mood: "flat", extras: ["moustache", "round-glasses"] },
  },
];

export const ROAST_PANEL: Persona[] = [
  {
    id: "kabir",
    name: "Kabir",
    emoji: "🌶️",
    color: C.terracotta,
    tagline: "The Roaster: no mercy, all love",
    look: { skin: 3, hair: "spiky", mood: "grin", extras: ["cap"] },
  },
  {
    id: "nandini",
    name: "Nandini",
    emoji: "🧭",
    color: C.sage,
    tagline: "The Mentor: turns jokes into fixes",
    look: { skin: 4, hair: "wavy", mood: "calm", extras: ["round-glasses"] },
  },
  {
    id: "sameer",
    name: "Sameer",
    emoji: "📎",
    color: C.gold,
    tagline: "The Recruiter: reads it like a hiring manager",
    look: { skin: 2, hair: "short", mood: "flat", extras: ["tie"] },
  },
];

export const INTERVIEWERS: Persona[] = [
  {
    id: "pooja",
    name: "Pooja",
    emoji: "🤝",
    color: C.rose,
    tagline: "HR: motivation, culture fit and communication",
    look: { skin: 2, hair: "bun", mood: "smile", extras: ["earrings"] },
  },
  {
    id: "karthik",
    name: "Karthik",
    emoji: "💻",
    color: C.teal,
    tagline: "Tech lead: goes deep on your projects",
    look: { skin: 5, hair: "short", mood: "smile", extras: ["glasses", "beard"] },
  },
  {
    id: "devraj",
    name: "Devraj",
    emoji: "🗂️",
    color: C.gold,
    tagline: "Hiring manager: skeptical, wants proof of impact",
    look: { skin: 3, hair: "side", hairColor: "grey", mood: "flat", extras: ["moustache", "tie"] },
  },
];

export const FUTURE_SELVES: Persona[] = [
  {
    id: "you30",
    name: "You at 30",
    emoji: "🧑",
    color: C.teal,
    tagline: "Close enough to remember, far enough to see clearly",
    look: { skin: 3, hair: "tousled", mood: "smile" },
  },
  {
    id: "you50",
    name: "You at 50",
    emoji: "🧓",
    color: C.gold,
    tagline: "The long view: values, people and regrets",
    look: { skin: 3, hair: "tousled", hairColor: "grey", mood: "calm", extras: ["round-glasses"] },
  },
];

export const STUDY_BUDDIES: Persona[] = [
  {
    id: "bunty",
    name: "Bunty",
    emoji: "😵‍💫",
    color: C.plum,
    tagline: "The confused friend: asks what you're afraid to ask",
    look: { skin: 4, hair: "curly", mood: "confused", extras: ["question"] },
  },
  {
    id: "ishaan",
    name: "Ishaan",
    emoji: "🏆",
    color: C.gold,
    tagline: "The topper: explains it properly",
    look: { skin: 2, hair: "side", mood: "smile", extras: ["glasses"] },
  },
  {
    id: "tanvi",
    name: "Tanvi",
    emoji: "🤣",
    color: C.sage,
    tagline: "The meme-maker: makes it stick",
    look: { skin: 3, hair: "pigtails", mood: "laugh", extras: ["headphones"] },
  },
];

/** The Debate Arena's speakers. Not a chat room, but they get avatars too. */
export const DEBATERS: Persona[] = [
  { id: "pro", name: "Pro", emoji: "👍", color: C.sage, tagline: "Argues for the motion", look: { kind: "bot", mood: "grin" } },
  { id: "con", name: "Con", emoji: "👎", color: C.terracotta, tagline: "Argues against it", look: { kind: "bot", mood: "frown" } },
  {
    id: "judge",
    name: "Judge",
    emoji: "🧑‍⚖️",
    color: C.gold,
    tagline: "Scores both sides",
    look: { kind: "bot", mood: "calm", extras: ["judge-cap"] },
  },
];
