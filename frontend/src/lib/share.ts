/**
 * Shareable result cards: what a card is made from, privacy by default, and
 * turning the hidden full-size card into a PNG to share or download.
 */

import { domToBlob } from "modern-screenshot";
import { SITE_URL } from "@/config/site";
import type { RoomSetup, SummaryData } from "./chatTypes";
import type { Verdict } from "./types";

/** The site address printed on cards, without "https://". */
export const SITE_ADDRESS = SITE_URL.replace(/^https?:\/\//, "");

export type ShareSize = "square" | "story";
export const SHARE_SIZES: Record<ShareSize, { width: number; height: number; label: string }> = {
  square: { width: 1080, height: 1080, label: "Square" },
  story: { width: 1080, height: 1920, label: "Story" },
};

/** A room's result, as the card needs it. */
export type ShareResult =
  | { kind: "debate"; topic: string; verdict: Verdict }
  | {
      kind: "room";
      roomId: string;
      summary: SummaryData;
      setup: RoomSetup;
      /** Everything the user typed in the chat (used to keep it off the card). */
      userTexts: string[];
    };

/** Rooms whose cards hide the user's question and personal details unless they choose "Include my question". */
const PRIVATE_ROOMS = new Set(["group-chat", "future-you", "interview-panel", "roast-and-toast"]);
export const isPrivate = (result: ShareResult) => result.kind === "room" && PRIVATE_ROOMS.has(result.roomId);

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’&.-]*/gu;
/** A word without trailing punctuation or a possessive 's ("Ananya's" -> "Ananya"). */
const trim = (word: string) => word.replace(/['’]s$/, "").replace(/[.'’-]+$/, "");
const COMMON = new Set(
  "the this that what when where which who why how should would could will can and but for with you your my our hi hey hello yes not part please thanks also just about from have has had are was were its i'm i've i'd".split(
    " ",
  ),
);

/**
 * Privacy by default. Builds a function that blanks out every distinctive word
 * the user typed (their messages, resume, personal details): words that are
 * capitalised (names, places, companies, colleges) or contain a digit. Matching
 * is case-sensitive, so ordinary words that only started a sentence stay.
 */
export function redactor(privateTexts: string[]): (text: string) => string {
  const secret = new Set<string>();
  for (const text of privateTexts) {
    for (const raw of text.match(WORD) ?? []) {
      const word = trim(raw);
      if (word.length >= 3 && (/^\p{Lu}/u.test(word) || /\d/.test(word)) && !COMMON.has(word.toLowerCase())) secret.add(word);
    }
  }
  return (text) =>
    text.replace(WORD, (raw) => {
      const word = trim(raw);
      return secret.has(word) ? "•••" + raw.slice(word.length) : raw; // keeps "'s" and punctuation
    });
}

/** The user's private texts for a room: their messages, the room title and every setup detail. */
export function privateTexts(result: ShareResult): string[] {
  if (result.kind !== "room") return [];
  return [...result.userTexts, result.setup.title, ...Object.values(result.setup.context)];
}

/** Shorten to `max` characters on a word boundary. */
export function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.lastIndexOf(" ", max - 1);
  return clean.slice(0, cut > max * 0.6 ? cut : max - 1) + "…";
}

/** The key sentence of a letter: the first substantial one (8+ words), skipping greetings like "Dear me,". */
export function keySentence(text: string, max = 170): string {
  const sentences = text.replace(/^\s*(dear|hey|hi|hello)[^,.!\n]*[,!.\n]\s*/i, "").split(/(?<=[.!?])\s+/);
  const words = (s: string) => s.split(/\s+/).length;
  return clip(sentences.find((s) => words(s) >= 8) ?? sentences.find((s) => words(s) > 3) ?? text, max);
}

/**
 * Turn the hidden, full-size card into a PNG. modern-screenshot copies the
 * computed styles (so the Tailwind classes and SVG illustrations come out as on
 * screen) and embeds the page's web fonts; waiting for document.fonts first
 * makes sure they're loaded.
 */
export async function renderCard(node: HTMLElement, size: ShareSize): Promise<Blob> {
  await document.fonts.ready;
  const { width, height } = SHARE_SIZES[size];
  return domToBlob(node, { width, height, scale: 1, type: "image/png" });
}

/** True where the Web Share API can share image files (mostly phones). */
export function canShareImages(): boolean {
  try {
    return !!navigator.canShare?.({ files: [new File([""], "card.png", { type: "image/png" })] });
  } catch {
    return false;
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
