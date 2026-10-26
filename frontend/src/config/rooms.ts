/**
 * Every Nth Opinion room in one place. The navbar, home page grid, room pages and
 * coming-soon pages all read from this list, so adding a room starts here.
 */

import type { SummaryData } from "@/lib/chatTypes";
import type { Verdict } from "@/lib/types";
import type { FlowKind } from "./flows";
import { DEBATERS, FUTURE_SELVES, GROUP_CHAT_FRIENDS, INTERVIEWERS, ROAST_PANEL, SHARKS, STUDY_BUDDIES, type Persona } from "./personas";

export type RoomStatus = "live" | "soon";

/**
 * One line of a hand-written sample conversation: a message from "user" or a
 * persona id (the Debate Arena uses "pro" and "con"), or a switch of room mode.
 */
export type SampleLine =
  | {
      sender: string;
      text: string;
      /** Index of the line this one replies to. */
      replyTo?: number;
      reactions?: { by: string; emoji: string }[];
    }
  | { mode: string };

/** The final result of a sample: the room's summary card, or the debate judge's verdict. */
export type SampleResult = SummaryData | { type: "verdict"; data: Verdict };

export interface RoomExample {
  /** The example question or input, shown on the home page card and above the sample. */
  prompt: string;
  /**
   * What "Try this example" fills in: the setup form's title and context fields (chat rooms),
   * and the first message to send (or, in the Debate Arena, the topic).
   */
  fill: { title?: string; context?: Record<string, string>; message: string };
  conversation: SampleLine[];
  result: SampleResult;
}

export interface RoomMeta {
  /** Also the backend room id. */
  id: string;
  title: string;
  /** One-line description for menus and cards. */
  description: string;
  status: RoomStatus;
  href: string;
  /** Accent colour token (a CSS colour) for tiles, blobs and borders. */
  accent: string;
  /** A darker shade of the accent that passes WCAG AA as text. */
  accentInk: string;
  /** Who's in the room, for avatars on cards and the coming-soon preview. */
  cast: Persona[];
  /** How the room's agents run, for the "Behind the scenes" diagram (see config/flows.ts). */
  flow: FlowKind;
  example: RoomExample;
}

export const ROOMS: RoomMeta[] = [
  {
    id: "debate",
    title: "Debate Arena",
    description: "Pro vs Con argue any topic; a Judge scores them.",
    status: "live",
    href: "/debate",
    accent: "var(--color-room-debate)",
    accentInk: "var(--color-room-debate-ink)",
    cast: DEBATERS,
    flow: "debate",
    example: {
      prompt: "Should college students learn AI tools before learning to code?",
      fill: { message: "Should college students learn AI tools before learning to code?" },
      conversation: [
        {
          sender: "pro",
          text: "Yes. A first-year student can build a working project with AI tools in one weekend, and that early win is what keeps people in tech. You learn to drive before you learn how the engine works.",
        },
        {
          sender: "con",
          text: "But here the engine is the job. Students who lean on AI before they can read code can't tell when it's confidently wrong, and debugging is where real understanding comes from.",
        },
        {
          sender: "pro",
          text: "Nobody is saying skip the fundamentals. Use AI as a patient tutor: ask it why the code works, line by line. That still teaches you to code, just faster and with less fear.",
        },
        {
          sender: "con",
          text: "A tutor that hands you the answer isn't teaching you. The struggle builds the mental model. Fundamentals first, and then AI makes you ten times faster instead of ten times more dependent.",
        },
      ],
      result: {
        type: "verdict",
        data: {
          scores: { pro: { logic: 7, evidence: 6, rebuttal: 7 }, con: { logic: 8, evidence: 7, rebuttal: 8 } },
          winner: "con",
          memo: "Con wins on the dependency argument: Pro never fully explained how a beginner would spot a wrong AI answer. Pro's strongest point, that early wins keep students motivated, still deserves a place in any course.\n\nRecommendation: teach core coding first, and bring AI tools in early as a study aid, not a replacement.",
        },
      },
    },
  },
  {
    id: "group-chat",
    title: "The Group Chat",
    description: "Share a problem with a WhatsApp-style group of AI friends.",
    status: "live",
    href: "/rooms/group-chat",
    accent: "var(--color-room-group-chat)",
    accentInk: "var(--color-room-group-chat-ink)",
    cast: GROUP_CHAT_FRIENDS,
    flow: "director",
    example: {
      prompt: "I want to express my love to a girl... should I propose in person or write a beautiful love letter?",
      fill: {
        title: "The Gang",
        message: "I want to express my love to a girl... should I propose in person or write a beautiful love letter?",
      },
      conversation: [
        { sender: "user", text: "I want to express my love to a girl... should I propose in person or write a beautiful love letter?" },
        {
          sender: "rohit",
          text: "\"Beautiful love letter\" 😂 bro is living in 1998. Okay okay, real question: can you actually write, or will it read like a leave application?",
          reactions: [{ by: "meera", emoji: "😂" }],
        },
        {
          sender: "priya",
          text: "Ignore him 🙈 Both can be so sweet! What matters is what she'd be comfortable with. Is she a big-moments person or a quiet-moments person?",
        },
        {
          sender: "meera",
          text: "Say it in person, but keep it simple and private, not in front of friends. Carry a short note too. If the words get stuck, just hand it over. And give her space to answer, no pressure.",
          reactions: [
            { by: "priya", emoji: "❤️" },
            { by: "rohit", emoji: "💯" },
          ],
        },
        { sender: "rohit", text: "@Meera okay this is actually smart. In person, with a backup letter. Even I can't roast that.", replyTo: 3 },
      ],
      result: {
        type: "poll",
        data: {
          question: "Propose in person or write a love letter?",
          options: ["In person, with a short note", "In person", "A love letter"],
          votes: [
            { friend_id: "rohit", option: "In person, with a short note", reason: "Letter as backup, your face as the main event." },
            { friend_id: "priya", option: "A love letter", reason: "If you get nervous, a letter lets you say everything properly." },
            { friend_id: "meera", option: "In person, with a short note", reason: "Honest and private, and she can answer in her own time." },
          ],
        },
      },
    },
  },
  {
    id: "shark-tank",
    title: "Pitch Tank",
    description: "Pitch your startup idea to 3 investors who grill you and make offers.",
    status: "live",
    href: "/rooms/pitch-tank",
    accent: "var(--color-room-pitch)",
    accentInk: "var(--color-room-pitch-ink)",
    cast: SHARKS,
    flow: "director",
    example: {
      prompt: "An app that connects home cooks with office workers for affordable homemade lunch delivery.",
      fill: {
        title: "GharKaDabba",
        context: {
          ask: "₹40 lakh for 8% equity",
          sector: "An app that connects home cooks with office workers for affordable homemade lunch delivery.",
        },
        message:
          "Hi everyone! GharKaDabba is an app that connects home cooks with office workers for affordable homemade lunch delivery. We're live in two tech parks in Pune with 40 home cooks, and I'm asking for ₹40 lakh for 8%.",
      },
      conversation: [
        {
          sender: "user",
          text: "Hi everyone! GharKaDabba connects home cooks with office workers for affordable homemade lunch delivery. We're live in two Pune tech parks with 40 cooks.",
        },
        { sender: "kavya", text: "Numbers first. What does one lunch cost the customer, what does the cook get, and what's left for you after delivery?" },
        { sender: "user", text: "₹120 a meal. The cook keeps ₹80, delivery costs ₹25, so we make ₹15 an order. We do 300 orders a day." },
        {
          sender: "rustom",
          text: "₹15 a plate is a hobby, not a business. And what happens the first time someone gets sick from a home kitchen? Do you check them?",
        },
        {
          sender: "aditya",
          text: "But zoom out. Every office park in India needs this, and a cook selling 20 meals a day from home is a real income story. How fast can you open a new city?",
          reactions: [{ by: "kavya", emoji: "🤔" }],
        },
      ],
      result: {
        type: "offers",
        data: {
          summary: "Kavya and Aditya see a real market but want better margins. Rustom is out until there's a food-safety process.",
          strengths: ["Real traction: 300 orders a day", "A strong story for home cooks"],
          concerns: ["Thin ₹15 margin per order", "No food-safety checks yet"],
          decisions: [
            {
              friend_id: "kavya",
              decision: "offer",
              amount_lakh: 40,
              equity_percent: 12,
              conditions: "Margin above ₹25 an order within 6 months",
              reason: "Fix the margin and this works.",
            },
            {
              friend_id: "aditya",
              decision: "offer",
              amount_lakh: 40,
              equity_percent: 10,
              conditions: null,
              reason: "I'm backing the founder and the market size.",
            },
            {
              friend_id: "rustom",
              decision: "out",
              amount_lakh: null,
              equity_percent: null,
              conditions: null,
              reason: "Come back with a kitchen-hygiene audit and I'll listen.",
            },
          ],
        },
      },
    },
  },
  {
    id: "interview-panel",
    title: "Interview Panel",
    description: "HR, a tech lead and a skeptical manager interview you from your resume.",
    status: "live",
    href: "/rooms/interview-panel",
    accent: "var(--color-room-interview)",
    accentInk: "var(--color-room-interview-ink)",
    cast: INTERVIEWERS,
    flow: "director",
    example: {
      prompt: "A fresher applying for a Data Analyst role, with Python, SQL and Power BI skills.",
      fill: {
        title: "Data Analyst (Fresher)",
        context: {
          resume: [
            "B.Tech in Computer Science, graduating 2025. CGPA 8.1.",
            "",
            "Skills: Python (pandas, matplotlib), SQL, Power BI, Excel.",
            "",
            "Project: Retail sales dashboard",
            "- Built a Power BI dashboard on 50,000 orders from a public retail dataset.",
            "- Wrote SQL queries for monthly revenue, top products and repeat customers.",
            "- Found that 20% of products made 70% of the revenue.",
            "",
            "Internship: Data cleaning intern at a local startup (2 months).",
            "- Cleaned and merged customer spreadsheets in Python.",
          ].join("\n"),
          company: "a retail analytics company",
        },
        message: "Hi, I'm ready to start.",
      },
      conversation: [
        { sender: "user", text: "Hi, I'm ready to start." },
        {
          sender: "pooja",
          text: "Welcome! Let's keep this relaxed. Tell us a little about yourself, and why data analysis rather than software development?",
        },
        { sender: "user", text: "I like finding the story in numbers. In my Power BI project I found that 20% of products made 70% of the revenue, and that was exciting." },
        { sender: "karthik", text: "Nice. How did you get revenue per product? Walk me through the SQL." },
        { sender: "user", text: "I joined orders with products on product_id, grouped by product, summed quantity times price, and sorted it in descending order." },
        { sender: "devraj", text: "Fine. But what would a store manager actually do differently after seeing your dashboard?" },
      ],
      result: {
        type: "interview",
        data: {
          decision: "offer",
          summary: "Clear basics and a real project. Next step: tie every insight to a business decision.",
          verdicts: [
            { friend_id: "pooja", recommendation: "hire", reason: "Curious, and explains things clearly." },
            { friend_id: "karthik", recommendation: "hire", reason: "Solid SQL thinking for a fresher." },
            { friend_id: "devraj", recommendation: "no_hire", reason: "Couldn't yet show business impact." },
          ],
          competencies: [
            { name: "SQL", score: 4, note: "Joins and grouping explained well" },
            { name: "Communication", score: 4, note: "Calm and structured" },
            { name: "Business thinking", score: 2, note: "Stopped at the insight" },
            { name: "Python", score: 3, note: "Not tested in depth" },
          ],
          strengths: ["Explained the SQL step by step", "Backed claims with a real finding"],
          improvements: ["End every insight with a recommended action"],
        },
      },
    },
  },
  {
    id: "future-you",
    title: "Future You",
    description: "You at 30 and 50 talk through a decision with you now.",
    status: "live",
    href: "/rooms/future-you",
    accent: "var(--color-room-future)",
    accentInk: "var(--color-room-future-ink)",
    cast: FUTURE_SELVES,
    flow: "director",
    example: {
      prompt: "Should I take a high-paying job in another city or stay near my family?",
      fill: {
        title: "Should I take a high-paying job in another city or stay near my family?",
        context: {
          age: "22",
          about:
            "Final-year engineering student. I have an offer from a Bangalore company at almost double the salary of a job in my hometown. My parents are getting older and I'm the only child living near them.",
        },
        message: "I got the Bangalore offer. Part of me wants to go, and part of me feels guilty about leaving my parents.",
      },
      conversation: [
        { sender: "user", text: "I got the Bangalore offer. Part of me wants to go, and part of me feels guilty about leaving my parents." },
        {
          sender: "you30",
          text: "I remember that guilt so well. Here's what I know now: those first two years in a new city grew me faster than anything else. But call home every Sunday, not just when you remember.",
        },
        {
          sender: "you50",
          text: "Money matters less than you think, and time with your parents matters more. But they didn't raise you to stay small for their sake. Ask them what they want for you.",
          reactions: [{ by: "you30", emoji: "❤️" }],
        },
        { sender: "user", text: "What if something happens to them while I'm away?" },
        {
          sender: "you30",
          text: "Bangalore is a short flight away, not another planet. Keep a small fund just for tickets home. That one rule made leaving feel okay.",
        },
      ],
      result: {
        type: "letters",
        data: {
          decision: "A job in Bangalore, or stay near family?",
          paths: [
            { option: "Take the Bangalore job", upside: "Faster growth, savings and independence", risk: "Guilt, and missing everyday moments at home" },
            { option: "Stay near family", upside: "Present for your parents, lower costs", risk: "Slower career and a nagging 'what if'" },
          ],
          letters: [
            {
              friend_id: "you30",
              letter: "Go, and go properly. Save for flights before anything else, and visit every couple of months. You'll come back more confident, and your parents will love hearing about your new life.",
            },
            {
              friend_id: "you50",
              letter: "Whatever you choose, choose it out loud, with your parents, not alone in your head. The decision matters less than how close you stay while you make it.",
            },
          ],
          next_steps: ["Talk to your parents about the offer this week", "Add a monthly flight home to your budget"],
          question: "If your parents could choose for you, what would they want you to pick?",
        },
      },
    },
  },
  {
    id: "roast-and-toast",
    title: "Roast & Toast",
    description: "Your resume or project gets roasted, then gets real feedback.",
    status: "live",
    href: "/rooms/roast-and-toast",
    accent: "var(--color-room-roast)",
    accentInk: "var(--color-room-roast-ink)",
    cast: ROAST_PANEL,
    flow: "director",
    example: {
      prompt: "A fresher's resume summary: \"Hardworking and passionate fresher\" with one weather app project.",
      fill: {
        title: "My fresher resume",
        context: {
          material: [
            "Summary: Hardworking and passionate fresher looking for a challenging role in a reputed organisation where I can utilise my skills.",
            "",
            "Education: B.Tech, Information Technology, 2025. CGPA 7.8.",
            "",
            "Skills: Java, Python, HTML, CSS, MS Office, Team player.",
            "",
            "Project: Weather App, a website that shows the weather for any city using an API.",
          ].join("\n"),
          goal: "Junior web developer roles",
        },
        message: "Roast me. Don't hold back.",
      },
      conversation: [
        { sender: "user", text: "Roast me. Don't hold back." },
        {
          sender: "kabir",
          text: "\"Hardworking and passionate fresher looking for a challenging role in a reputed organisation.\" Congratulations, you've written the same sentence as four lakh other resumes 🔥",
          reactions: [{ by: "sameer", emoji: "😂" }],
        },
        {
          sender: "sameer",
          text: "And \"MS Office\" and \"Team player\" listed as skills? I've stopped reading by then. One weather app, no link, no users.",
        },
        { mode: "toast" },
        {
          sender: "nandini",
          text: "Okay, real feedback. The weather app is a genuine start. Add the live link, the API you used, and one problem you solved, like caching results so it loads faster.",
          reactions: [{ by: "kabir", emoji: "👏" }],
        },
        { sender: "kabir", text: "Do that and I'll have to find something else to roast 😤" },
      ],
      result: {
        type: "scorecard",
        data: {
          overall: 5,
          verdict: "A solid start hidden behind a generic summary.",
          scores: [
            { category: "Summary", score: 3, note: "Generic; says nothing specific about you" },
            { category: "Projects", score: 5, note: "One project, with no link or impact" },
            { category: "Skills", score: 6, note: "Good basics, but trim the filler" },
          ],
          fixes: [
            { title: "Rewrite the summary", detail: "One line: who you are, your stack and what you built.", friend_id: "nandini" },
            { title: "Link the weather app", detail: "Add the live demo, the GitHub repo and one technical detail.", friend_id: "sameer" },
          ],
          best_roast: "You've written the same sentence as four lakh other resumes.",
          best_toast: "The weather app is a genuine start.",
        },
      },
    },
  },
  {
    id: "study-group",
    title: "Study Group",
    description: "Learn a topic with a confused friend, the class topper and a meme-maker.",
    status: "live",
    href: "/rooms/study-group",
    accent: "var(--color-room-study)",
    accentInk: "var(--color-room-study-ink)",
    cast: STUDY_BUDDIES,
    flow: "director",
    example: {
      prompt: "Explain how neural networks learn.",
      fill: {
        title: "How neural networks learn",
        context: { level: "B.Tech 2nd year" },
        message: "Explain how neural networks learn.",
      },
      conversation: [
        { sender: "user", text: "Explain how neural networks learn." },
        {
          sender: "ishaan",
          text: "Think of it as guess, check, adjust. The network makes a prediction, a loss function measures how wrong it was, and then every weight gets nudged a tiny bit to be less wrong. Repeat that thousands of times.",
        },
        { sender: "bunty", text: "Wait, how does it know WHICH weights to nudge? There are like a million of them 😵‍💫" },
        {
          sender: "ishaan",
          text: "That's backpropagation. It works backwards from the error and uses the chain rule to work out how much each weight contributed. Then gradient descent moves each weight a small step downhill.",
          replyTo: 2,
        },
        {
          sender: "tanvi",
          text: "So basically the network failed a test, checked which answers were wrong, and blamed each neuron exactly as much as it deserved 😂",
          reactions: [
            { by: "bunty", emoji: "😂" },
            { by: "ishaan", emoji: "💯" },
          ],
        },
      ],
      result: {
        type: "notes",
        data: {
          topic: "How neural networks learn",
          key_points: [
            "A forward pass turns the inputs into a prediction",
            "The loss function measures how wrong the prediction is",
            "Backpropagation finds each weight's share of the error",
            "Gradient descent nudges every weight to reduce the loss",
          ],
          memory_trick: "Guess, check, blame, adjust.",
          quiz: [
            { question: "What does the loss function tell you?", answer: "How far the prediction is from the right answer." },
            { question: "What does backpropagation calculate?", answer: "How much each weight contributed to the error: its gradient." },
          ],
          weak_spots: ["The chain rule, intuitively"],
          next_topics: ["Learning rate", "Overfitting"],
        },
      },
    },
  },
];

export const LIVE_ROOMS = ROOMS.filter((r) => r.status === "live");

export function getRoom(id: string): RoomMeta {
  const room = ROOMS.find((r) => r.id === id);
  if (!room) throw new Error(`Unknown room: ${id}`);
  return room;
}
