/**
 * Every Huddle room in one place. The navbar, home page grid and coming-soon
 * pages all read from this list, so adding a room starts here.
 */

export type RoomStatus = "live" | "soon";

export interface RoomCastMember {
  name: string;
  role: string;
  emoji: string;
}

export interface RoomMeta {
  id: string;
  title: string;
  /** Emoji icon shown on cards and in menus. */
  icon: string;
  /** One-line description for menus and cards. */
  description: string;
  status: RoomStatus;
  href: string;
  /** Accent colour (hex) for the card glow and icon tile. */
  accent: string;
  /** Who's in the room, for the coming-soon preview and cards. */
  cast: RoomCastMember[];
}

export const ROOMS: RoomMeta[] = [
  {
    id: "debate",
    title: "Debate Arena",
    icon: "⚖️",
    description: "Pro vs Con argue any topic; a Judge scores them.",
    status: "live",
    href: "/debate",
    accent: "#2EE6D6",
    cast: [
      { name: "Pro", role: "Argues for the motion", emoji: "👍" },
      { name: "Con", role: "Argues against it", emoji: "👎" },
      { name: "Judge", role: "Scores both sides", emoji: "🧑‍⚖️" },
    ],
  },
  {
    id: "group-chat",
    title: "The Group Chat",
    icon: "💬",
    description: "Share a problem with a WhatsApp-style group of AI friends.",
    status: "live",
    href: "/rooms/group-chat",
    accent: "#8B7CFF",
    cast: [
      { name: "Rohit", role: "Sarcastic, secretly wise", emoji: "😏" },
      { name: "Priya", role: "Warm and supportive", emoji: "🌸" },
      { name: "Vikram", role: "Blunt realist", emoji: "🧐" },
      { name: "Ananya", role: "Hype friend", emoji: "✨" },
      { name: "Arjun", role: "Angry on your behalf", emoji: "😤" },
      { name: "Meera", role: "Calm elder sibling", emoji: "🍵" },
    ],
  },
  {
    id: "shark-tank",
    title: "Shark Tank Pitch Room",
    icon: "🦈",
    description: "Pitch your startup idea to 3 investors who grill you and make offers.",
    status: "live",
    href: "/rooms/shark-tank",
    accent: "#38BDF8",
    cast: [
      { name: "Kavya", role: "The Numbers Shark", emoji: "📊" },
      { name: "Aditya", role: "The Visionary", emoji: "🚀" },
      { name: "Rustom", role: "The Skeptic", emoji: "🤨" },
    ],
  },
  {
    id: "interview-panel",
    title: "Interview Panel",
    icon: "🎤",
    description: "HR, a tech lead and a skeptical manager interview you from your resume.",
    status: "live",
    href: "/rooms/interview-panel",
    accent: "#F6C453",
    cast: [
      { name: "Pooja", role: "HR", emoji: "🤝" },
      { name: "Karthik", role: "Tech lead", emoji: "💻" },
      { name: "Devraj", role: "Hiring manager", emoji: "🗂️" },
    ],
  },
  {
    id: "future-you",
    title: "Future You",
    icon: "⏳",
    description: "You at 30 and 50 talk through a decision with you now.",
    status: "live",
    href: "/rooms/future-you",
    accent: "#A78BFA",
    cast: [
      { name: "You at 30", role: "Just lived through it", emoji: "🧑" },
      { name: "You at 50", role: "Sees the long game", emoji: "🧓" },
    ],
  },
  {
    id: "roast-and-toast",
    title: "Roast & Toast",
    icon: "🔥",
    description: "Your resume or project gets roasted, then gets real feedback.",
    status: "live",
    href: "/rooms/roast-and-toast",
    accent: "#FF5C7A",
    cast: [
      { name: "Kabir", role: "The Roaster", emoji: "🌶️" },
      { name: "Nandini", role: "The Mentor", emoji: "🧭" },
      { name: "Sameer", role: "The Recruiter", emoji: "📎" },
    ],
  },
  {
    id: "study-group",
    title: "Study Group",
    icon: "📚",
    description: "Learn a topic with a confused friend, the class topper and a meme-maker.",
    status: "soon",
    href: "/rooms/study-group",
    accent: "#34D399",
    cast: [
      { name: "The Confused Friend", role: "Asks what you're afraid to", emoji: "😵‍💫" },
      { name: "The Topper", role: "Explains it properly", emoji: "🏆" },
      { name: "The Meme-Maker", role: "Makes it stick", emoji: "🤣" },
    ],
  },
];

export const LIVE_ROOMS = ROOMS.filter((r) => r.status === "live");

export function getRoom(id: string): RoomMeta {
  const room = ROOMS.find((r) => r.id === id);
  if (!room) throw new Error(`Unknown room: ${id}`);
  return room;
}
