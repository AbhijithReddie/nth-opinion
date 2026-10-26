/**
 * Text to speak, and how its words line up with the message on screen.
 *
 * Messages are cleaned token by token (a token = one whitespace-separated piece
 * of the original text): emojis and markdown go, @mentions are read as names,
 * links as "link". Each spoken word remembers which token it came from, so live
 * captions can highlight the right word in the message as written.
 */

export interface SpeechText {
  /** The original text split into tokens, keeping the whitespace between them (for display). */
  tokens: string[];
  /** The words to speak, in order. */
  words: string[];
  /** For each spoken word, the index of the token it came from. */
  tokenOfWord: number[];
  /** words joined by single spaces: what is actually spoken. */
  spoken: string;
  /** Character offset in `spoken` where each word starts (for speechSynthesis boundary events). */
  wordStarts: number[];
}

const EMOJI = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}\u{20E3}]/gu;

/** One token as it should be spoken ("" if nothing to say). */
export function cleanToken(token: string): string {
  if (/^(https?:\/\/|www\.)/i.test(token)) return "link";
  return token
    .replace(EMOJI, "")
    .replace(/^@/, "") // @Rohit -> Rohit, @you -> you
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // [text](url) -> text
    .replace(/[*_~`#>|[\]()]/g, "") // markdown marks
    .trim();
}

export function speechText(text: string): SpeechText {
  const tokens = text.split(/(\s+)/);
  const words: string[] = [];
  const tokenOfWord: number[] = [];
  tokens.forEach((token, i) => {
    if (!token.trim()) return;
    for (const word of cleanToken(token).split(/\s+/).filter(Boolean)) {
      words.push(word);
      tokenOfWord.push(i);
    }
  });
  const wordStarts: number[] = [];
  let offset = 0;
  for (const word of words) {
    wordStarts.push(offset);
    offset += word.length + 1;
  }
  return { tokens, words, tokenOfWord, spoken: words.join(" "), wordStarts };
}

/** The word at a character offset of `spoken` (from a speechSynthesis "boundary" event). */
export function wordAtChar(st: SpeechText, charIndex: number): number {
  let index = 0;
  while (index + 1 < st.wordStarts.length && st.wordStarts[index + 1] <= charIndex) index++;
  return index;
}

/**
 * The word being spoken after `progress` (0-1) of the audio, when only the duration is known
 * (AI audio, or voices without boundary events): longer words take proportionally longer.
 */
export function wordAtProgress(st: SpeechText, progress: number): number {
  const weights = st.words.map((w) => w.length + 1); // +1 for the pause after each word
  const total = weights.reduce((a, b) => a + b, 0);
  let target = Math.max(0, Math.min(1, progress)) * total;
  for (let i = 0; i < weights.length; i++) {
    target -= weights[i];
    if (target < 0) return i;
  }
  return Math.max(0, weights.length - 1);
}

/** Roughly how long the browser takes to say `st` at `rate` (seconds), for estimated captions. */
export function estimatedSeconds(st: SpeechText, rate: number): number {
  return Math.max(0.6, st.spoken.length / (14.5 * rate));
}

/** The sentence around word `index` (for the captions bar): [first, last] word indexes. */
export function sentenceAround(st: SpeechText, index: number, maxWords = 16): [number, number] {
  const ends = (i: number) => /[.!?…]["')\]]*$/.test(st.words[i] ?? "");
  let first = index;
  while (first > 0 && !ends(first - 1) && index - first < maxWords - 1) first--;
  let last = index;
  while (last < st.words.length - 1 && !ends(last) && last - first < maxWords - 1) last++;
  return [first, last];
}
