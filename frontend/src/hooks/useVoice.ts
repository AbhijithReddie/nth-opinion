"use client";

import { useState, useSyncExternalStore } from "react";
import { voice, type VoiceState } from "@/lib/voice/player";
import { recognitionLanguageFor, type RecognitionLanguage } from "@/lib/voice/recognitionLanguages";
import { speechInputSupported } from "@/lib/voice/speechInput";
import { loadJson, saveJson } from "@/lib/storage";

/** Voice output state (read aloud, captions, speed, what's being said now). */
export function useVoice(): VoiceState {
  return useSyncExternalStore(voice.subscribe, voice.get, voice.getServer);
}

/** True where the browser can recognise speech (false during server rendering). */
export function useSpeechInputSupported(): boolean {
  return useSyncExternalStore(
    () => () => {},
    speechInputSupported,
    () => false,
  );
}

// --- voice input settings: hands-free (remembered) and the recognition language -----------
const KEY = "nth-opinion.voice-input";
const listeners = new Set<() => void>();
let handsFree: boolean | null = null;

function readHandsFree(): boolean {
  handsFree ??= loadJson<{ handsFree?: boolean }>(KEY)?.handsFree === true;
  return handsFree;
}

export function setHandsFree(on: boolean) {
  handsFree = on;
  saveJson(KEY, { handsFree: on });
  listeners.forEach((l) => l());
}

/** Hands-free: a finished voice message is sent straight away (off by default: the user can edit first). */
export function useHandsFree(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    readHandsFree,
    () => false,
  );
}

/** The recognition language: follows the chat language until the user picks one. */
export function useRecognitionLanguage(chatLanguage: string): [RecognitionLanguage, (lang: RecognitionLanguage) => void] {
  const [picked, setPicked] = useState<RecognitionLanguage | null>(null);
  return [picked ?? recognitionLanguageFor(chatLanguage), setPicked];
}

// --- the one-time privacy note --------------------------------------------------------
const NOTE_KEY = "nth-opinion.voice-note-seen";
export const voiceNoteSeen = () => loadJson<boolean>(NOTE_KEY) === true;
export const markVoiceNoteSeen = () => saveJson(NOTE_KEY, true);
