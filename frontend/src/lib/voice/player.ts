/**
 * Voice output: a queue that reads messages aloud one at a time, plus the word
 * being spoken right now (for live captions). Framework-free, so rooms, the
 * debate and the coming call mode can all share it; React reads it through
 * hooks/useVoice.ts.
 *
 * Engines:
 *   - browser (default): speechSynthesis, a distinct voice per persona (prefers
 *     en-IN voices, varies pitch and rate per persona). Word timings come from
 *     "boundary" events where the browser sends them, else they're estimated.
 *   - ai: the backend's POST /api/tts (only when GET /api/tts/status says it's
 *     on). Word timings are estimated from the audio's progress. Any failure
 *     (quota, network) quietly falls back to the browser voice for that message.
 */

import { hashOf, voiceProfile, type VoiceProfile } from "@/config/voices";
import { API_URL } from "../sseClient";
import { loadJson, saveJson } from "../storage";
import { estimatedSeconds, speechText, wordAtChar, wordAtProgress, type SpeechText } from "./speechText";

export interface SpeakRequest {
  /** Unique per message, so its text can highlight while it's read. */
  key: string;
  /** Persona id (or "system" for safety lines); picks the voice. */
  speakerId: string;
  speakerName: string;
  text: string;
  /** The chat language id (for AI voices). */
  language?: string;
}

export interface SpeakingNow extends SpeakRequest {
  speech: SpeechText;
  /** The word being spoken (index into speech.words). */
  word: number;
  engine: "browser" | "ai";
}

export interface VoiceState {
  /** "Read replies aloud" is on. */
  enabled: boolean;
  captions: boolean;
  /** Speed multiplier, 0.75 to 1.5. */
  speed: number;
  speaking: SpeakingNow | null;
  queued: number;
  /** Speech output exists in this browser at all. */
  supported: boolean;
}

export const SPEEDS = [0.75, 1, 1.25, 1.5];
const PREFS_KEY = "nth-opinion.voice";

// --- state + subscriptions ------------------------------------------------------
type Prefs = Pick<VoiceState, "enabled" | "captions" | "speed">;
const saved = typeof window === "undefined" ? null : loadJson<Partial<Prefs>>(PREFS_KEY);
let state: VoiceState = {
  // Off by default: browsers only allow audio after a click, and turning this on is that click.
  enabled: saved?.enabled === true,
  captions: saved?.captions !== false,
  speed: SPEEDS.includes(saved?.speed as number) ? (saved!.speed as number) : 1,
  speaking: null,
  queued: 0,
  supported: typeof window !== "undefined" && "speechSynthesis" in window,
};
const listeners = new Set<() => void>();
const SERVER_STATE: VoiceState = { ...state, enabled: false, speaking: null, queued: 0, supported: false };

function set(patch: Partial<VoiceState>) {
  state = { ...state, ...patch };
  if ("enabled" in patch || "captions" in patch || "speed" in patch) {
    saveJson(PREFS_KEY, { enabled: state.enabled, captions: state.captions, speed: state.speed });
  }
  listeners.forEach((l) => l());
}

export const voice = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: () => state,
  getServer: () => SERVER_STATE,

  /** Turn "Read replies aloud" on or off (on is the user's click that unlocks audio). */
  setEnabled(on: boolean) {
    if (on) unlockAudio();
    else this.stop();
    set({ enabled: on });
  },
  setCaptions: (on: boolean) => set({ captions: on }),
  setSpeed: (speed: number) => set({ speed }),

  /** Add a message to the queue (when "Read replies aloud" is on). */
  enqueue(request: SpeakRequest) {
    if (!state.supported || !request.text.trim()) return;
    queue.push(request);
    set({ queued: queue.length });
    if (!state.speaking) void next();
  },

  /** Play one message now: stops whatever is being read (the per-message play button). */
  playNow(request: SpeakRequest) {
    unlockAudio();
    this.stop();
    queue.push(request);
    set({ queued: queue.length });
    void next();
  },

  /** Stop everything and empty the queue (also when the user talks or sends a message). */
  stop() {
    queue.length = 0;
    cancelCurrent();
    set({ speaking: null, queued: 0 });
  },

  /** Skip the message being read; the queue carries on. */
  skip() {
    cancelCurrent();
    set({ speaking: null });
    void next();
  },
};

// --- the queue ------------------------------------------------------------------------
const queue: SpeakRequest[] = [];
let run = 0; // bumped whenever playback is cancelled, so stale callbacks are ignored
let cancelCurrent: () => void = () => {};

async function next() {
  const request = queue.shift();
  set({ queued: queue.length });
  if (!request) {
    set({ speaking: null });
    return;
  }
  const mine = ++run;
  const speech = speechText(request.text);
  if (!speech.words.length) return void next();
  const progress = (word: number, engine: "browser" | "ai") => {
    if (run === mine) set({ speaking: { ...request, speech, word, engine } });
  };
  const done = () => {
    if (run !== mine) return;
    set({ speaking: null });
    void next();
  };
  if (await aiAvailable()) {
    const ok = await playAi(request, speech, mine, progress, done);
    if (ok || run !== mine) return;
  }
  playBrowser(request, speech, mine, progress, done);
}

// --- engine 1: the browser's voices --------------------------------------------------
let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;

/** The browser's voices; many browsers load them asynchronously (the "voiceschanged" event). */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  voicesReady ??= new Promise((resolve) => {
    const now = speechSynthesis.getVoices();
    if (now.length) return resolve(now);
    const finish = () => resolve(speechSynthesis.getVoices());
    speechSynthesis.addEventListener("voiceschanged", finish, { once: true });
    setTimeout(finish, 1500); // some browsers never fire it
  });
  return voicesReady;
}

const FEMALE = /female|woman|heera|veena|kalpana|swara|neerja|zira|samantha|aria|jenny|sonia|libby|susan|karen|moira|tessa|fiona/i;
const MALE = /\bmale\b|\bman\b|ravi|hemant|prabhat|madhur|david|mark|guy|ryan|daniel|alex|fred|rishi|thomas|george/i;

/**
 * A voice for a persona: Indian English first (it reads Roman-script mixes like
 * Hinglish best), then any English voice; the persona's gender where the name
 * says it; then spread personas over what's left so they don't all share one.
 */
export function pickVoice(voices: SpeechSynthesisVoice[], speakerId: string, profile: VoiceProfile): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => /^en/i.test(v.lang));
  const indian = english.filter((v) => /en[-_]IN/i.test(v.lang));
  const pool = indian.length ? indian : english.length ? english : voices;
  const gender = profile.gender === "any" ? pool : pool.filter((v) => (profile.gender === "female" ? FEMALE : MALE).test(v.name));
  const choices = gender.length ? gender : pool;
  return choices.length ? choices[hashOf(speakerId) % choices.length] : null;
}

function playBrowser(request: SpeakRequest, speech: SpeechText, mine: number, progress: (w: number, e: "browser") => void, done: () => void) {
  const profile = voiceProfile(request.speakerId);
  const utterance = new SpeechSynthesisUtterance(speech.spoken);
  utterance.pitch = profile.pitch;
  utterance.rate = profile.rate * state.speed;
  utterance.lang = "en-IN";
  let boundaries = false;
  const created = performance.now();
  let started = 0; // when speech really starts (an earlier message may still be finishing)
  const seconds = estimatedSeconds(speech, utterance.rate);
  const finish = () => {
    clearInterval(timer);
    done();
  };
  utterance.onboundary = (e) => {
    if (e.name && e.name !== "word") return;
    boundaries = true;
    progress(wordAtChar(speech, e.charIndex), "browser");
  };
  utterance.onstart = () => (started = performance.now());
  utterance.onend = finish;
  utterance.onerror = finish;
  cancelCurrent = () => {
    clearInterval(timer);
    run++;
    speechSynthesis.cancel();
  };
  progress(0, "browser");
  // Voices without boundary events (and a few browsers) get estimated timings; a stuck engine still moves on.
  const timer = setInterval(() => {
    if (started && !boundaries) progress(wordAtProgress(speech, (performance.now() - started) / 1000 / seconds), "browser");
    if ((performance.now() - created) / 1000 > seconds * 3 + 5) {
      speechSynthesis.cancel();
      finish();
    }
  }, 120);
  void loadVoices().then((voices) => {
    if (run !== mine) return;
    const chosen = pickVoice(voices, request.speakerId, profile);
    if (chosen) {
      utterance.voice = chosen;
      utterance.lang = chosen.lang;
    }
    speechSynthesis.speak(utterance);
  });
}

// --- engine 2: AI voices from the backend ----------------------------------------------
let aiStatus: Promise<boolean> | null = null;

function aiAvailable(): Promise<boolean> {
  aiStatus ??= fetch(`${API_URL}/api/tts/status`)
    .then((r) => (r.ok ? r.json() : null))
    .then((s) => s?.available === true)
    .catch(() => false);
  return aiStatus;
}

/** Resolves true once the audio has started (and ends via `done`), or false to fall back to the browser voice. */
async function playAi(request: SpeakRequest, speech: SpeechText, mine: number, progress: (w: number, e: "ai") => void, done: () => void): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: speech.spoken.slice(0, 1000), persona_id: request.speakerId, language: request.language ?? "english" }),
    });
    if (!response.ok || run !== mine) return false;
    const url = URL.createObjectURL(await response.blob());
    const audio = new Audio(url);
    audio.playbackRate = state.speed;
    const finish = () => {
      URL.revokeObjectURL(url);
      done();
    };
    audio.ontimeupdate = () => audio.duration && progress(wordAtProgress(speech, audio.currentTime / audio.duration), "ai");
    audio.onended = finish;
    audio.onerror = finish;
    cancelCurrent = () => {
      run++;
      audio.pause();
      URL.revokeObjectURL(url);
    };
    if (run !== mine) return true;
    progress(0, "ai");
    await audio.play();
    return true;
  } catch {
    return false; // quota, network or autoplay: the browser voice takes over for this message
  }
}

/** Speak a silent utterance inside the user's click, so later speech is allowed to play (iOS/Safari). */
function unlockAudio() {
  if (!state.supported) return;
  const silent = new SpeechSynthesisUtterance(" ");
  silent.volume = 0;
  speechSynthesis.speak(silent);
}
