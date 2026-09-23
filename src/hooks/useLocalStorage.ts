/**
 * React binding for the browser-storage persistence layer.
 *
 * Guarantees:
 * - Synchronous first-paint hydration (the initial state is read during the
 *   first `useState` call, never after a paint).
 * - Cross-tab and cross-document synchronisation via `BroadcastChannel` and the
 *   `storage` event, with echo suppression so the originating tab ignores its
 *   own broadcast.
 * - No writes inside state updaters (React may invoke an updater twice), and no
 *   render-phase mutation of refs.
 * - Total failure tolerance: quota errors and disabled storage degrade to
 *   in-memory state instead of throwing.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  readStorageJson,
  writeStorageJson,
  type StorageValidator,
} from "../lib/storage";

export type SetStoredValue<T> = (value: T | ((prev: T) => T)) => void;

export interface StorageSyncMessage<T> {
  key: string;
  payload: T;
  /** Identifies the writing tab so it can ignore its own broadcast. */
  senderId: string;
}

export interface UseLocalStorageOptions<T> {
  /** Rejects malformed persisted payloads, falling back to `initialValue`. */
  validate?: StorageValidator<T>;
  /** Set to `false` to keep the value tab-local. Defaults to `true`. */
  syncAcrossTabs?: boolean;
}

function createSenderId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through to the timestamp-based identifier */
  }
  return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: UseLocalStorageOptions<T> = {},
): [T, SetStoredValue<T>] {
  const { validate, syncAcrossTabs = true } = options;

  // Captured once: later `initialValue` identities must not reset stored state.
  const initialValueRef = useRef<T>(initialValue);
  const senderIdRef = useRef<string>(createSenderId());
  const channelRef = useRef<BroadcastChannel | null>(null);

  // The validator is read through a ref so a caller passing an inline function
  // (a new identity every render) cannot invalidate `readValue` and re-run the
  // hydration effect on each pass — which would loop: hydrate → new array
  // identity → re-render → hydrate again.
  const validateRef = useRef(validate);
  useEffect(() => {
    validateRef.current = validate;
  });

  const readValue = useCallback((): T => {
    return readStorageJson<T>(key, initialValueRef.current, validateRef.current);
  }, [key]);

  const [storedValue, setStoredValue] = useState<T>(readValue);
  const valueRef = useRef<T>(storedValue);

  useEffect(() => {
    valueRef.current = storedValue;
  }, [storedValue]);

  const setValue = useCallback<SetStoredValue<T>>(
    (value) => {
      const previous = valueRef.current;
      const next =
        typeof value === "function"
          ? (value as (prev: T) => T)(previous)
          : value;

      if (Object.is(next, previous)) return;

      valueRef.current = next;
      setStoredValue(next);
      writeStorageJson(key, next);

      if (syncAcrossTabs) {
        try {
          channelRef.current?.postMessage({
            key,
            payload: next,
            senderId: senderIdRef.current,
          } satisfies StorageSyncMessage<T>);
        } catch (error) {
          console.error(`[useLocalStorage] broadcast failed for "${key}":`, error);
        }
      }
    },
    [key, syncAcrossTabs],
  );

  useEffect(() => {
    const current = readValue();
    valueRef.current = current;
    setStoredValue(current);

    const supportsChannel =
      syncAcrossTabs &&
      typeof window !== "undefined" &&
      "BroadcastChannel" in window &&
      typeof window.BroadcastChannel === "function";

    let channel: BroadcastChannel | null = null;
    if (supportsChannel) {
      try {
        channel = new window.BroadcastChannel(`storage_sync_${key}`);
        channelRef.current = channel;
        channel.onmessage = (
          event: MessageEvent<StorageSyncMessage<T>>,
        ): void => {
          const message = event.data;
          if (!message || message.key !== key) return;
          if (message.senderId === senderIdRef.current) return;

          const validator = validateRef.current;
          if (validator && !validator(message.payload)) {
            console.warn(
              `[useLocalStorage] rejected invalid broadcast for "${key}"`,
            );
            return;
          }

          valueRef.current = message.payload;
          setStoredValue(message.payload);
        };
      } catch (error) {
        console.error(
          `[useLocalStorage] BroadcastChannel unavailable for "${key}":`,
          error,
        );
        channel = null;
        channelRef.current = null;
      }
    }

    const handleStorageEvent = (event: StorageEvent): void => {
      if (event.key !== key) return;

      if (event.newValue === null) {
        const fallback = initialValueRef.current;
        valueRef.current = fallback;
        setStoredValue(fallback);
        return;
      }

      const next = readValue();
      valueRef.current = next;
      setStoredValue(next);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorageEvent);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorageEvent);
      }
      if (channel) {
        channel.onmessage = null;
        channel.close();
      }
      channelRef.current = null;
    };
  }, [key, readValue, syncAcrossTabs]);

  return [storedValue, setValue];
}

export default useLocalStorage;
