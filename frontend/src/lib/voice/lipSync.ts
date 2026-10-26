/**
 * Lip sync: how open the speaker's mouth should be right now, and how round.
 *
 *  - AI voices: loudness from the AnalyserNode on the audio (RMS each frame),
 *    plus a simple frequency check: energy mostly in the low band reads as "O".
 *  - Browser voices (no access to the audio): the caption word timings. Each word
 *    gets an estimated duration; the mouth opens and closes once per estimated
 *    syllable, and closes between words and longer at punctuation.
 *
 * Both follow the same word the captions highlight, and return closed the
 * moment speech stops (the player clears what's speaking).
 */

import { voice, type LipSource } from "./player";

export interface MouthTarget {
  /** 0 closed to 1 wide open. */
  open: number;
  /** 0 wide to 1 round ("O"). */
  round: number;
}

export const CLOSED: MouthTarget = { open: 0, round: 0 };

/** Vowel groups in a word: a rough syllable count (works for English and Roman-script Indian languages). */
export function syllables(word: string): string[] {
  const groups = word.toLowerCase().match(/[aeiouy]+/g);
  return groups?.length ? groups : ["a"];
}

/** Seconds a browser voice takes for one word at `rate` (same pace as the caption estimates). */
export function wordSeconds(word: string, rate: number): number {
  return (word.length + 1) / (14.5 * rate);
}

/** The mouth for a word that started `elapsed` seconds ago. */
export function mouthForWord(word: string, elapsed: number, rate: number): MouthTarget {
  const talking = /[.!?…]["')\]]*$/.test(word) ? 0.65 : /[,;:]$/.test(word) ? 0.75 : 0.85; // rest of the time: closed
  const t = elapsed / wordSeconds(word, rate) / talking;
  if (t < 0 || t >= 1) return CLOSED;
  const parts = syllables(word);
  const phase = t * parts.length;
  const vowel = parts[Math.min(parts.length - 1, Math.floor(phase))];
  return {
    open: Math.sin(Math.PI * (phase % 1)) * (vowel.includes("a") ? 1 : 0.75),
    round: /^[ou]+$/.test(vowel) ? 1 : 0,
  };
}

let samples: Uint8Array<ArrayBuffer> | null = null;
let bins: Uint8Array<ArrayBuffer> | null = null;

function fromAudio(analyser: AnalyserNode): MouthTarget {
  if (samples?.length !== analyser.fftSize) samples = new Uint8Array(analyser.fftSize);
  if (bins?.length !== analyser.frequencyBinCount) bins = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteTimeDomainData(samples);
  let sum = 0;
  for (const s of samples) sum += ((s - 128) / 128) ** 2;
  const rms = Math.sqrt(sum / samples.length);
  const open = Math.min(1, Math.max(0, (rms - 0.015) * 7));
  // Rounded vowels (o, u) put their energy low; open ones (a, e) reach higher.
  analyser.getByteFrequencyData(bins);
  const hz = analyser.context.sampleRate / analyser.fftSize;
  let low = 0;
  let mid = 0;
  bins.forEach((v, i) => {
    const f = i * hz;
    if (f >= 200 && f < 700) low += v;
    else if (f >= 700 && f < 2500) mid += v;
  });
  return { open, round: open > 0.2 && low > mid * 1.6 ? 1 : 0 };
}

function fromSource(source: LipSource, now: number): MouthTarget {
  if (source.kind === "audio") return fromAudio(source.analyser);
  const word = source.speech.words[source.word];
  return word ? mouthForWord(word, (now - source.since) / 1000, source.rate) : CLOSED;
}

/** The target mouth for `speakerId` this frame: closed unless they're the one speaking. */
export function mouthTarget(speakerId: string, now = performance.now()): MouthTarget {
  if (voice.get().speaking?.speakerId !== speakerId) return CLOSED;
  const source = voice.lipSource();
  return source ? fromSource(source, now) : CLOSED;
}
