/**
 * How each persona sounds with browser voices: pitch and rate (multipliers around 1),
 * and a preferred voice gender when the device has a choice. Personas sound different
 * even on devices with only one or two voices. (AI voices use backend/tts.py VOICES.)
 */

export interface VoiceProfile {
  pitch: number;
  rate: number;
  gender: "female" | "male" | "any";
}

export const VOICE_PROFILES: Record<string, VoiceProfile> = {
  // The Group Chat
  rohit: { pitch: 0.95, rate: 1.12, gender: "male" },
  priya: { pitch: 1.15, rate: 1.0, gender: "female" },
  vikram: { pitch: 0.8, rate: 0.95, gender: "male" },
  ananya: { pitch: 1.3, rate: 1.15, gender: "female" },
  arjun: { pitch: 0.9, rate: 1.1, gender: "male" },
  meera: { pitch: 1.05, rate: 0.92, gender: "female" },
  // Pitch Tank
  kavya: { pitch: 1.05, rate: 1.05, gender: "female" },
  aditya: { pitch: 1.0, rate: 1.1, gender: "male" },
  rustom: { pitch: 0.75, rate: 0.9, gender: "male" },
  // Interview Panel
  pooja: { pitch: 1.15, rate: 1.0, gender: "female" },
  karthik: { pitch: 0.95, rate: 1.05, gender: "male" },
  devraj: { pitch: 0.8, rate: 0.92, gender: "male" },
  // Roast & Toast
  kabir: { pitch: 1.0, rate: 1.15, gender: "male" },
  nandini: { pitch: 1.1, rate: 1.0, gender: "female" },
  sameer: { pitch: 0.85, rate: 0.97, gender: "male" },
  // Future You
  you30: { pitch: 1.0, rate: 1.05, gender: "any" },
  you50: { pitch: 0.82, rate: 0.9, gender: "any" },
  // Study Group
  bunty: { pitch: 1.1, rate: 1.12, gender: "male" },
  ishaan: { pitch: 0.95, rate: 1.0, gender: "male" },
  tanvi: { pitch: 1.2, rate: 1.08, gender: "female" },
  // Debate Arena: clearly different voices
  pro: { pitch: 1.1, rate: 1.0, gender: "male" },
  con: { pitch: 0.85, rate: 0.97, gender: "female" },
  judge: { pitch: 0.75, rate: 0.9, gender: "any" },
  // Safety and other system lines: calm and gentle
  system: { pitch: 1.0, rate: 0.88, gender: "female" },
};

/** A stable number from a string (for personas without a profile, and for spreading voices). */
export function hashOf(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** A persona's profile; custom personas and guests get a stable, varied one from their id. */
export function voiceProfile(id: string): VoiceProfile {
  if (VOICE_PROFILES[id]) return VOICE_PROFILES[id];
  const h = hashOf(id);
  return { pitch: 0.8 + (h % 9) * 0.06, rate: 0.92 + ((h >> 4) % 5) * 0.05, gender: "any" };
}
