import type {
  Coordinates,
  FilterState,
  GeoBounds,
  PropertyListing,
} from "../types";
import { VALIDATION_LIMITS } from "../types";
import { clamp, isCoordinateWithinBounds, normalizeIsoDate } from "./utils";

/**
 * In-memory multidimensional filter engine.
 *
 * Every predicate is pure and allocation-light: the engine runs on each
 * keystroke (debounced by the caller) across the whole repository, so it avoids
 * intermediate arrays and never mutates its inputs.
 */

/**
 * Availability test for a requested stay window.
 *
 * A listing is available when the window is well formed, meets the listing's
 * minimum stay, and does not overlap any blocked calendar range. Overlap uses
 * the half-open interval rule `startA < endB && endA > startB`, so a stay that
 * checks out on the day a block begins is still allowed.
 */
export function isListingAvailable(
  listing: PropertyListing,
  checkInDate: string | null,
  checkOutDate: string | null,
): boolean {
  if (!checkInDate || !checkOutDate) return true;

  const targetStart = new Date(`${checkInDate}T00:00:00.000Z`).getTime();
  const targetEnd = new Date(`${checkOutDate}T00:00:00.000Z`).getTime();

  if (
    Number.isNaN(targetStart) ||
    Number.isNaN(targetEnd) ||
    targetStart >= targetEnd
  ) {
    return false;
  }

  const nightCount = Math.round((targetEnd - targetStart) / 86_400_000);
  if (nightCount < listing.minNights) return false;

  for (const range of listing.blockedRanges) {
    const blockedStart = new Date(`${range.startDate}T00:00:00.000Z`).getTime();
    const blockedEnd = new Date(`${range.endDate}T00:00:00.000Z`).getTime();
    if (Number.isNaN(blockedStart) || Number.isNaN(blockedEnd)) continue;
    if (targetStart < blockedEnd && targetEnd > blockedStart) return false;
  }

  return true;
}

function matchesSearchQuery(
  listing: PropertyListing,
  searchQuery: string,
): boolean {
  const query = searchQuery.trim().toLowerCase();
  if (query.length === 0) return true;

  // Multi-word queries must all match somewhere in the searchable haystack.
  const haystack = [
    listing.title,
    listing.description,
    listing.address.city,
    listing.address.state,
    listing.address.neighborhood,
    listing.address.country,
    listing.propertyType,
    listing.host.name,
  ]
    .join(" ")
    .toLowerCase();

  return query.split(/\s+/).every((token) => haystack.includes(token));
}

function matchesBounds(
  listing: PropertyListing,
  bounds: GeoBounds | null,
): boolean {
  if (!bounds) return true;
  return isCoordinateWithinBounds(listing.coordinates, bounds);
}

function matchesAmenities(
  listing: PropertyListing,
  requiredAmenities: readonly string[],
): boolean {
  if (requiredAmenities.length === 0) return true;
  for (const amenity of requiredAmenities) {
    if (!listing.amenities.includes(amenity as PropertyListing["amenities"][number])) {
      return false;
    }
  }
  return true;
}

/** Applies the full filter matrix to a single listing. */
export function matchesListingFilters(
  listing: PropertyListing,
  filters: FilterState,
): boolean {
  if (!matchesSearchQuery(listing, filters.searchQuery)) return false;

  if (
    listing.pricePerNight < filters.priceRange[0] ||
    listing.pricePerNight > filters.priceRange[1]
  ) {
    return false;
  }

  if (!isListingAvailable(listing, filters.checkInDate, filters.checkOutDate)) {
    return false;
  }

  if (
    filters.propertyTypes.length > 0 &&
    !filters.propertyTypes.includes(listing.propertyType)
  ) {
    return false;
  }

  if (listing.capacity.beds < filters.minBeds) return false;
  if (listing.capacity.bedrooms < filters.minBedrooms) return false;
  if (listing.capacity.bathrooms < filters.minBathrooms) return false;

  if (!matchesAmenities(listing, filters.amenities)) return false;

  if (filters.instantBookOnly && !listing.isInstantBook) return false;
  if (filters.superhostOnly && !listing.host.isSuperhost) return false;
  if (listing.ratingAverage < filters.minRating) return false;

  if (!matchesBounds(listing, filters.bounds)) return false;

  return true;
}

/** Filters and sorts a repository snapshot. Never mutates the input array. */
export function applyListingFilters(
  listings: readonly PropertyListing[],
  filters: FilterState,
): PropertyListing[] {
  const matched: PropertyListing[] = [];
  for (const listing of listings) {
    if (matchesListingFilters(listing, filters)) matched.push(listing);
  }
  return sortListings(matched, filters.sortBy);
}

/** Orders listings for display. `featured` blends rating with superhost status. */
export function sortListings(
  listings: readonly PropertyListing[],
  sortBy: FilterState["sortBy"],
): PropertyListing[] {
  const cloned = [...listings];

  switch (sortBy) {
    case "price_asc":
      return cloned.sort(
        (a, b) =>
          a.pricePerNight - b.pricePerNight ||
          b.ratingAverage - a.ratingAverage,
      );
    case "price_desc":
      return cloned.sort(
        (a, b) =>
          b.pricePerNight - a.pricePerNight ||
          b.ratingAverage - a.ratingAverage,
      );
    case "rating_desc":
      return cloned.sort(
        (a, b) =>
          b.ratingAverage - a.ratingAverage ||
          b.ratingCount - a.ratingCount ||
          a.pricePerNight - b.pricePerNight,
      );
    case "featured":
    default:
      return cloned.sort((a, b) => {
        const aScore =
          a.ratingAverage * 10 +
          (a.host.isSuperhost ? 5 : 0) +
          (a.isRareFind ? 2 : 0) +
          Math.min(3, a.ratingCount / 100);
        const bScore =
          b.ratingAverage * 10 +
          (b.host.isSuperhost ? 5 : 0) +
          (b.isRareFind ? 2 : 0) +
          Math.min(3, b.ratingCount / 100);
        return bScore - aScore;
      });
  }
}

/**
 * Number of criteria the user has explicitly narrowed, used for the filter
 * badge. Price and sort are only counted when they differ from the defaults.
 */
export function countActiveFilters(filters: FilterState): number {
  let count = 0;

  if (filters.searchQuery.trim().length > 0) count += 1;
  if (filters.bounds) count += 1;
  if (filters.checkInDate && filters.checkOutDate) count += 1;
  if (
    filters.priceRange[0] > VALIDATION_LIMITS.MIN_PRICE ||
    filters.priceRange[1] < VALIDATION_LIMITS.MAX_PRICE
  ) {
    count += 1;
  }
  if (filters.propertyTypes.length > 0) count += 1;
  if (filters.amenities.length > 0) count += 1;
  if (filters.minBeds > 0) count += 1;
  if (filters.minBedrooms > 0) count += 1;
  if (filters.minBathrooms > 0) count += 1;
  if (filters.instantBookOnly) count += 1;
  if (filters.superhostOnly) count += 1;
  if (filters.minRating > 0) count += 1;

  return count;
}

/** Distinct cities present in a result set, sorted for suggestion lists. */
export function getAvailableCities(
  listings: readonly PropertyListing[],
): string[] {
  const cities = new Set<string>();
  for (const listing of listings) {
    cities.add(`${listing.address.city}, ${listing.address.state}`);
  }
  return Array.from(cities).sort((a, b) => a.localeCompare(b));
}

/** Lowest and highest nightly rates present in a result set. */
export function getPriceExtent(
  listings: readonly PropertyListing[],
): [number, number] {
  if (listings.length === 0) {
    return [VALIDATION_LIMITS.MIN_PRICE, VALIDATION_LIMITS.MAX_PRICE];
  }

  let min: number = VALIDATION_LIMITS.MAX_PRICE;
  let max: number = VALIDATION_LIMITS.MIN_PRICE;

  for (const listing of listings) {
    min = Math.min(min, listing.pricePerNight);
    max = Math.max(max, listing.pricePerNight);
  }

  return [
    clamp(min, VALIDATION_LIMITS.MIN_PRICE, VALIDATION_LIMITS.MAX_PRICE),
    clamp(max, VALIDATION_LIMITS.MIN_PRICE, VALIDATION_LIMITS.MAX_PRICE),
  ];
}

/** Normalises a raw `checkIn`/`checkOut` pair coming from a date picker. */
export function normalizeStayWindow(
  checkInDate: unknown,
  checkOutDate: unknown,
): { checkInDate: string | null; checkOutDate: string | null } {
  const checkIn = normalizeIsoDate(checkInDate);
  const checkOut = normalizeIsoDate(checkOutDate);

  if (!checkIn) return { checkInDate: null, checkOutDate: null };
  if (!checkOut || checkOut <= checkIn) {
    return { checkInDate: checkIn, checkOutDate: null };
  }

  return { checkInDate: checkIn, checkOutDate: checkOut };
}

/** Counts listings whose coordinates fall inside a bounds rectangle. */
export function countListingsWithinBounds(
  listings: readonly PropertyListing[],
  bounds: GeoBounds | null,
): number {
  if (!bounds) return listings.length;
  return listings.reduce(
    (total, listing) =>
      isCoordinateWithinBounds(listing.coordinates, bounds) ? total + 1 : total,
    0,
  );
}

/** Convenience helper for coordinate-only call sites (e.g. map clustering). */
export function isWithinBounds(
  coordinates: Coordinates,
  bounds: GeoBounds | null,
): boolean {
  return bounds ? isCoordinateWithinBounds(coordinates, bounds) : true;
}
