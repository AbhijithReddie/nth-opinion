import { describe, expect, it } from "vitest";
import { conversationData } from "./account";
import type { ChatItem, RoomSetup } from "./chatTypes";
import { mergePersonas, type CustomPersona } from "./customPersonas";

const setup = {
  title: "Goa trip",
  participants: [{ id: "rohit", name: "Rohit" }],
  language: "english",
  context: {},
  // Anything else (e.g. a document someone attached to the object) is never saved.
  documents: [{ kind: "resume", digest: "private" }],
} as unknown as RoomSetup;

const message = (i: number, text = "hi"): ChatItem =>
  ({ kind: "message", id: `m${i}`, sender: i % 2 ? "rohit" : "user", text, replyTo: null, mentions: [], reactions: [], ts: i }) as ChatItem;

describe("saved conversations", () => {
  it("keeps only the setup's people, language and details", () => {
    const data = conversationData("group-chat", setup, [message(0)], false);
    expect(Object.keys(data.setup).sort()).toEqual(["context", "language", "participants", "title"]);
    expect(JSON.stringify(data)).not.toContain("private");
  });

  it("keeps the latest 200 messages and stays under the size limit", () => {
    const many = Array.from({ length: 250 }, (_, i) => message(i, "x".repeat(2000)));
    const data = conversationData("group-chat", setup, many, false);
    expect(data.messages.length).toBeLessThanOrEqual(200);
    expect(new Blob([JSON.stringify(data.messages)]).size).toBeLessThan(200_000);
    expect(data.messages.at(-1)).toEqual(many.at(-1));
  });

  it("titles untitled rooms with the first message and flags safety", () => {
    const data = conversationData("future-you", { ...setup, title: "" }, [message(0, "Should I quit my job?")], true);
    expect(data.title).toBe("Should I quit my job?");
    expect(data.safety_flagged).toBe(true);
  });
});

describe("moving friends to an account", () => {
  const friend = (id: string, name: string, personality = "Kind"): CustomPersona =>
    ({ id, name, emoji: "🙂", colour: "#A0521D", personality, speaking_habits: "s", typical_stance: "t", avatar: {} }) as unknown as CustomPersona;

  it("merges without duplicates (same id, or same name and personality)", () => {
    const merged = mergePersonas([friend("custom_aaaa", "Papa")], [friend("custom_aaaa", "Papa"), friend("custom_bbbb", " papa "), friend("custom_cccc", "Coach")]);
    expect(merged.map((f) => f.id)).toEqual(["custom_aaaa", "custom_cccc"]);
  });

  it("never goes over the 12-friend limit", () => {
    const many = Array.from({ length: 20 }, (_, i) => friend(`custom_${i}xyz`, `F${i}`));
    expect(mergePersonas([], many)).toHaveLength(12);
  });
});
