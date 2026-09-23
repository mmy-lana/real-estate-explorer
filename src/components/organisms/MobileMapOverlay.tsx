import { useRef } from "react";
import { ArrowLeft, List } from "lucide-react";
import { useFocusTrap, useScrollLock } from "../../hooks/useFocusTrap";
import { cn, formatPlural } from "../../lib/utils";

export interface MobileMapOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  /** The map instance. Mounted only while the overlay is open. */
  children: React.ReactNode;
  resultCount: number;
  /** True when the viewport bounds are currently narrowing the results. */
  hasBoundsFilter: boolean;
  onClearBounds: () => void;
  className?: string;
}

/**
 * Full-screen mobile map wrapper.
 *
 * The map is mounted only while `isOpen` is true. That matters for the
 * projection engine: a freshly mounted container is re-measured by
 * `ResizeObserver`, so the pins are always projected against the real overlay
 * dimensions instead of a stale zero-sized box from a hidden render.
 */
export function MobileMapOverlay({
  isOpen,
  onClose,
  children,
  resultCount,
  hasBoundsFilter,
  onClearBounds,
  className,
}: MobileMapOverlayProps): React.JSX.Element | null {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(containerRef, { active: isOpen, onEscape: onClose });
  useScrollLock(isOpen);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Map view"
      className={cn(
        "fixed inset-0 z-40 flex flex-col bg-surface lg:hidden",
        "animate-fade-in",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 p-3">
        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink shadow-card"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          List
        </button>

        <p className="pointer-events-auto rounded-full border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink shadow-card">
          {resultCount} {formatPlural(resultCount, "stay")}
        </p>
      </div>

      {hasBoundsFilter ? (
        <div className="absolute inset-x-0 bottom-24 z-30 flex justify-center px-4">
          <button
            type="button"
            onClick={onClearBounds}
            className="rounded-full border border-line bg-surface px-4 py-2.5 text-xs font-semibold text-ink shadow-card"
          >
            Clear map area filter
          </button>
        </div>
      ) : null}

      <div className="relative flex-1">
        {children}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center pb-safe">
          <button
            type="button"
            onClick={onClose}
            className="pointer-events-auto mb-3 flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white shadow-panel"
          >
            <List className="h-4 w-4" aria-hidden="true" />
            Show list
          </button>
        </div>
      </div>
    </div>
  );
}

export default MobileMapOverlay;
