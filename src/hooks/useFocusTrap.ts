import { useEffect, useRef } from "react";

/**
 * Overlay interaction support: focus trapping, body scroll locking, and Escape
 * routing. Both hooks are SSR-safe and no-op when `document` is unavailable.
 */

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** Returns the tabbable descendants of `container`, in document order. */
export function getFocusable(container: HTMLElement): HTMLElement[] {
  const candidates = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  );
  return candidates.filter((element) => {
    if (element.hasAttribute("disabled")) return false;
    if (element.getAttribute("aria-hidden") === "true") return false;
    return element.offsetParent !== null || element === document.activeElement;
  });
}

export interface UseFocusTrapOptions {
  /** Whether the trap is engaged. */
  active: boolean;
  /** Overrides which element receives focus on activation. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Invoked when Escape is pressed while the trap is engaged. */
  onEscape?: () => void;
  /** Returns focus to the previously active element on deactivation. */
  restoreFocus?: boolean;
}

/**
 * Traps Tab / Shift+Tab inside `containerRef` while `active`, moves focus inside
 * on activation, restores the previously focused element on deactivation, and
 * routes Escape to `onEscape`.
 */
export function useFocusTrap<T extends HTMLElement>(
  containerRef: React.RefObject<T | null>,
  options: UseFocusTrapOptions,
): void {
  const { active, initialFocusRef, onEscape, restoreFocus = true } = options;

  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const onEscapeRef = useRef(onEscape);
  const initialFocusRefLatest = useRef(initialFocusRef);

  useEffect(() => {
    onEscapeRef.current = onEscape;
    initialFocusRefLatest.current = initialFocusRef;
  });

  useEffect(() => {
    if (!active || typeof document === "undefined") return;

    const container = containerRef.current;
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const resolveInitialTarget = (): HTMLElement | null => {
      const explicit = initialFocusRefLatest.current?.current;
      if (explicit) return explicit;
      if (!container) return null;
      const focusable = getFocusable(container);
      return focusable.length > 0 ? focusable[0] : null;
    };

    // Deferred one frame so the overlay has settled into its final layout.
    const frameId = requestAnimationFrame(() => {
      resolveInitialTarget()?.focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onEscapeRef.current?.();
        return;
      }
      if (event.key !== "Tab" || !container) return;

      const focusable = getFocusable(container);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;

      if (event.shiftKey && (current === first || current === container)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      cancelAnimationFrame(frameId);
      document.removeEventListener("keydown", handleKeyDown, true);

      if (!restoreFocus) return;
      const previous = previouslyFocusedRef.current;
      if (previous && document.contains(previous)) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [active, containerRef, restoreFocus]);
}

let activeScrollLocks = 0;
let originalBodyOverflow = "";
let originalBodyPaddingRight = "";

/**
 * Reference-counted body scroll lock. Prevents premature unlocking when
 * multiple modal overlays or bottom sheets mount concurrently.
 */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;

    const { body } = document;
    if (activeScrollLocks === 0) {
      originalBodyOverflow = body.style.overflow;
      originalBodyPaddingRight = body.style.paddingRight;

      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;

      body.style.overflow = "hidden";
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`;
      }
    }

    activeScrollLocks += 1;

    return () => {
      activeScrollLocks = Math.max(0, activeScrollLocks - 1);
      if (activeScrollLocks === 0) {
        body.style.overflow = originalBodyOverflow;
        body.style.paddingRight = originalBodyPaddingRight;
      }
    };
  }, [active]);
}
