import { useCallback, useEffect, useMemo, useState } from "react";
import { Heart, TriangleAlert } from "lucide-react";
import type { GeoBounds, PropertyListing } from "./types";
import { SORT_OPTIONS, SORT_OPTION_LABELS } from "./types";
import { APP_CONFIG } from "./lib/config";
import {
  formatCurrencyWhole,
  formatDateRangeLabel,
  formatPlural,
  nightsBetween,
} from "./lib/utils";
import { useListingFilters } from "./hooks/useListingFilters";
import { useListingsQuery } from "./hooks/useListingsQuery";
import { useFavorites } from "./hooks/useFavorites";
import { useMapSync } from "./hooks/useMapSync";
import {
  useIsCompactViewport,
  useIsSplitLayout,
} from "./hooks/useMediaQuery";
import { Button } from "./components/primitives/Button";
import {
  SearchBarCompact,
  type FilterSection,
} from "./components/molecules/SearchBarCompact";
import { MainNavigationBar } from "./components/organisms/MainNavigationBar";
import {
  MobileBottomNavigation,
  MobileNavigationHeader,
  type MobileTab,
} from "./components/organisms/MobileNavigationHeader";
import { InteractiveMap } from "./components/organisms/InteractiveMap";
import { MobileMapOverlay } from "./components/organisms/MobileMapOverlay";
import { FilterModal } from "./components/organisms/FilterModal";
import { ListingDetailSheet } from "./components/organisms/ListingDetailSheet";
import { ExplorerLayout } from "./components/templates/ExplorerLayout";
import { SplitExplorerView } from "./components/templates/SplitExplorerView";

type RepositoryStatus = "loading" | "ready" | "error";

/** Compares two viewport rectangles to the precision the URL round-trips. */
function boundsAreEqual(
  first: GeoBounds,
  second: GeoBounds,
  epsilon = 0.0001,
): boolean {
  return (
    Math.abs(first.north - second.north) < epsilon &&
    Math.abs(first.south - second.south) < epsilon &&
    Math.abs(first.east - second.east) < epsilon &&
    Math.abs(first.west - second.west) < epsilon
  );
}

interface RepositoryState {
  status: RepositoryStatus;
  listings: readonly PropertyListing[];
  errorMessage: string | null;
}

/**
 * Loads the listing repository through a dynamic import.
 *
 * This is a real async boundary rather than a simulated delay: the seed module
 * (and its 67 records) is code-split out of the initial bundle, the collection
 * renders card-geometry skeletons while it arrives, and a failed chunk load
 * surfaces a retryable error state instead of an empty screen.
 */
function useListingRepository(): RepositoryState & { retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<RepositoryState>({
    status: "loading",
    listings: [],
    errorMessage: null,
  });

  useEffect(() => {
    let isCancelled = false;
    setState({ status: "loading", listings: [], errorMessage: null });

    import("./lib/seed-data")
      .then((module) => {
        if (isCancelled) return;
        setState({
          status: "ready",
          listings: module.INITIAL_LISTINGS,
          errorMessage: null,
        });
      })
      .catch((error: unknown) => {
        if (isCancelled) return;
        setState({
          status: "error",
          listings: [],
          errorMessage:
            error instanceof Error
              ? error.message
              : "The listing repository could not be loaded.",
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { ...state, retry };
}

export default function App(): React.JSX.Element {
  const repository = useListingRepository();
  const isCompactViewport = useIsCompactViewport();
  const isSplitLayout = useIsSplitLayout();

  const {
    filters,
    effectiveFilters,
    isDebouncing,
    activeFilterCount,
    hasActiveFilters,
    updateFilters,
    setSearchQuery,
    setStayWindow,
    togglePropertyType,
    toggleAmenity,
    setCapacity,
    resetFilters,
    resetSection,
    setSortBy,
  } = useListingFilters();

  const query = useListingsQuery({
    filters: effectiveFilters,
    source: repository.listings,
    isMobileHistogram: isCompactViewport,
  });

  const favorites = useFavorites({ listings: repository.listings });

  const [activeTab, setActiveTab] = useState<MobileTab>("explore");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterSection, setFilterSection] = useState<FilterSection>(null);
  const [isMapOverlayOpen, setIsMapOverlayOpen] = useState(false);
  const [guestCount, setGuestCount] = useState(2);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const mapSync = useMapSync(query.listings);

  const isLoading = repository.status === "loading";

  /** The wishlist tab narrows the result set to saved stays. */
  const visibleListings = useMemo(() => {
    if (activeTab !== "wishlists") return query.listings;
    return query.listings.filter((listing) =>
      favorites.favoriteIds.has(listing.id),
    );
  }, [activeTab, favorites.favoriteIds, query.listings]);

  const nights = useMemo(() => {
    const requested = nightsBetween(filters.checkInDate, filters.checkOutDate);
    return requested > 0 ? requested : 0;
  }, [filters.checkInDate, filters.checkOutDate]);

  const openFilters = useCallback((section?: FilterSection) => {
    setFilterSection(section ?? "all");
    setIsFilterModalOpen(true);
  }, []);

  const handleSelectListing = useCallback(
    (listingId: string) => {
      mapSync.selectListing(listingId);
      setIsDetailOpen(true);
    },
    [mapSync],
  );

  // A listing removed by new criteria must not keep the detail overlay open.
  useEffect(() => {
    if (isDetailOpen && !mapSync.selectedListing) setIsDetailOpen(false);
  }, [isDetailOpen, mapSync.selectedListing]);

  /**
   * Folds the settled map viewport into the active bounds filter (plan §3.3).
   *
   * The map only reports bounds after a pan/zoom gesture settles, and this effect
   * only runs while a map instance is actually mounted, so the flow stays
   * one-directional: interaction → bounds → filters → results. Filtering never
   * feeds back into the map viewport, which is what would otherwise oscillate.
   */
  const isMapMounted = isSplitLayout || isMapOverlayOpen;
  useEffect(() => {
    if (!isMapMounted || mapSync.isMapInteracting) return;
    const nextBounds = mapSync.mapBounds;
    if (!nextBounds) return;
    if (filters.bounds && boundsAreEqual(filters.bounds, nextBounds)) return;
    updateFilters({ bounds: nextBounds });
  }, [
    filters.bounds,
    isMapMounted,
    mapSync.isMapInteracting,
    mapSync.mapBounds,
    updateFilters,
  ]);

  const dateLabel = formatDateRangeLabel(
    filters.checkInDate,
    filters.checkOutDate,
  );

  const guestLabel = useMemo(() => {
    const parts: string[] = [];
    if (filters.minBedrooms > 0) {
      parts.push(`${filters.minBedrooms} bedrooms`);
    }
    if (filters.minBeds > 0) parts.push(`${filters.minBeds} beds`);
    if (filters.minBathrooms > 0) {
      parts.push(`${filters.minBathrooms} bathrooms`);
    }
    if (parts.length > 0) return parts.join(" · ");
    return `${guestCount} ${formatPlural(guestCount, "guest")}`;
  }, [
    filters.minBathrooms,
    filters.minBeds,
    filters.minBedrooms,
    guestCount,
  ]);

  const priceLabel =
    filters.priceRange[0] > 10 || filters.priceRange[1] < 2000
      ? `${formatCurrencyWhole(filters.priceRange[0])} – ${formatCurrencyWhole(filters.priceRange[1])}`
      : "";

  const propertyTypeLabel =
    filters.propertyTypes.length === 1
      ? filters.propertyTypes[0]
      : filters.propertyTypes.length > 1
        ? `${filters.propertyTypes.length} types`
        : "";

  const searchSummary =
    filters.searchQuery.trim().length > 0
      ? filters.searchQuery
      : dateLabel || "Where to?";

  const summaryControls = (
    <div className="flex items-center gap-3">
      {isDebouncing ? (
        <span className="text-xs text-ink-muted" aria-live="polite">
          Updating…
        </span>
      ) : null}

      <label className="flex items-center gap-2 text-xs text-ink-muted">
        <span className="hidden sm:inline">Sort</span>
        <select
          value={filters.sortBy}
          onChange={(event) =>
            setSortBy(event.target.value as typeof filters.sortBy)
          }
          aria-label="Sort results"
          className="rounded-full border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink outline-none focus:border-ink"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {SORT_OPTION_LABELS[option]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  const mapNode = (
    <InteractiveMap
      listings={visibleListings}
      hoveredListingId={mapSync.hoveredListingId}
      selectedListingId={mapSync.selectedListingId}
      onSelectListing={handleSelectListing}
      onHoverListing={mapSync.setHoveredListingId}
      onBoundsChange={mapSync.reportMapBounds}
      onInteractionChange={mapSync.setMapInteracting}
    />
  );

  const wishlistEmptyState = (
    <div className="mx-auto max-w-xl rounded-panel border border-line bg-surface-alt px-6 py-10 text-center">
      <span
        aria-hidden="true"
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface text-brand"
      >
        <Heart className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-base font-semibold text-ink">
        Your wishlist is empty
      </h2>
      <p className="mt-1.5 text-sm text-ink-muted">
        Tap the heart on any stay to save it here. Saved stays persist in this
        browser and stay in sync across tabs.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => setActiveTab("explore")}>Browse stays</Button>
        {favorites.count > 0 ? (
          <Button variant="outline" onClick={favorites.clearFavorites}>
            Clear wishlist
          </Button>
        ) : null}
      </div>
      <p className="mt-4 text-xs text-ink-subtle">
        {query.totalCount} stays in the collection · {APP_CONFIG.appTitle}
      </p>
    </div>
  );

  const statusRegion =
    repository.status === "error" ? (
      <span className="flex flex-wrap items-center gap-2">
        <TriangleAlert className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
        <span className="text-warning">
          {repository.errorMessage ?? "The listing repository failed to load."}
        </span>
        <button
          type="button"
          onClick={repository.retry}
          className="font-semibold text-ink underline"
        >
          Retry
        </button>
      </span>
    ) : activeTab === "wishlists" ? (
      <span>
        Showing {visibleListings.length} saved{" "}
        {formatPlural(visibleListings.length, "stay")} out of {favorites.count} in
        your wishlist.
      </span>
    ) : query.invalidRecordCount > 0 ? (
      <span>
        {query.invalidRecordCount}{" "}
        {formatPlural(query.invalidRecordCount, "record")} failed validation and
        were skipped.
      </span>
    ) : null;

  return (
    <ExplorerLayout
      header={
        <>
          <MainNavigationBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            favoriteCount={favorites.count}
            activeFilterCount={activeFilterCount}
            onOpenFilters={() => openFilters("all")}
          >
            <SearchBarCompact
              searchQuery={filters.searchQuery}
              onSearchQueryChange={setSearchQuery}
              dateLabel={dateLabel}
              guestLabel={guestLabel}
              priceLabel={priceLabel}
              propertyTypeLabel={propertyTypeLabel}
              activeFilterCount={activeFilterCount}
              resultCount={query.filteredCount}
              onOpenFilters={openFilters}
            />
          </MainNavigationBar>

          <MobileNavigationHeader
            searchSummary={searchSummary}
            activeFilterCount={activeFilterCount}
            onOpenSearch={() => openFilters("location")}
            onOpenFilters={() => openFilters("all")}
          />
        </>
      }
      statusRegion={statusRegion}
      bottomNav={
        <MobileBottomNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          favoriteCount={favorites.count}
          isMapOpen={isMapOverlayOpen}
          onToggleMap={setIsMapOverlayOpen}
          onOpenFilters={() => openFilters("all")}
          activeFilterCount={activeFilterCount}
        />
      }
      overlays={
        <>
          <MobileMapOverlay
            isOpen={isMapOverlayOpen && !isSplitLayout}
            onClose={() => setIsMapOverlayOpen(false)}
            resultCount={visibleListings.length}
            hasBoundsFilter={filters.bounds !== null}
            onClearBounds={() => updateFilters({ bounds: null })}
          >
            {isSplitLayout ? null : mapNode}
          </MobileMapOverlay>

          <FilterModal
            isOpen={isFilterModalOpen}
            onClose={() => setIsFilterModalOpen(false)}
            filters={filters}
            onUpdateFilters={updateFilters}
            onTogglePropertyType={togglePropertyType}
            onToggleAmenity={toggleAmenity}
            onSetCapacity={setCapacity}
            onSetStayWindow={setStayWindow}
            onResetSection={resetSection}
            onResetAll={resetFilters}
            resultCount={query.filteredCount}
            listings={repository.listings}
            buckets={query.priceBuckets}
            isMobileHistogram={isCompactViewport}
            initialSection={filterSection}
          />

          <ListingDetailSheet
            listing={mapSync.selectedListing}
            isOpen={isDetailOpen && mapSync.selectedListing !== null}
            onClose={() => setIsDetailOpen(false)}
            isFavorite={
              mapSync.selectedListing
                ? favorites.isFavorite(mapSync.selectedListing.id)
                : false
            }
            onToggleFavorite={favorites.toggleFavorite}
            checkInDate={filters.checkInDate}
            checkOutDate={filters.checkOutDate}
            onSetStayWindow={setStayWindow}
            guestCount={guestCount}
            onGuestCountChange={setGuestCount}
          />
        </>
      }
    >
      <SplitExplorerView
        listings={visibleListings}
        isFavorite={favorites.isFavorite}
        onToggleFavorite={favorites.toggleFavorite}
        onSelect={handleSelectListing}
        onHoverChange={mapSync.setHoveredListingId}
        selectedListingId={mapSync.selectedListingId}
        nights={nights}
        isLoading={isLoading}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={resetFilters}
        emptyState={activeTab === "wishlists" ? wishlistEmptyState : undefined}
        registerCardRef={mapSync.registerCardRef}
        summary={summaryControls}
        map={isSplitLayout ? mapNode : null}
        isMapOpen={isMapOverlayOpen}
        onToggleMap={setIsMapOverlayOpen}
      />
    </ExplorerLayout>
  );
}
