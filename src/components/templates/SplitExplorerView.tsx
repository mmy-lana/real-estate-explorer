import { Map, X } from "lucide-react";
import type { PropertyListing } from "../../types";
import { cn, formatPlural } from "../../lib/utils";
import { ListingGrid } from "../organisms/ListingGrid";

export interface SplitExplorerViewProps {
  listings: readonly PropertyListing[];
  isFavorite: (listingId: string) => boolean;
  onToggleFavorite: (listingId: string) => void;
  onSelect: (listingId: string) => void;
  onHoverChange?: (listingId: string | null) => void;
  selectedListingId: string | null;
  nights: number;
  isLoading: boolean;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  /** Replaces the built-in empty state (e.g. an empty wishlist message). */
  emptyState?: React.ReactNode;
  registerCardRef: (listingId: string, node: HTMLElement | null) => void;

  /** Results summary row: count, sort control, and active-criteria chips. */
  summary?: React.ReactNode;
  /** The projection map instance, rendered in the sticky desktop column. */
  map: React.ReactNode;
  /** Full-screen mobile map overlay, rendered only when open. */
  mapOverlay?: React.ReactNode;
  isMapOpen: boolean;
  onToggleMap: (open: boolean) => void;
}

/**
 * Responsive explorer body.
 *
 * - `lg` and up: a two-column split — a scrollable listing column at 60% and a
 *   sticky projection map at 40%.
 * - Below `lg`: a single-column grid with a floating "Show map" pill that swaps
 *   in the full-screen map overlay.
 *
 * The listing column owns its own scroll container on desktop, which keeps the
 * map stationary while the collection moves and lets pin selection scroll a card
 * into view with `scrollIntoView({ block: "nearest" })`.
 */
export function SplitExplorerView({
  listings,
  isFavorite,
  onToggleFavorite,
  onSelect,
  onHoverChange,
  selectedListingId,
  nights,
  isLoading,
  hasActiveFilters,
  onClearFilters,
  emptyState,
  registerCardRef,
  summary,
  map,
  mapOverlay,
  isMapOpen,
  onToggleMap,
}: SplitExplorerViewProps): React.JSX.Element {
  const count = listings.length;

  return (
    <>
      <div className="lg:flex lg:h-[calc(100dvh-var(--app-header-height,5rem))]">
        {/* Listing column */}
        <div className="thin-scrollbar min-w-0 flex-1 px-4 pt-4 pb-24 sm:px-6 lg:w-3/5 lg:overflow-y-auto lg:pt-6 lg:pb-8">
          <div className="mb-4 flex flex-col gap-2 lg:mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-lg font-semibold text-ink lg:text-xl">
                {isLoading
                  ? "Finding stays…"
                  : `${count} ${formatPlural(count, "stay")} available`}
              </h1>
              {summary}
            </div>
          </div>

          <ListingGrid
            listings={listings}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
            onSelect={onSelect}
            onHoverChange={onHoverChange}
            selectedListingId={selectedListingId}
            nights={nights}
            isLoading={isLoading}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={onClearFilters}
            emptyState={emptyState}
            registerCardRef={registerCardRef}
          />

          {!isLoading && count > 0 ? (
            <p className="mt-10 text-center text-xs text-ink-muted">
              You have reached the end of {count}{" "}
              {formatPlural(count, "result")} for these criteria.
            </p>
          ) : null}
        </div>

        {/* Sticky map column (desktop only) */}
        <aside
          aria-label="Map of results"
          className={cn(
            "hidden w-2/5 shrink-0 border-l border-line lg:block lg:h-full",
          )}
        >
          {map}
        </aside>
      </div>

      {/* Floating map toggle (mobile and tablet) */}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex justify-center lg:hidden">
        <button
          type="button"
          onClick={() => onToggleMap(!isMapOpen)}
          aria-expanded={isMapOpen}
          className={cn(
            "pointer-events-auto flex min-h-12 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white shadow-panel",
            "transition-transform duration-150 hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
          )}
        >
          {isMapOpen ? (
            <>
              <X className="h-4 w-4" aria-hidden="true" />
              Hide map
            </>
          ) : (
            <>
              <Map className="h-4 w-4" aria-hidden="true" />
              Show map
            </>
          )}
        </button>
      </div>

      {mapOverlay}
    </>
  );
}

export default SplitExplorerView;
