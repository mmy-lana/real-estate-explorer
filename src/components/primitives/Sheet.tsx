import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useFocusTrap, useScrollLock } from "../../hooks/useFocusTrap";
import { cn } from "../../lib/utils";
import { Button } from "./Button";

/** Snap points as a fraction of the viewport height. */
export const SHEET_SNAP_POINTS = [0.4, 0.9] as const;

export type SheetSnapIndex = 0 | 1;

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /** Optional sticky header content rendered under the title. */
  header?: React.ReactNode;
  children: React.ReactNode;
  /** Sticky action row pinned to the bottom of the sheet. */
  footer?: React.ReactNode;
  /** Which snap point the sheet opens at. Defaults to the tall one. */
  initialSnap?: SheetSnapIndex;
  /** Set to `false` to fix the sheet at its `initialSnap` height. */
  isDraggable?: boolean;
  labelledBy?: string;
  className?: string;
}

interface DragState {
  pointerId: number;
  startY: number;
  startHeight: number;
  lastY: number;
  lastTime: number;
  velocity: number;
}

/**
 * Mobile bottom sheet with two snap points (40% / 90%), pointer-drag on the
 * Y axis, velocity-aware release, backdrop blur, Escape dismissal, focus
 * trapping, and a mandatory `overflow-y-auto` body so long content scrolls.
 */
export function Sheet({
  isOpen,
  onClose,
  title,
  header,
  children,
  footer,
  initialSnap = 1,
  isDraggable = true,
  labelledBy,
  className,
}: SheetProps): React.JSX.Element | null {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [snapIndex, setSnapIndex] = useState<SheetSnapIndex>(initialSnap);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const titleId = labelledBy ?? "sheet-title";

  useFocusTrap(sheetRef, { active: isOpen, onEscape: onClose });
  useScrollLock(isOpen);

  useEffect(() => {
    if (isOpen) setSnapIndex(initialSnap);
  }, [isOpen, initialSnap]);

  const viewportHeight =
    typeof window === "undefined" ? 800 : window.innerHeight;
  const targetHeight = SHEET_SNAP_POINTS[snapIndex] * viewportHeight;

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggable) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;

      const body = sheetRef.current?.querySelector<HTMLElement>("[data-sheet-body]");
      // Let the body own the gesture when it is scrolled away from the top.
      if (body && body.scrollTop > 0) return;

      dragRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startHeight: targetHeight,
        lastY: event.clientY,
        lastTime: event.timeStamp,
        velocity: 0,
      };
      setIsDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [isDraggable, targetHeight],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      const elapsed = Math.max(1, event.timeStamp - drag.lastTime);
      drag.velocity = (event.clientY - drag.lastY) / elapsed;
      drag.lastY = event.clientY;
      drag.lastTime = event.timeStamp;
      setDragOffset(event.clientY - drag.startY);
    },
    [],
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      dragRef.current = null;
      setIsDragging(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      const projected = targetHeight - dragOffset;
      const midpoint =
        (SHEET_SNAP_POINTS[0] + SHEET_SNAP_POINTS[1]) / 2 * viewportHeight;
      const isFlickDown = drag.velocity > 0.6;
      const isFlickUp = drag.velocity < -0.6;

      setDragOffset(0);

      if (isFlickDown && snapIndex === 0) {
        onClose();
        return;
      }
      if (isFlickUp) {
        setSnapIndex(1);
        return;
      }
      if (isFlickDown) {
        setSnapIndex(0);
        return;
      }
      if (projected < midpoint * 0.55) {
        onClose();
        return;
      }
      setSnapIndex(projected >= midpoint ? 1 : 0);
    },
    [dragOffset, onClose, snapIndex, targetHeight, viewportHeight],
  );

  if (!isOpen || typeof document === "undefined") return null;

  const renderedHeight = Math.max(
    120,
    Math.min(viewportHeight * 0.92, targetHeight - dragOffset),
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 animate-fade-in bg-ink/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        style={{ height: `${renderedHeight}px` }}
        className={cn(
          "relative flex w-full flex-col overflow-hidden rounded-t-sheet bg-surface shadow-sheet",
          isDragging
            ? "transition-none"
            : "transition-[height] duration-300 ease-[var(--ease-sheet)] motion-reduce:transition-none",
          className,
        )}
      >
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className={cn(
            "shrink-0 touch-none px-4 pt-2 pb-1",
            isDraggable && "cursor-grab active:cursor-grabbing",
          )}
        >
          <div
            aria-hidden="true"
            className="mx-auto h-1.5 w-11 rounded-full bg-line-strong"
          />

          <div className="mt-2 flex items-center justify-between gap-3">
            {title ? (
              <h2 id={titleId} className="truncate text-base font-semibold text-ink">
                {title}
              </h2>
            ) : (
              <span />
            )}
            <Button
              variant="circle"
              size="sm"
              onClick={onClose}
              label="Close panel"
              className="border-transparent bg-transparent hover:bg-surface-alt"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {header ? (
          <div className="shrink-0 border-b border-line px-4 pb-3">{header}</div>
        ) : null}

        <div
          data-sheet-body=""
          className="thin-scrollbar flex-1 overflow-y-auto overscroll-contain px-4 py-3"
        >
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 border-t border-line bg-surface px-4 pt-3 pb-safe">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export default Sheet;
