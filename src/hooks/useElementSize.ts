import { useEffect, useReducer, useRef } from "react";

/**
 * Observes an element's border-box size with `ResizeObserver`, falling back to
 * window resize events where the observer is unavailable. Layout-dependent
 * consumers (the projection map, image carousel, histogram) use this to gate
 * rendering until a real measurement exists, which prevents division-by-zero
 * projections and misaligned overlays on first paint.
 */
export function useElementSize<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  { width: number; height: number },
] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useReducer(
    (
      previous: { width: number; height: number },
      next: { width: number; height: number },
    ): { width: number; height: number } =>
      previous.width === next.width && previous.height === next.height
        ? previous
        : next,
    { width: 0, height: 0 },
  );

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof window === "undefined") return;

    const measure = (): void => {
      const rect = element.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      window.addEventListener("orientationchange", measure);
      return () => {
        window.removeEventListener("resize", measure);
        window.removeEventListener("orientationchange", measure);
      };
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}

export default useElementSize;
