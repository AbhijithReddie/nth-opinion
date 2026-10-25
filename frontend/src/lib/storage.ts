/**
 * localStorage helpers that never throw. Storage can be missing or blocked
 * (private mode, disabled cookies, full quota); the app then simply doesn't
 * remember things between visits.
 */

export function loadJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable or full: keep working without it.
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore: nothing to clean up if storage is unavailable.
  }
}
