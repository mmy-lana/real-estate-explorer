/**
 * Safe browser-storage primitives.
 *
 * `localStorage` throws in private-browsing modes, when the origin is sandboxed,
 * and when a quota is exceeded. Every function here is total: it either returns
 * a validated value or a caller-supplied fallback, and it never throws. This is
 * the layer that `useLocalStorage` and the future `useFavorites` hook build on
 * for synchronous first-paint hydration.
 */

import { isRecord, STORAGE_KEYS, type StorageKey } from "../types";

/** Type guard signature accepted by `readStorageJson`. */
export type StorageValidator<T> = (value: unknown) => value is T;

let availabilityCache: boolean | null = null;

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const storage = window.localStorage;
    if (!storage) return null;
    return storage;
  } catch {
    return null;
  }
}

/** True when `localStorage` exists and accepts writes on this origin. */
export function isStorageAvailable(): boolean {
  if (availabilityCache !== null) return availabilityCache;

  const storage = getStorage();
  if (!storage) {
    availabilityCache = false;
    return false;
  }

  const probeKey = "__re_explorer_probe__";
  try {
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    availabilityCache = true;
  } catch {
    availabilityCache = false;
  }

  return availabilityCache;
}

/**
 * Reads and parses a JSON entry. Returns `fallback` when the key is absent,
 * holds malformed JSON, or fails the optional validator.
 */
export function readStorageJson<T>(
  key: StorageKey | string,
  fallback: T,
  validate?: StorageValidator<T>,
): T {
  const storage = getStorage();
  if (!storage) return fallback;

  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return fallback;
  }

  if (raw === null) return fallback;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }

  if (validate && !validate(parsed)) return fallback;
  return parsed as T;
}

/** Serialises and persists a value. Returns `false` when persistence failed. */
export function writeStorageJson(key: StorageKey | string, value: unknown): boolean {
  const storage = getStorage();
  if (!storage) return false;

  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`[storage] failed to persist "${key}":`, error);
    return false;
  }
}

/**
 * Removes a single key. Returns `false` when the key was absent or the removal
 * failed, so callers can report an accurate count of what was cleared.
 */
export function removeStorageValue(key: StorageKey | string): boolean {
  const storage = getStorage();
  if (!storage) return false;

  try {
    if (storage.getItem(key) === null) return false;
    storage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`[storage] failed to remove "${key}":`, error);
    return false;
  }
}

/** Removes every key owned by this application. Returns the removal count. */
export function clearAppStorage(): number {
  let removed = 0;
  for (const key of Object.values(STORAGE_KEYS)) {
    if (removeStorageValue(key)) removed += 1;
  }
  return removed;
}

/**
 * Parses a JSON array entry and keeps only the members accepted by `validate`.
 * Used by list-shaped stores (favourites, recent searches) so a single corrupt
 * member cannot discard the whole collection.
 */
export function readStorageList<T>(
  key: StorageKey | string,
  validate: StorageValidator<T>,
  limit?: number,
): T[] {
  const parsed = readStorageJson<unknown>(key, [], Array.isArray);
  if (!Array.isArray(parsed)) return [];

  const valid = parsed.filter(validate);
  if (typeof limit === "number" && limit >= 0 && valid.length > limit) {
    return valid.slice(0, limit);
  }
  return valid;
}

/** Narrows a stored `Record<string, unknown>` before field-by-field reading. */
export function readStorageRecord(
  key: StorageKey | string,
): Record<string, unknown> | null {
  const parsed = readStorageJson<unknown>(key, null, isRecord);
  return isRecord(parsed) ? parsed : null;
}
