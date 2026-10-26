"use client";

import { useSyncExternalStore } from "react";
import { isLanguage, LANGUAGES, type Language, type LanguageInfo } from "@/config/languages";
import { API_URL } from "@/lib/sseClient";
import { loadJson, saveJson } from "@/lib/storage";

/**
 * The language list: the bundled copy straight away, replaced by GET /api/languages
 * once it answers (fetched once per page load; any failure keeps the bundled copy).
 */
let current: LanguageInfo[] = LANGUAGES;
let requested = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!requested) {
    requested = true;
    fetch(`${API_URL}/api/languages`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list = data?.languages;
        const valid = Array.isArray(list) && list.length > 0 && list.every((l) => typeof l?.id === "string" && typeof l?.label === "string" && typeof l?.example === "string");
        if (valid) {
          current = list;
          listeners.forEach((l) => l());
        }
      })
      .catch(() => {}); // offline or the backend is asleep: the bundled copy is fine
  }
  return () => {
    listeners.delete(listener);
  };
}

export function useLanguages(): LanguageInfo[] {
  return useSyncExternalStore(subscribe, () => current, () => LANGUAGES);
}

// --- the last language picked, remembered across rooms (storage helpers never throw) ---
const KEY = "nth-opinion.language";
const preferenceListeners = new Set<() => void>();

export function loadPreferredLanguage(): Language {
  const saved = loadJson<string>(KEY);
  return isLanguage(saved) ? saved : "english";
}

export function savePreferredLanguage(language: Language) {
  saveJson(KEY, language);
  preferenceListeners.forEach((l) => l());
}

/** The remembered language: "english" while rendering on the server, the saved choice in the browser. */
export function usePreferredLanguage(): Language {
  return useSyncExternalStore(
    (listener) => {
      preferenceListeners.add(listener);
      return () => {
        preferenceListeners.delete(listener);
      };
    },
    loadPreferredLanguage,
    () => "english",
  );
}
