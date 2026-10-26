/**
 * The languages every room supports. The backend registry (backend/languages.py)
 * is the source of truth and is served at GET /api/languages; this bundled copy
 * (languages.json) is the fallback when the API can't be reached, and a backend
 * test (tests/test_languages.py) checks the two match.
 */

import bundled from "./languages.json";

export interface LanguageInfo {
  id: string;
  label: string;
  /** A short, native-flavoured example line, shown in the picker. */
  example: string;
}

/** A language id, e.g. "english" or "tanglish". */
export type Language = string;

export const LANGUAGES: LanguageInfo[] = bundled;

export const isLanguage = (id: unknown): id is Language => typeof id === "string" && LANGUAGES.some((l) => l.id === id);
