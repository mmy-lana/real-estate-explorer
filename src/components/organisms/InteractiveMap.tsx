import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Crosshair,
  Maximize2,
  Minus,
  Move,
  Plus,
  RotateCcw,
} from "lucide-react";
import type { GeoBounds, PropertyListing } from "../../types";
import { APP_CONFIG } from "../../lib/config";
import {
  CoordinateProjectionEngine,
  fitBoundsToCoordinates,
} from "../../lib/coordinate-projection";
import { useElementSize } from "../../hooks/useElementSize";
import { clamp, cn, formatCurrencyWhole } from "../../lib/utils";
import { MapPin } from "../molecules/MapPin";
import { MapSkeleton } from "../primitives/Skeleton";

export interface InteractiveMapProps {
  listings: readonly PropertyListing[];
  /** Ids highlighted by card hover/focus. */
  hoveredListingId: string | null;
  selectedListingId: string | null;
  onSelectListing: (listingId: string) => void;
  onHoverListing: (listingId: string | null) => void;
  /** Viewport bounds reported after pan/zoom settles. */
  onBoundsChange?: (bounds: GeoBounds) => void;
  onInteractionChange?: (isInteracting: boolean) => void;
  /** Initial viewport; defaults to a fit over the supplied listings. */
  initialBounds?: GeoBounds;
  className?: string;
}

interface Cluster {
  id: string;
  x: number;
  y: number;
  listings: PropertyListing[];
}

/**
 * Canvas-free projection map.
 *
 * Layout gate: markers are not rendered until `projectionEngine.isReady()` is
 * true (a real container measurement exists), so no pin is ever placed from a
 * zero-sized box. A `MapSkeleton` occupies the frame until then.
 *
 * Interactions: pointer drag to pan, wheel/pinch to zoom, keyboard panning with
 * the arrow keys, plus zoom/reset controls. Every viewport change is emitted
 * through `onBoundsChange` after the gesture settles, which is how the shell
 * folds the viewport into the active bounds filter.
 */
export function InteractiveMap({
  listings,
  hoveredListingId,
  selectedListingId,
  onSelectListing,
  onHoverListing,
  onBoundsChange,
  onInteractionChange,
  initialBounds,
  className,
}: InteractiveMapProps): React.JSX.Element {
  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const [bounds, setBounds] = useState<GeoBounds>(
    () =>
      initialBounds ??
      fitBoundsToCoordinates(
        listings.map((listing) => listing.coordinates),
        0.08,
        APP_CONFIG.map.initialBounds,
      ),
  );
  const [isPanning, setIsPanning] = useState(false);
  const panRef = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(
    null,
  );
  const touchDistanceRef = useRef<number | null>(null);

  const engine = useMemo(
    () =>
      new CoordinateProjectionEngine(bounds, size.width, size.height),
    [bounds, size.height, size.width],
  );

  const isReady = engine.isReady();

  // Zoom controls and gestures rewrite the viewport through these helpers so the
  // emitted bounds always match what the user sees.
  const applyViewport = useCallback(
    (next: GeoBounds): void => {
      setBounds(next);
      onBoundsChange?.(next);
    },
    [onBoundsChange],
  );

  const zoomAtCenter = useCallback(
    (factor: number): void => {
      const centerX = size.width / 2;
      const centerY = size.height / 2;
      applyViewport(engine.zoomTo(factor, centerX, centerY));
    },
    [applyViewport, engine, size.height, size.width],
  );

  const resetViewport = useCallback((): void => {
    const fitted =
      initialBounds ??
      fitBoundsToCoordinates(
        listings.map((listing) => listing.coordinates),
        0.08,
        APP_CONFIG.map.initialBounds,
      );
    applyViewport(fitted);
  }, [applyViewport, initialBounds, listings]);

  // Keep the viewport in sync when the shell supplies a new initial bounds value
  // (for example after a fresh search from the mobile map overlay).
  useEffect(() => {
    if (!initialBounds) return;
    setBounds(initialBounds);
  }, [initialBounds]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      panRef.current = {
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastY: event.clientY,
      };
      setIsPanning(true);
      onInteractionChange?.(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [onInteractionChange],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const pan = panRef.current;
      if (!pan || pan.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - pan.lastX;
      const deltaY = event.clientY - pan.lastY;
      pan.lastX = event.clientX;
      pan.lastY = event.clientY;

      setBounds((previous) => {
        const nextEngine = new CoordinateProjectionEngine(
          previous,
          size.width,
          size.height,
        );
        return nextEngine.panBy(-deltaX, deltaY);
      });
    },
    [size.height, size.width],
  );

  const endPan = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const pan = panRef.current;
      if (!pan || pan.pointerId !== event.pointerId) return;

      panRef.current = null;
      setIsPanning(false);
      onInteractionChange?.(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      onBoundsChange?.(engine.getBounds());
    },
    [engine, onBoundsChange, onInteractionChange],
  );

  // Wheel zoom must call `preventDefault()`, but React registers its synthetic
  // wheel handler as a passive root listener, which makes that call a no-op and
  // logs a console warning. A native non-passive listener is registered instead.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isReady) return;

    const handleWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const rect = container.getBoundingClientRect();
      const anchorX = event.clientX - rect.left;
      const anchorY = event.clientY - rect.top;
      const factor = event.deltaY < 0 ? 1.18 : 1 / 1.18;
      applyViewport(engine.zoomTo(factor, anchorX, anchorY));
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [applyViewport, containerRef, engine, isReady]);

  // Pinch zoom for touch devices (two-pointer distance ratio).
  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      const [first, second] = [event.touches[0], event.touches[1]];
      touchDistanceRef.current = Math.hypot(
        second.clientX - first.clientX,
        second.clientY - first.clientY,
      );
    }
  }, []);

  const handleTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (event.touches.length !== 2 || touchDistanceRef.current === null) return;
      const [first, second] = [event.touches[0], event.touches[1]];
      const distance = Math.hypot(
        second.clientX - first.clientX,
        second.clientY - first.clientY,
      );
      const ratio = distance / touchDistanceRef.current;
      if (Math.abs(ratio - 1) < 0.02) return;

      touchDistanceRef.current = distance;
      const rect = event.currentTarget.getBoundingClientRect();
      const anchorX = (first.clientX + second.clientX) / 2 - rect.left;
      const anchorY = (first.clientY + second.clientY) / 2 - rect.top;
      applyViewport(engine.zoomTo(ratio, anchorX, anchorY));
    },
    [applyViewport, engine],
  );

  const handleTouchEnd = useCallback(() => {
    touchDistanceRef.current = null;
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const step = 40;
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          applyViewport(engine.panBy(0, step));
          break;
        case "ArrowDown":
          event.preventDefault();
          applyViewport(engine.panBy(0, -step));
          break;
        case "ArrowLeft":
          event.preventDefault();
          applyViewport(engine.panBy(-step, 0));
          break;
        case "ArrowRight":
          event.preventDefault();
          applyViewport(engine.panBy(step, 0));
          break;
        case "+":
        case "=":
          event.preventDefault();
          zoomAtCenter(1.2);
          break;
        case "-":
          event.preventDefault();
          zoomAtCenter(1 / 1.2);
          break;
        default:
          break;
      }
    },
    [applyViewport, engine, zoomAtCenter],
  );

  // Cluster pins that would otherwise overlap at the current zoom level.
  const clusters = useMemo<Cluster[]>(() => {
    if (!isReady) return [];

    const radius = APP_CONFIG.map.clusterRadiusPx;
    const result: Cluster[] = [];
    const claimed = new Set<string>();

    for (const listing of listings) {
      if (claimed.has(listing.id)) continue;

      const projected = engine.project(listing.coordinates);
      if (!projected.isVisible) continue;

      const members = [listing];
      claimed.add(listing.id);

      if (APP_CONFIG.features.mapClustering) {
        for (const candidate of listings) {
          if (claimed.has(candidate.id)) continue;
          const candidatePoint = engine.project(candidate.coordinates);
          if (!candidatePoint.isVisible) continue;

          const distance = Math.hypot(
            candidatePoint.x - projected.x,
            candidatePoint.y - projected.y,
          );
          if (distance <= radius) {
            members.push(candidate);
            claimed.add(candidate.id);
          }
        }
      }

      result.push({
        id: members.map((member) => member.id).join("+"),
        x: projected.x,
        y: projected.y,
        listings: members,
      });
    }

    return result;
  }, [engine, isReady, listings]);

  const zoomPercent = useMemo(() => {
    const span = Math.max(0.005, bounds.north - bounds.south);
    const ratio = clamp(
      (APP_CONFIG.map.maxZoom - APP_CONFIG.map.minZoom + 1) /
        (span + APP_CONFIG.map.maxZoom - APP_CONFIG.map.minZoom + 1),
      0,
      1,
    );
    return Math.round((1 - ratio) * 100);
  }, [bounds.north, bounds.south]);

  const visibleCount = clusters.reduce(
    (total, cluster) => total + cluster.listings.length,
    0,
  );

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden bg-surface-alt",
        isPanning ? "cursor-grabbing" : "cursor-grab",
        className,
      )}
    >
      {isReady ? (
        <div
          ref={containerRef}
          role="application"
          aria-label="Interactive map of available stays"
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onKeyDown={handleKeyDown}
          className="absolute inset-0 touch-none focus-visible:outline-2 focus-visible:outline-offset-4px] focus-visible:outline-ink"
        >
          {/* Stylised terrain: subtle grid + landmass wash, drawn with CSS only. */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 25% 30%, rgba(255,56,92,0.06), transparent 55%), radial-gradient(circle at 75% 70%, rgba(10,91,211,0.05), transparent 55%), linear-gradient(rgba(0,0,0,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.045) 1px, transparent 1px)",
              backgroundSize: "auto, auto, 64px 64px, 64px 64px",
            }}
          />

          {clusters.map((cluster) => {
            if (cluster.listings.length > 1) {
              const averagePrice = Math.round(
                cluster.listings.reduce(
                  (total, listing) => total + listing.pricePerNight,
                  0,
                ) / cluster.listings.length,
              );
              const isActive = cluster.listings.some(
                (listing) =>
                  listing.id === selectedListingId ||
                  listing.id === hoveredListingId,
              );

              return (
                <button
                  key={cluster.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    // Zooming in splits the cluster on the next render pass.
                    applyViewport(
                      engine.zoomTo(1.9, cluster.x, cluster.y),
                    );
                  }}
                  aria-label={`${cluster.listings.length} stays near here, average ${formatCurrencyWhole(averagePrice)} per night. Zoom in to see them.`}
                  style={{ left: `${cluster.x}px`, top: `${cluster.y}px` }}
                  className={cn(
                    "absolute z-20 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-xs font-semibold shadow-pin transition-transform duration-150 hover:scale-110",
                    isActive
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-surface text-ink",
                  )}
                >
                  {cluster.listings.length}
                </button>
              );
            }

            const listing = cluster.listings[0];
            return (
              <MapPin
                key={listing.id}
                listing={listing}
                x={cluster.x}
                y={cluster.y}
                isActive={listing.id === selectedListingId}
                isHovered={listing.id === hoveredListingId}
                onSelect={onSelectListing}
                onHoverChange={onHoverListing}
              />
            );
          })}
        </div>
      ) : (
        <div ref={containerRef} className="absolute inset-0">
          <MapSkeleton />
        </div>
      )}

      {/* Viewport controls */}
      <div className="absolute top-3 right-3 z-30 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => zoomAtCenter(1.3)}
          aria-label="Zoom in"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-ink shadow-card hover:border-ink"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => zoomAtCenter(1 / 1.3)}
          aria-label="Zoom out"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-ink shadow-card hover:border-ink"
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={resetViewport}
          aria-label="Reset map view to all results"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-ink shadow-card hover:border-ink"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 z-30 flex flex-col gap-1 rounded-xl border border-line bg-surface/95 px-3 py-2 text-xs text-ink-muted shadow-card">
        <span className="flex items-center gap-1.5 font-medium text-ink">
          <Move className="h-3.5 w-3.5" aria-hidden="true" />
          Drag to pan · scroll to zoom
        </span>
        <span className="flex items-center gap-1.5">
          <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
          {visibleCount} of {listings.length} stays in view
        </span>
        <span className="flex items-center gap-1.5">
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
          Zoom {zoomPercent}%
        </span>
      </div>
    </div>
  );
}

export default InteractiveMap;
