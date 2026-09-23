import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GeoBounds, PropertyListing } from "../types";
import { APP_CONFIG } from "../lib/config";

/**
 * Bidirectional synchronisation between the listing collection and the map.
 *
 * - Hovering or focusing a card highlights its pin (`hoveredListingId`).
 * - Selecting a pin (or a card) sets `selectedListingId` and scrolls the matching
 *   card into view inside the scrollable listing column.
 * - The map reports its viewport bounds here; the shell decides when to fold them
 *   into the active filters, which keeps the feedback loop one-directional and
 *   prevents a filter/emit cycle.
 */

export interface UseMapSyncOptions {
  /** Bounds emitted by the map are debounced by this window. Defaults to 350ms. */
  boundsDebounceMs?: number;
}

export interface UseMapSyncResult {
  hoveredListingId: string | null;
  selectedListingId: string | null;
  setHoveredListingId: (listingId: string | null) => void;
  selectListing: (listingId: string | null) => void;
  clearSelection: () => void;
  /** Registers a card node so pin selection can scroll it into view. */
  registerCardRef: (listingId: string, node: HTMLElement | null) => void;
  /** Scrolls a card into view without stealing focus from the map. */
  scrollToCard: (listingId: string) => void;
  /** Latest viewport bounds reported by the map (debounced). */
  mapBounds: GeoBounds | null;
  /** Called by the map whenever its viewport settles. */
  reportMapBounds: (bounds: GeoBounds) => void;
  /** True when the map viewport is being manipulated. */
  isMapInteracting: boolean;
  setMapInteracting: (value: boolean) => void;
  /** Resolved listing for the currently selected card. */
  selectedListing: PropertyListing | null;
}

export function useMapSync(
  listings: readonly PropertyListing[],
  options: UseMapSyncOptions = {},
): UseMapSyncResult {
  const { boundsDebounceMs = 350 } = options;

  const [hoveredListingId, setHoveredListingId] = useState<string | null>(null);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [mapBounds, setMapBounds] = useState<GeoBounds | null>(null);
  const [isMapInteracting, setMapInteracting] = useState(false);

  const cardRefs = useRef(new Map<string, HTMLElement>());
  const boundsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingBoundsRef = useRef<GeoBounds | null>(null);

  const registerCardRef = useCallback(
    (listingId: string, node: HTMLElement | null): void => {
      if (node) {
        cardRefs.current.set(listingId, node);
      } else {
        cardRefs.current.delete(listingId);
      }
    },
    [],
  );

  const scrollToCard = useCallback((listingId: string): void => {
    const node = cardRefs.current.get(listingId);
    if (!node) return;
    node.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, []);

  const selectListing = useCallback(
    (listingId: string | null): void => {
      setSelectedListingId(listingId);
      if (listingId) {
        setHoveredListingId(listingId);
        scrollToCard(listingId);
      }
    },
    [scrollToCard],
  );

  const clearSelection = useCallback((): void => {
    setSelectedListingId(null);
  }, []);

  const reportMapBounds = useCallback(
    (bounds: GeoBounds): void => {
      pendingBoundsRef.current = bounds;
      if (boundsTimerRef.current !== null) clearTimeout(boundsTimerRef.current);
      boundsTimerRef.current = setTimeout(() => {
        boundsTimerRef.current = null;
        setMapBounds(pendingBoundsRef.current);
      }, boundsDebounceMs);
    },
    [boundsDebounceMs],
  );

  // Escape dismisses the selection, matching the overlay behaviour.
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && selectedListingId !== null) {
        setSelectedListingId(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedListingId]);

  useEffect(
    () => () => {
      if (boundsTimerRef.current !== null) clearTimeout(boundsTimerRef.current);
    },
    [],
  );

  // A selected listing that no longer matches the filters must be released.
  useEffect(() => {
    if (!selectedListingId) return;
    if (!listings.some((listing) => listing.id === selectedListingId)) {
      setSelectedListingId(null);
    }
  }, [listings, selectedListingId]);

  const selectedListing = useMemo(
    () => listings.find((listing) => listing.id === selectedListingId) ?? null,
    [listings, selectedListingId],
  );

  return {
    hoveredListingId,
    selectedListingId,
    setHoveredListingId,
    selectListing,
    clearSelection,
    registerCardRef,
    scrollToCard,
    mapBounds,
    reportMapBounds,
    isMapInteracting,
    setMapInteracting,
    selectedListing,
  };
}

/** Bounds that fit the supplied listings, with a fallback to the app default. */
export function useInitialMapBounds(
  listings: readonly PropertyListing[],
): GeoBounds {
  return useMemo(() => {
    if (listings.length === 0) return APP_CONFIG.map.initialBounds;

    let north = -90;
    let south = 90;
    let east = -180;
    let west = 180;

    for (const listing of listings) {
      north = Math.max(north, listing.coordinates.lat);
      south = Math.min(south, listing.coordinates.lat);
      east = Math.max(east, listing.coordinates.lng);
      west = Math.min(west, listing.coordinates.lng);
    }

    const latSpan = Math.max(0.02, north - south);
    const lngSpan = Math.max(0.02, east - west);
    const padding = 0.08;

    return {
      north: Math.min(85, north + latSpan * padding),
      south: Math.max(-85, south - latSpan * padding),
      east: Math.min(180, east + lngSpan * padding),
      west: Math.max(-180, west - lngSpan * padding),
    };
  }, [listings]);
}

export default useMapSync;
