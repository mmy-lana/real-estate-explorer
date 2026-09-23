import { SearchX } from "lucide-react";
import type { PropertyListing } from "../../types";
import { cn, formatPlural } from "../../lib/utils";
import { Button } from "../primitives/Button";
import { PropertyCardSkeleton } from "../primitives/Skeleton";
import { PropertyCard } from "../molecules/PropertyCard";

export interface ListingGridProps {
  listings: readonly PropertyListing[];
  isFavorite: (listingId: string) => boolean;
  onToggleFavorite: (listingId: string) => void;
  onSelect: (listingId: string) => void;
  onHoverChange?: (listingId: string | null) => void;
  selectedListingId: string | null;
  /** Night count used for each card's total-price line. */
  nights: number;
  /** Renders card-geometry skeletons instead of results. */
  isLoading?: boolean;
  /** Number of skeleton cards to render while loading. */
  skeletonCount?: number;
  /** True when criteria are active and produced no results. */
  hasActiveFilters: boolean;
  /** Clears every filter from the empty state. */
  onClearFilters: () => void;
  /** Replaces the built-in empty state (e.g. an empty wishlist message). */
  emptyState?: React.ReactNode;
  /** Registers each card node so map selection can scroll it into view. */
  registerCardRef?: (listingId: string, node: HTMLElement | null) => void;
  className?: string;
}

/**
 * Responsive listing collection.
 *
 * Columns follow the breakpoint matrix: 1 column on phones, 2 at tablet
 * portrait, and 3 inside the desktop split view. Loading, empty, and
 * no-match-with-filters states all render in place so the surrounding layout
 * never collapses.
 */
export function ListingGrid({
  listings,
  isFavorite,
  onToggleFavorite,
  onSelect,
  onHoverChange,
  selectedListingId,
  nights,
  isLoading = false,
  skeletonCount = 6,
  hasActiveFilters,
  onClearFilters,
  emptyState,
  registerCardRef,
  className,
}: ListingGridProps): React.JSX.Element {
  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-2 lg:grid-cols-3",
          className,
        )}
      >
        <span className="sr-only">Loading stays</span>
        <PropertyCardSkeleton count={skeletonCount} />
      </div>
    );
  }

  if (listings.length === 0) {
    if (emptyState) return <>{emptyState}</>;

    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-4 rounded-panel border border-line bg-surface-alt px-6 py-16 text-center",
          className,
        )}
      >
        <span
          aria-hidden="true"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-ink-muted"
        >
          <SearchX className="h-6 w-6" />
        </span>

        <div className="max-w-sm">
          <h3 className="text-base font-semibold text-ink">
            No listings match your criteria
          </h3>
          <p className="mt-1.5 text-sm text-ink-muted">
            {hasActiveFilters
              ? "Try widening the price range, removing an amenity, or clearing the dates."
              : "This view has no saved stays yet. Explore the collection and tap the heart to save one."}
          </p>
        </div>

        {hasActiveFilters ? (
          <Button variant="outline" onClick={onClearFilters}>
            Clear all filters
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {listings.map((listing, index) => (
        <div
          key={listing.id}
          ref={(node) => {
            registerCardRef?.(listing.id, node);
          }}
          className="scroll-mt-28"
        >
          <PropertyCard
            listing={listing}
            isFavorite={isFavorite(listing.id)}
            onToggleFavorite={onToggleFavorite}
            onSelect={onSelect}
            onHoverChange={onHoverChange}
            isActive={listing.id === selectedListingId}
            nights={nights}
            priority={index < 3}
          />
        </div>
      ))}

      <p aria-live="polite" className="sr-only">
        {listings.length} {formatPlural(listings.length, "stay")} shown
      </p>
    </div>
  );
}

export default ListingGrid;
