/**
 * Chat rooms: everything the shared chat UI needs to know about each room.
 *
 * The setup screen, chat screen, storage and API calls are the same for every
 * room; this config supplies the cast, the setup fields, the wording and the
 * kind of final summary. Adding a chat room = a backend config file + an entry here
 * + a page that renders <RoomChatLoader roomId="..." />.
 */

import { FUTURE_SELVES, GROUP_CHAT_FRIENDS, INTERVIEWERS, ROAST_PANEL, SHARKS, STUDY_BUDDIES, type Persona } from "./personas";

export const LANGUAGES = [
  { id: "english", label: "English", hint: "Casual, with Indian slang" },
  { id: "hinglish", label: "Hinglish", hint: "Hindi + English" },
  { id: "tenglish", label: "Tenglish", hint: "Telugu + English" },
] as const;

export type Language = (typeof LANGUAGES)[number]["id"];

export const NAME_MAX = 20;
export const MESSAGE_MAX = 1000;

/** An extra detail asked on the setup screen and sent to the backend as `context` (see backend ContextField). */
export interface ContextFieldConfig {
  id: string;
  label: string;
  placeholder: string;
  max: number;
  required: boolean;
  hint?: string;
  /** A large textarea (e.g. a pasted resume) instead of a one-line input. */
  multiline?: boolean;
  /** Textarea height in lines (default 10). */
  rows?: number;
  /** Extra check on the trimmed value; returns a message for the user, or null if it's fine. */
  validate?: (value: string) => string | null;
}

export type SummaryType = "poll" | "offers" | "scorecard" | "interview" | "letters" | "notes";

/** A phase of a room with modes (see backend Mode). The first one is where the room starts. */
export interface RoomModeConfig {
  id: string;
  /** Short label for the header chip, e.g. "🔥 Roast". */
  label: string;
  /** Divider text shown in the chat when the room switches into this mode. */
  divider: string;
  /** Button text that switches into this mode. */
  switchLabel: string;
}

export interface RoomChatConfig {
  roomId: string;
  /** localStorage key for this room's setup and chat. */
  storageKey: string;
  personas: Persona[];
  cast: {
    min: number;
    max: number;
    /** Pre-selected persona ids for a new room. */
    defaults: string[];
    /** Can the user rename the personas? */
    renamable: boolean;
    heading: string;
    /** Plural noun for the cast, e.g. "friends". */
    noun: string;
  };
  /** The room's title field (group name / startup name). */
  title: {
    label: string;
    default: string;
    placeholder: string;
    max: number;
    /** Also send the title to the backend as this context field. */
    contextKey?: string;
  };
  contextFields: ContextFieldConfig[];
  copy: {
    eyebrow: string;
    heading: string;
    editHeading: string;
    intro: string;
    create: string;
    /** Chat menu item that reopens the setup screen. */
    editMenu: string;
    /** Empty chat. `{title}` and `{names}` are filled in. */
    emptyTitle: string;
    emptyIntro: string;
    starters: string[];
  };
  summary: { type: SummaryType; button: string; loading: string };
  composer: { placeholder: string; note: string };
  /** Optional phases; the user and the director can switch between them. */
  modes?: RoomModeConfig[];
}

export const ROOM_CHATS = {
  "group-chat": {
    roomId: "group-chat",
    storageKey: "huddle.room.group-chat.v2",
    personas: GROUP_CHAT_FRIENDS,
    cast: { min: 3, max: 4, defaults: ["rohit", "priya", "meera"], renamable: true, heading: "Friends", noun: "friends" },
    title: { label: "Group name", default: "The Gang", placeholder: "The Gang", max: 40 },
    contextFields: [],
    copy: {
      eyebrow: "The Group Chat",
      heading: "Build your group",
      editHeading: "Edit your group",
      intro: "Pick 3 or 4 friends to talk your problem through with. Rename them if you like.",
      create: "Create group",
      editMenu: "Edit group",
      emptyTitle: "{title} is ready",
      emptyIntro: "Tell {names} what's on your mind. Try one of these:",
      starters: [
        "Should I text my crush first?",
        "My manager took credit for my work again.",
        "MBA abroad or a job offer in Bangalore?",
      ],
    },
    summary: { type: "poll", button: "Ask the group to vote", loading: "Counting votes" },
    composer: { placeholder: "Message the group...", note: "AI friends, real perspectives. Not professional advice." },
  },
  "shark-tank": {
    roomId: "shark-tank",
    storageKey: "huddle.room.shark-tank.v1",
    personas: SHARKS,
    cast: { min: 3, max: 3, defaults: ["kavya", "aditya", "rustom"], renamable: false, heading: "Your panel", noun: "investors" },
    title: { label: "Startup name", default: "", placeholder: "e.g. ChaiCart", max: 60, contextKey: "startup" },
    contextFields: [
      {
        id: "ask",
        label: "Your ask",
        placeholder: "e.g. ₹50 lakh for 5% equity",
        max: 80,
        required: true,
        hint: "How much you're raising, for how much equity.",
      },
      {
        id: "sector",
        label: "One-liner (optional)",
        placeholder: "e.g. Fresh chai kiosks at metro stations",
        max: 120,
        required: false,
      },
    ],
    copy: {
      eyebrow: "Shark Tank Pitch Room",
      heading: "Step into the tank",
      editHeading: "Edit your pitch details",
      intro: "Three investors will grill you on your startup, then decide whether to make you an offer.",
      create: "Enter the tank",
      editMenu: "Edit pitch details",
      emptyTitle: "The panel is ready for {title}",
      emptyIntro: "Pitch to {names}. Cover the problem, your solution, traction and why you. For example:",
      starters: [
        "Hi Sharks! We solve ... for ..., and we've made ₹... in revenue so far.",
        "Our customers are ..., they pay ₹... per month, and we're growing ...% month on month.",
      ],
    },
    summary: { type: "offers", button: "Ask for offers", loading: "Investors are deciding" },
    composer: { placeholder: "Pitch or answer the investors...", note: "AI investors, real questions. Not financial advice." },
  },
  "roast-and-toast": {
    roomId: "roast-and-toast",
    storageKey: "huddle.room.roast-and-toast.v1",
    personas: ROAST_PANEL,
    cast: { min: 3, max: 3, defaults: ["kabir", "nandini", "sameer"], renamable: false, heading: "Your panel", noun: "panelists" },
    title: { label: "What are we reviewing?", default: "", placeholder: "e.g. My SDE resume", max: 60, contextKey: "title" },
    contextFields: [
      {
        id: "material",
        label: "Paste it here",
        placeholder: "Paste your resume, project README, portfolio text or pitch...",
        max: 6000,
        required: true,
        multiline: true,
        hint: "Plain text works best. Remove your phone number, email and address before pasting.",
      },
      {
        id: "goal",
        label: "Your goal (optional)",
        placeholder: "e.g. SDE-1 roles at product companies",
        max: 120,
        required: false,
      },
    ],
    copy: {
      eyebrow: "Roast & Toast",
      heading: "Get roasted, then get better",
      editHeading: "Edit what's being reviewed",
      intro: "Three panelists roast your resume or project, then switch to honest, specific feedback.",
      create: "Start the roast",
      editMenu: "Edit material",
      emptyTitle: "The panel has read {title}",
      emptyIntro: "Say the word and {names} will begin. Try:",
      starters: ["Roast me. Don't hold back.", "Be gentle, it's my first resume 🥲", "Skip the jokes, what would get me rejected?"],
    },
    summary: { type: "scorecard", button: "Get my scorecard", loading: "Scoring" },
    composer: { placeholder: "Reply to the panel...", note: "AI panel, real feedback. Not professional career advice." },
    modes: [
      { id: "roast", label: "🔥 Roast", divider: "🔥 The roast is on", switchLabel: "🔥 Roast me again" },
      { id: "toast", label: "🥂 Toast", divider: "🥂 Toast time: real feedback", switchLabel: "🥂 Switch to real feedback" },
    ],
  },
  "interview-panel": {
    roomId: "interview-panel",
    storageKey: "huddle.room.interview-panel.v1",
    personas: INTERVIEWERS,
    cast: { min: 3, max: 3, defaults: ["pooja", "karthik", "devraj"], renamable: false, heading: "Your panel", noun: "interviewers" },
    title: { label: "Role you're interviewing for", default: "", placeholder: "e.g. SDE-1 (Backend)", max: 80, contextKey: "role" },
    contextFields: [
      {
        id: "resume",
        label: "Paste your resume",
        placeholder: "Paste your resume as plain text. The panel will ask about what's on it...",
        max: 6000,
        required: true,
        multiline: true,
        hint: "Remove your phone number, email and address before pasting.",
      },
      {
        id: "company",
        label: "Company (optional)",
        placeholder: "e.g. a fintech startup, or a product company",
        max: 80,
        required: false,
      },
    ],
    copy: {
      eyebrow: "Interview Panel",
      heading: "Practise your interview",
      editHeading: "Edit interview details",
      intro: "Three interviewers question you about your resume, one question at a time, then decide: hire or no hire?",
      create: "Start the interview",
      editMenu: "Edit interview details",
      emptyTitle: "The panel is ready: {title}",
      emptyIntro: "{names} have read your resume. Say hello to begin:",
      starters: ["Hi, I'm ready to start.", "Hello everyone, thanks for having me!"],
    },
    summary: { type: "interview", button: "End interview & get feedback", loading: "The panel is deciding" },
    composer: { placeholder: "Answer the panel...", note: "AI interviewers for practice. Not a real hiring decision." },
  },
  "future-you": {
    roomId: "future-you",
    storageKey: "huddle.room.future-you.v1",
    personas: FUTURE_SELVES,
    cast: { min: 2, max: 2, defaults: ["you30", "you50"], renamable: false, heading: "Who's joining you", noun: "future selves" },
    title: {
      label: "The decision you're facing",
      default: "",
      placeholder: "e.g. Job offer in Bangalore, or a master's abroad?",
      max: 160,
      contextKey: "decision",
    },
    contextFields: [
      {
        id: "age",
        label: "Your age now",
        placeholder: "e.g. 21",
        max: 2,
        required: true,
        hint: "Between 13 and 29, so 30 and 50 are still ahead of you.",
        // Mirrors the backend check in rooms/future_you.py.
        validate: (v) => (/^\d+$/.test(v) && +v >= 13 && +v <= 29 ? null : "Your age needs to be between 13 and 29."),
      },
      {
        id: "about",
        label: "A bit about your life right now (optional)",
        placeholder: "Studies, work, family, what you care about, what scares you about this choice...",
        max: 1000,
        required: false,
        multiline: true,
        rows: 4,
        hint: "The more they know, the more specific they can be.",
      },
    ],
    copy: {
      eyebrow: "Future You",
      heading: "Ask your future selves",
      editHeading: "Edit your decision",
      intro: "You at 30 and you at 50 remember being exactly where you are. Talk it through with them.",
      create: "Meet future me",
      editMenu: "Edit decision",
      emptyTitle: "Your future selves are here",
      emptyIntro: "{names} want to hear what you're torn between. Start with:",
      starters: ["Okay, here's what I'm torn between...", "What would you do if you were me?", "What did I worry about that didn't matter?"],
    },
    summary: { type: "letters", button: "Get letters from future you", loading: "Writing your letters" },
    composer: { placeholder: "Talk to your future selves...", note: "Imagined perspectives, not predictions or professional advice." },
  },
  "study-group": {
    roomId: "study-group",
    storageKey: "huddle.room.study-group.v1",
    personas: STUDY_BUDDIES,
    cast: { min: 3, max: 3, defaults: ["bunty", "ishaan", "tanvi"], renamable: false, heading: "Your study group", noun: "study buddies" },
    title: { label: "What do you want to learn?", default: "", placeholder: "e.g. Photosynthesis, or Binary search trees", max: 120, contextKey: "topic" },
    contextFields: [
      {
        id: "level",
        label: "Your level (optional)",
        placeholder: "e.g. Class 10, B.Tech 2nd year, total beginner",
        max: 60,
        required: false,
      },
      {
        id: "notes",
        label: "Your notes or syllabus (optional)",
        placeholder: "Paste class notes, a syllabus or textbook points you want to cover...",
        max: 4000,
        required: false,
        multiline: true,
        rows: 6,
      },
    ],
    copy: {
      eyebrow: "Study Group",
      heading: "Study with friends",
      editHeading: "Edit what you're studying",
      intro: "Learn any topic with a confused friend, the class topper and a meme-maker, then get quizzed on it.",
      create: "Start studying",
      editMenu: "Edit topic",
      emptyTitle: "Let's learn {title}",
      emptyIntro: "{names} are ready. Try:",
      starters: ["Explain it from the very basics.", "I have an exam tomorrow, what matters most?", "Quiz me, I think I know this."],
    },
    summary: { type: "notes", button: "Make my study notes", loading: "Writing your notes" },
    composer: { placeholder: "Ask, answer or say 'quiz me'...", note: "AI study buddies can make mistakes. Check important facts." },
    modes: [
      { id: "learn", label: "📖 Learn", divider: "📖 Back to learning", switchLabel: "📖 Explain more" },
      { id: "quiz", label: "📝 Quiz", divider: "📝 Quiz time", switchLabel: "📝 Quiz me" },
    ],
  },
} satisfies Record<string, RoomChatConfig>;

export type RoomChatId = keyof typeof ROOM_CHATS;

export function personaById(config: RoomChatConfig, id: string): Persona | undefined {
  return config.personas.find((p) => p.id === id);
}
