import { describe, expect, it } from "vitest";
import { recognitionLanguageFor } from "./recognitionLanguages";
import { cleanToken, sentenceAround, speechText, wordAtChar, wordAtProgress } from "./speechText";

describe("speechText", () => {
  it("drops emojis and markdown and reads @mentions as names", () => {
    const st = speechText("**Bro** 😂 ask @Priya, she knows 👍🏽 [here](https://x.y)");
    expect(st.spoken).toBe("Bro ask Priya, she knows here");
  });

  it("reads links as 'link'", () => {
    expect(cleanToken("https://example.com/page")).toBe("link");
  });

  it("maps each spoken word back to its token in the original text", () => {
    const st = speechText("Hey 🔥 @Rohit, listen");
    expect(st.words).toEqual(["Hey", "Rohit,", "listen"]);
    expect(st.tokens[st.tokenOfWord[1]]).toBe("@Rohit,");
  });

  it("finds the word at a boundary event's character offset", () => {
    const st = speechText("one two three");
    expect([0, 3, 4, 8, 12].map((c) => wordAtChar(st, c))).toEqual([0, 0, 1, 2, 2]);
  });

  it("estimates the word from audio progress, longer words taking longer", () => {
    const st = speechText("a extraordinary b");
    expect(wordAtProgress(st, 0)).toBe(0);
    expect(wordAtProgress(st, 0.5)).toBe(1);
    expect(wordAtProgress(st, 1)).toBe(2);
  });

  it("shows the sentence around the current word in captions", () => {
    const st = speechText("First one. Second sentence here. Third.");
    expect(sentenceAround(st, 3)).toEqual([2, 4]);
  });
});

describe("recognition language", () => {
  it("follows the chat language", () => {
    expect(recognitionLanguageFor("hinglish")).toBe("en-IN");
    expect(recognitionLanguageFor("tenglish")).toBe("te-IN");
    expect(recognitionLanguageFor("benglish")).toBe("bn-IN");
    expect(recognitionLanguageFor("unknown")).toBe("en-IN");
  });
});
