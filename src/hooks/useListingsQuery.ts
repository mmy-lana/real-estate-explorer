import { useMemo } from "react";
import {
  isValidListing,
  type FilterState,
  type PriceDistributionBucket,
  type PropertyListing,
} from "../types";
import {
  applyListingFilters,
  countListingsWithinBounds,
  getAvailableCities,
  getPriceExtent,
} from "../lib/filter-engine";
import { summarizePriceBuckets } from "../lib/histogram-calculator";

/**
 * Executes the filter engine against the repository and derives every aggregate
 * the explorer renders: the visible listing set, the price histogram, the price
 * extent, the city suggestions, and availability counts.
 *
 * The hook is pure with respect to its inputs — it never mutates the repository
 * and memoises on the filter state, so a debounced filter change costs exactly
 * one engine pass. The repository is injected by the caller so the seed module
 * can stay behind a dynamic import (see `App.tsx`).
 */

export interface UseListingsQueryOptions {
  /** Debounced filter state to apply. */
  filters: FilterState;
  /** Repository to query. */
  source: readonly PropertyListing[];
  /** Renders 12 wider histogram buckets instead of 28. */
  isMobileHistogram?: boolean;
}

export interface UseListingsQueryResult {
  /** Filtered and sorted results. */
  listings: PropertyListing[];
  /** Number of records in the repository. */
  totalCount: number;
  /** Number of results matching the current criteria. */
  filteredCount: number;
  /** True when no listing matches the criteria. */
  isEmpty: boolean;
  /** True when the repository itself is empty (data-layer failure). */
  isRepositoryEmpty: boolean;
  /** Records rejected by `isValidListing` (diagnostic counter). */
  invalidRecordCount: number;
  /** Histogram buckets for the unfiltered-by-price dataset. */
  priceBuckets: PriceDistributionBucket[];
  /** Highest bucket count, used to normalise bar heights. */
  maxBucketCount: number;
  /** Lowest and highest nightly rates in the repository. */
  priceExtent: [number, number];
  /** Distinct `"City, ST"` labels for the search suggestions. */
  cities: string[];
  /** Results matching every criterion except the viewport bounds. */
  boundsIndependentCount: number;
  /** Results inside the current viewport bounds (equals `filteredCount` when unset). */
  boundsMatchedCount: number;
  /** Listings available for the selected dates, ignoring other criteria. */
  availableForDatesCount: number;
}

export function useListingsQuery(
  options: UseListingsQueryOptions,
): UseListingsQueryResult {
  const {
    filters,
    source,
    isMobileHistogram = false,
  } = options;

  // Validate once per repository identity: guards against a malformed record
  // (from a future fetch or a persisted cache) reaching the render tree.
  const repository = useMemo<{
    valid: PropertyListing[];
    invalidRecordCount: number;
  }>(() => {
    const valid: PropertyListing[] = [];
    let invalidRecordCount = 0;

    for (const record of source) {
      if (isValidListing(record)) {
        valid.push(record);
      } else {
        invalidRecordCount += 1;
      }
    }

    return { valid, invalidRecordCount };
  }, [source]);

  const listings = useMemo(
    () => applyListingFilters(repository.valid, filters),
    [filters, repository.valid],
  );

  const priceExtent = useMemo(
    () => getPriceExtent(repository.valid),
    [repository.valid],
  );

  const cities = useMemo(
    () => getAvailableCities(repository.valid),
    [repository.valid],
  );

  // Histogram ignores the price criterion so the distribution stays a stable
  // frame of reference while the handles move.
  const histogramSource = useMemo(
    () =>
      applyListingFilters(repository.valid, {
        ...filters,
        priceRange: [priceExtent[0], priceExtent[1]],
      }),
    [filters, priceExtent, repository.valid],
  );

  const bucketSummary = useMemo(
    () =>
      summarizePriceBuckets(
        histogramSource,
        isMobileHistogram,
        priceExtent[0],
        priceExtent[1],
      ),
    [histogramSource, isMobileHistogram, priceExtent],
  );

  const boundsIndependentCount = useMemo(
    () =>
      applyListingFilters(repository.valid, { ...filters, bounds: null }).length,
    [filters, repository.valid],
  );

  const boundsMatchedCount = useMemo(
    () => countListingsWithinBounds(listings, filters.bounds),
    [filters.bounds, listings],
  );

  const availableForDatesCount = useMemo(() => {
    if (!filters.checkInDate || !filters.checkOutDate) {
      return repository.valid.length;
    }
    return applyListingFilters(repository.valid, {
      ...filters,
      bounds: null,
      priceRange: [priceExtent[0], priceExtent[1]],
    }).length;
  }, [
    filters,
    priceExtent,
    repository.valid,
  ]);

  return {
    listings,
    totalCount: repository.valid.length,
    filteredCount: listings.length,
    isEmpty: listings.length === 0 && repository.valid.length > 0,
    isRepositoryEmpty: repository.valid.length === 0,
    invalidRecordCount: repository.invalidRecordCount,
    priceBuckets: bucketSummary.buckets,
    maxBucketCount: bucketSummary.maxCount,
    priceExtent,
    cities,
    boundsIndependentCount,
    boundsMatchedCount,
    availableForDatesCount,
  };
}

export default useListingsQuery;
