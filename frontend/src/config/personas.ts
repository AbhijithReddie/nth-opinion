/**
 * The AI personas of each chat room, for the UI. Ids must match the backend
 * room configs (backend/rooms/*.py); GET /api/rooms returns the same data.
 */

export interface Persona {
  id: string;
  name: string;
  emoji: string;
  /** Hex accent colour for names, avatars and mentions. */
  color: string;
  /** One-line personality for setup cards. */
  tagline: string;
}

export const GROUP_CHAT_FRIENDS: Persona[] = [
  { id: "rohit", name: "Rohit", emoji: "😏", color: "#F97316", tagline: "Sarcastic roaster who secretly gives the best advice" },
  { id: "priya", name: "Priya", emoji: "🌸", color: "#EC4899", tagline: "Warm and supportive, asks how you actually feel" },
  { id: "vikram", name: "Vikram", emoji: "🧐", color: "#38BDF8", tagline: "Blunt realist who points out the risks" },
  { id: "ananya", name: "Ananya", emoji: "✨", color: "#FACC15", tagline: "Cheerful hype friend, ALL CAPS and emojis" },
  { id: "arjun", name: "Arjun", emoji: "😤", color: "#EF4444", tagline: "Hot-headed, angry on your behalf, fiercely loyal" },
  { id: "meera", name: "Meera", emoji: "🍵", color: "#A78BFA", tagline: "Calm, wise, elder-sibling energy" },
];

export const SHARKS: Persona[] = [
  { id: "kavya", name: "Kavya", emoji: "📊", color: "#38BDF8", tagline: "The Numbers Shark: unit economics or nothing" },
  { id: "aditya", name: "Aditya", emoji: "🚀", color: "#A78BFA", tagline: "The Visionary: asks how big this can get" },
  { id: "rustom", name: "Rustom", emoji: "🤨", color: "#F6C453", tagline: "The Skeptic: finds every hole" },
];

export const ROAST_PANEL: Persona[] = [
  { id: "kabir", name: "Kabir", emoji: "🌶️", color: "#FF5C7A", tagline: "The Roaster: no mercy, all love" },
  { id: "nandini", name: "Nandini", emoji: "🧭", color: "#34D399", tagline: "The Mentor: turns jokes into fixes" },
  { id: "sameer", name: "Sameer", emoji: "📎", color: "#F6C453", tagline: "The Recruiter: reads it like a hiring manager" },
];

export const INTERVIEWERS: Persona[] = [
  { id: "pooja", name: "Pooja", emoji: "🤝", color: "#EC4899", tagline: "HR: motivation, culture fit and communication" },
  { id: "karthik", name: "Karthik", emoji: "💻", color: "#38BDF8", tagline: "Tech lead: goes deep on your projects" },
  { id: "devraj", name: "Devraj", emoji: "🗂️", color: "#F6C453", tagline: "Hiring manager: skeptical, wants proof of impact" },
];

export const FUTURE_SELVES: Persona[] = [
  { id: "you30", name: "You at 30", emoji: "🧑", color: "#38BDF8", tagline: "Close enough to remember, far enough to see clearly" },
  { id: "you50", name: "You at 50", emoji: "🧓", color: "#F6C453", tagline: "The long view: values, people and regrets" },
];

export const STUDY_BUDDIES: Persona[] = [
  { id: "bunty", name: "Bunty", emoji: "😵‍💫", color: "#A78BFA", tagline: "The confused friend: asks what you're afraid to ask" },
  { id: "ishaan", name: "Ishaan", emoji: "🏆", color: "#F6C453", tagline: "The topper: explains it properly" },
  { id: "tanvi", name: "Tanvi", emoji: "🤣", color: "#34D399", tagline: "The meme-maker: makes it stick" },
];
