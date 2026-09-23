import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { cn } from "../../lib/utils";

export interface ImageCarouselProps {
  images: readonly string[];
  /** Accessible description base, usually the listing title. */
  alt: string;
  /** 1-based position of the gallery, e.g. `3` renders "3 / 5". */
  showCounterOnActiveImage?: boolean;
  /** Overlay rendered top-left (badges). */
  topLeftOverlay?: React.ReactNode;
  /** Overlay rendered top-right (favourite button). */
  topRightOverlay?: React.ReactNode;
  /** Fired when the media area is activated (opens the detail sheet). */
  onOpen?: () => void;
  /** Loads the first image eagerly instead of lazily (above-the-fold cards). */
  priority?: boolean;
  isActive?: boolean;
  className?: string;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  deltaX: number;
  isHorizontal: boolean | null;
}

const SWIPE_THRESHOLD_PX = 48;

/**
 * Multi-image gallery with a persistent `aspect-[4/3]` frame.
 *
 * - Touch and pointer dragging snaps between slides, and a gesture is only
 *   claimed once it is clearly horizontal so vertical page scroll still works.
 * - Desktop arrow buttons appear from the `sm` breakpoint upwards.
 * - The next slide is preloaded so a swipe never flashes an empty frame.
 * - Individual image failures degrade to an inline placeholder for that slide
 *   only, keeping the rest of the gallery usable.
 */
export function ImageCarousel({
  images,
  alt,
  showCounterOnActiveImage = false,
  topLeftOverlay,
  topRightOverlay,
  onOpen,
  priority = false,
  isActive = false,
  className,
}: ImageCarouselProps): React.JSX.Element {
  const [index, setIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [failedImages, setFailedImages] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const dragRef = useRef<DragState | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);

  const slideCount = images.length;
  const safeIndex = Math.min(index, Math.max(0, slideCount - 1));

  useEffect(() => {
    // A card reused for a different listing must not keep a stale slide index.
    setIndex(0);
    setDragOffset(0);
    setFailedImages(new Set<string>());
  }, [images[0]]);

  const goTo = useCallback(
    (next: number): void => {
      if (slideCount === 0) return;
      const wrapped = ((next % slideCount) + slideCount) % slideCount;
      setIndex(wrapped);
    },
    [slideCount],
  );

  // Warm the next slide so a swipe resolves instantly.
  useEffect(() => {
    if (typeof window === "undefined" || slideCount <= 1) return;
    const nextSrc = images[(safeIndex + 1) % slideCount];
    if (!nextSrc) return;
    const preloader = new window.Image();
    preloader.src = nextSrc;
  }, [images, safeIndex, slideCount]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (slideCount <= 1) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;

      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        deltaX: 0,
        isHorizontal: null,
      };
    },
    [slideCount],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;

      if (drag.isHorizontal === null) {
        if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) return;
        drag.isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
        if (drag.isHorizontal) {
          setIsDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        } else {
          dragRef.current = null;
          return;
        }
      }

      if (!drag.isHorizontal) return;
      // Rubber-band at the extremes instead of dragging into empty space.
      const isPastStart = safeIndex === 0 && deltaX > 0;
      const isPastEnd = safeIndex === slideCount - 1 && deltaX < 0;
      drag.deltaX = isPastStart || isPastEnd ? deltaX * 0.35 : deltaX;
      setDragOffset(drag.deltaX);
    },
    [safeIndex, slideCount],
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setIsDragging(false);

      if (drag.isHorizontal && Math.abs(drag.deltaX) >= SWIPE_THRESHOLD_PX) {
        goTo(drag.deltaX < 0 ? safeIndex + 1 : safeIndex - 1);
      }
      setDragOffset(0);
    },
    [goTo, safeIndex],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (slideCount <= 1) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goTo(safeIndex - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goTo(safeIndex + 1);
      }
    },
    [goTo, safeIndex, slideCount],
  );

  const translatePercent = useMemo(() => {
    const base = -safeIndex * 100;
    const frameWidth = frameRef.current?.clientWidth ?? 0;
    const dragPercent = frameWidth > 0 ? (dragOffset / frameWidth) * 100 : 0;
    return base + dragPercent;
  }, [dragOffset, safeIndex]);

  if (slideCount === 0) {
    return (
      <div
        className={cn(
          "flex aspect-[4/3] w-full items-center justify-center rounded-2xl bg-surface-alt text-ink-muted",
          className,
        )}
      >
        <ImageOff className="h-6 w-6" aria-hidden="true" />
        <span className="sr-only">No photos available for this stay</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-surface-sunken",
        isActive && "ring-2 ring-ink ring-offset-2",
        className,
      )}
    >
      <div
        ref={frameRef}
        role={onOpen ? "button" : undefined}
        tabIndex={onOpen ? 0 : -1}
        aria-label={onOpen ? `View photos of ${alt}` : undefined}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (onOpen && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            onOpen();
          }
          handleKeyDown(event);
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={cn(
          "flex h-full w-full touch-pan-y",
          slideCount > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        )}
      >
        <div
          className={cn(
            "flex h-full w-full will-change-transform",
            isDragging
              ? "transition-none"
              : "transition-transform duration-300 ease-[var(--ease-emphasized)] motion-reduce:transition-none",
          )}
          style={{ transform: `translate3d(${translatePercent}%, 0, 0)` }}
        >
          {images.map((src, slideIndex) => {
            const isFailed = failedImages.has(src);

            return (
              <div
                key={`${src}-${slideIndex}`}
                className="relative h-full w-full shrink-0"
                aria-hidden={slideIndex !== safeIndex}
              >
                {isFailed ? (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-surface-alt text-ink-muted">
                    <ImageOff className="h-6 w-6" aria-hidden="true" />
                    <p className="px-6 text-center text-xs">
                      This photo could not be loaded
                    </p>
                  </div>
                ) : (
                  <img
                    src={src}
                    alt={`${alt} — photo ${slideIndex + 1} of ${slideCount}`}
                    loading={priority && slideIndex === 0 ? "eager" : "lazy"}
                    decoding="async"
                    draggable={false}
                    onError={() =>
                      setFailedImages((previous) => {
                        const next = new Set(previous);
                        next.add(src);
                        return next;
                      })
                    }
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {topLeftOverlay ? (
        <div className="pointer-events-none absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2">
          {topLeftOverlay}
        </div>
      ) : null}

      {topRightOverlay ? (
        <div className="absolute top-3 right-3 z-10">{topRightOverlay}</div>
      ) : null}

      {slideCount > 1 ? (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              goTo(safeIndex - 1);
            }}
            aria-label="Previous photo"
            className={cn(
              "absolute top-1/2 left-2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full",
              "border border-line bg-surface/95 text-ink shadow-card transition-opacity duration-150 sm:flex",
              "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
            )}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              goTo(safeIndex + 1);
            }}
            aria-label="Next photo"
            className={cn(
              "absolute top-1/2 right-2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full",
              "border border-line bg-surface/95 text-ink shadow-card transition-opacity duration-150 sm:flex",
              "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
            )}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>

          <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
            {images.map((src, dotIndex) => (
              <span
                key={`dot-${src}-${dotIndex}`}
                aria-hidden="true"
                className={cn(
                  "h-1.5 rounded-full transition-[width,background-color] duration-200",
                  dotIndex === safeIndex
                    ? "w-4 bg-white"
                    : "w-1.5 bg-white/70",
                )}
              />
            ))}
          </div>

          <p className="sr-only" aria-live="polite">
            Photo {safeIndex + 1} of {slideCount}
          </p>

          {showCounterOnActiveImage ? (
            <p className="pointer-events-none absolute right-3 bottom-3 z-10 rounded-full bg-ink/70 px-2 py-0.5 text-[11px] font-medium text-white tabular-nums">
              {safeIndex + 1} / {slideCount}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default ImageCarousel;
