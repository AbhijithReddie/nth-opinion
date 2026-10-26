/**
 * Voice input with the browser's speech recognition (Web Speech API).
 * Framework-free, so the message box, the debate topic and the coming call mode
 * share it. Chrome sends the audio to Google's speech service; Firefox has no
 * speech recognition, so the mic is hidden there.
 */

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
};

function recognitionClass(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechInputSupported = () => recognitionClass() !== null;

/** Stop after this much silence once something was heard, or this long if nothing is heard at all. */
const SILENCE_MS = 2500;
const NOTHING_HEARD_MS = 8000;

export interface ListenOptions {
  lang: string;
  /** The transcript so far; `final` is true once, when listening ends. */
  onText: (transcript: string, final: boolean) => void;
  /** Microphone loudness, 0 to 1 (for the level indicator). */
  onLevel?: (level: number) => void;
  /** Listening ended; `error` is a friendly message when something went wrong. */
  onEnd: (error: string | null) => void;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser's site settings to use voice input.",
  "service-not-allowed": "Microphone access is blocked. Allow it in your browser's site settings to use voice input.",
  "no-speech": "Didn't catch anything. Tap the mic and try again.",
  "audio-capture": "No microphone was found. Check that one is connected.",
  network: "Voice input needs a connection to your browser's speech service. Check your internet and try again.",
  "language-not-supported": "This browser can't recognise that language. Try English (India).",
};

/** Start listening. Returns stop(), which ends listening and keeps what was heard. */
export function listen({ lang, onText, onLevel, onEnd }: ListenOptions): { stop: () => void } {
  const Recognition = recognitionClass();
  if (!Recognition) {
    onEnd("Voice input isn't supported in this browser.");
    return { stop: () => {} };
  }
  const rec = new Recognition();
  rec.lang = lang;
  rec.continuous = true; // we decide when to stop (silence), not the browser
  rec.interimResults = true;

  let finalText = "";
  let latest = "";
  let heard = false;
  let error: string | null = null;
  let silence: ReturnType<typeof setTimeout> | undefined;
  const waitForSilence = () => {
    clearTimeout(silence);
    silence = setTimeout(() => {
      if (!heard) error = ERRORS["no-speech"];
      rec.stop();
    }, heard ? SILENCE_MS : NOTHING_HEARD_MS);
  };
  const stopLevel = onLevel ? meter(onLevel) : () => {};

  rec.onspeechstart = () => waitForSilence();
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      if (result.isFinal) finalText += result[0].transcript;
      else interim += result[0].transcript;
    }
    latest = `${finalText}${interim}`.replace(/\s+/g, " ").trim();
    heard ||= latest.length > 0;
    onText(latest, false);
    waitForSilence();
  };
  rec.onerror = (e) => {
    if (e.error !== "aborted") error = ERRORS[e.error] ?? "Voice input stopped unexpectedly. Please try again.";
  };
  rec.onend = () => {
    clearTimeout(silence);
    stopLevel();
    onText(latest, true);
    onEnd(error);
  };
  try {
    rec.start();
    waitForSilence();
  } catch {
    stopLevel();
    onEnd("Voice input couldn't start. Please try again.");
  }
  return {
    stop: () => {
      clearTimeout(silence);
      rec.stop();
    },
  };
}

/**
 * A simple loudness meter from a second microphone stream. Skipped on Android,
 * where two microphone users at once can break recognition; fails quietly.
 */
function meter(onLevel: (level: number) => void): () => void {
  if (/android/i.test(navigator.userAgent) || !navigator.mediaDevices?.getUserMedia) return () => {};
  let stopped = false;
  let frame = 0;
  let cleanup = () => {};
  void navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const s of samples) sum += ((s - 128) / 128) ** 2;
        onLevel(Math.min(1, Math.sqrt(sum / samples.length) * 4));
        frame = requestAnimationFrame(tick);
      };
      tick();
      cleanup = () => {
        cancelAnimationFrame(frame);
        stream.getTracks().forEach((t) => t.stop());
        void context.close();
      };
    })
    .catch(() => {}); // recognition reports permission problems itself
  return () => {
    stopped = true;
    cleanup();
    onLevel(0);
  };
}
