import { useEffect, useState } from "react";

/**
 * Subscribes to a CSS media query and reports whether it currently matches.
 * SSR-safe: the first render uses `defaultMatches`, then the real match state is
 * read synchronously in the mount effect before paint.
 */
export function useMediaQuery(query: string, defaultMatches = false): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return defaultMatches;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const mediaQueryList = window.matchMedia(query);
    setMatches(mediaQueryList.matches);

    const handleChange = (event: MediaQueryListEvent): void => {
      setMatches(event.matches);
    };

    if (typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", handleChange);
      return () => mediaQueryList.removeEventListener("change", handleChange);
    }

    // Safari < 14 fallback.
    mediaQueryList.addListener(handleChange);
    return () => mediaQueryList.removeListener(handleChange);
  }, [query]);

  return matches;
}

/** True below the tablet breakpoint (single-column, bottom-navigation layout). */
export function useIsMobileLayout(): boolean {
  return useMediaQuery("(max-width: 767px)", false);
}

/** True once the desktop split view is active (grid + sticky map column). */
export function useIsSplitLayout(): boolean {
  return useMediaQuery("(min-width: 1024px)", false);
}

/** True below 640px, where the price histogram uses 12 wider buckets. */
export function useIsCompactViewport(): boolean {
  return useMediaQuery("(max-width: 639px)", false);
}

export default useMediaQuery;
