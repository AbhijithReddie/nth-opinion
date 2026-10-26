import { describe, expect, it } from "vitest";
import { agedLook, callLook, sceneFor, YOU_LOOK } from "../call/scenes";
import { CLOSED, mouthForWord, mouthTarget, syllables, wordSeconds } from "./lipSync";

describe("lip sync from word timings", () => {
  it("counts syllables as vowel groups", () => {
    expect(syllables("tension")).toEqual(["e", "io"]);
    expect(syllables("hmm")).toEqual(["a"]); // no vowels: still one mouth movement
  });

  it("opens and closes once per syllable, then closes between words", () => {
    const d = wordSeconds("banana", 1);
    const open = [0.1, 0.25, 0.4, 0.55, 0.7].map((f) => mouthForWord("banana", d * f, 1).open);
    expect(Math.max(...open)).toBeGreaterThan(0.5);
    expect(mouthForWord("banana", d * 0.95, 1)).toEqual(CLOSED); // the gap before the next word
    expect(mouthForWord("banana", -0.01, 1)).toEqual(CLOSED);
  });

  it("closes earlier at punctuation", () => {
    const d = wordSeconds("done.", 1);
    expect(mouthForWord("done.", d * 0.7, 1)).toEqual(CLOSED);
    expect(mouthForWord("done", d * 0.7, 1).open).toBeGreaterThan(0);
  });

  it("uses the round shape for o and u vowels", () => {
    const d = wordSeconds("go", 1);
    expect(mouthForWord("go", d * 0.4, 1).round).toBe(1);
    expect(mouthForWord("bat", d * 0.4, 1).round).toBe(0);
  });

  it("keeps every mouth shut when nobody is speaking", () => {
    expect(mouthTarget("rohit")).toEqual(CLOSED);
  });
});

describe("call scenes", () => {
  it("gives every room a scene and the debate its Stage mode", () => {
    expect(sceneFor("debate")).toMatchObject({ arrangement: "podiums", name: "Stage mode" });
    expect(sceneFor("interview-panel").decor).toBe("table");
    expect(sceneFor("unknown").arrangement).toBe("grid");
  });

  it("ages the user's avatar for Future You", () => {
    expect(agedLook(50)).toMatchObject({ hairColor: "grey", face: "round", extras: ["round-glasses"] });
    expect(agedLook(30).skin).toBe(YOU_LOOK.skin);
    expect(callLook("you50", { skin: 1 })).toEqual(agedLook(50));
    expect(callLook("rohit", { skin: 1 })).toEqual({ skin: 1 });
  });
});
