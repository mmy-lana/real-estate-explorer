/**
 * Canonical domain schema, validation contracts, label registries, and
 * persistence type definitions for the Real Estate Explorer client.
 *
 * This module is intentionally framework free: it contains no React, no DOM
 * access, and no imports, so both the data layer (`src/lib`) and the rendering
 * layer (`src/components`) can depend on it without creating cycles.
 */

/* -------------------------------------------------------------------------- */
/* 1. Core enumerations                                                       */
/* -------------------------------------------------------------------------- */

export type PropertyType =
  | "apartment"
  | "house"
  | "villa"
  | "cabin"
  | "loft"
  | "studio"
  | "townhouse";

export type Amenity =
  | "wifi"
  | "kitchen"
  | "washer"
  | "dryer"
  | "air_conditioning"
  | "heating"
  | "pool"
  | "hot_tub"
  | "free_parking"
  | "ev_charger"
  | "gym"
  | "bbq_grill"
  | "patio"
  | "lake_access"
  | "ski_in_out"
  | "workspace"
  | "pets_allowed"
  | "smoke_alarm";

export type ListingSortOption =
  | "price_asc"
  | "price_desc"
  | "rating_desc"
  | "featured";

/* -------------------------------------------------------------------------- */
/* 2. Geographic value objects                                                */
/* -------------------------------------------------------------------------- */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeoBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/* -------------------------------------------------------------------------- */
/* 3. Listing domain model                                                    */
/* -------------------------------------------------------------------------- */

export interface HostProfile {
  id: string;
  name: string;
  avatarUrl: string;
  isSuperhost: boolean;
  joinedDate: string;
  responseRatePercent: number;
  responseTimeMinutes: number;
}

export interface ReviewBreakdown {
  cleanliness: number;
  accuracy: number;
  communication: number;
  location: number;
  checkIn: number;
  value: number;
}

/** Inclusive start date, exclusive end date, both ISO 8601 `YYYY-MM-DD`. */
export interface AvailabilityRange {
  startDate: string;
  endDate: string;
}

export interface ListingAddress {
  street: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  neighborhood: string;
}

export interface ListingCapacity {
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
}

export interface BookingDraft {
  listingId: string;
  checkInDate: string | null;
  checkOutDate: string | null;
  guestCount: number;
  nightsCount: number;
  basePriceTotal: number;
  cleaningFee: number;
  serviceFee: number;
  totalPrice: number;
}

export interface PropertyListing {
  id: string;
  title: string;
  slug: string;
  description: string;
  propertyType: PropertyType;
  pricePerNight: number;
  cleaningFee: number;
  serviceFeePercent: number;
  currency: string;
  ratingAverage: number;
  ratingCount: number;
  reviewBreakdown: ReviewBreakdown;
  images: string[];
  coordinates: Coordinates;
  address: ListingAddress;
  capacity: ListingCapacity;
  amenities: Amenity[];
  /** Standardized calendar range blocks. */
  blockedRanges: AvailabilityRange[];
  minNights: number;
  isInstantBook: boolean;
  isRareFind: boolean;
  host: HostProfile;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/* 4. Query / filter state                                                    */
/* -------------------------------------------------------------------------- */

export interface FilterState {
  searchQuery: string;
  bounds: GeoBounds | null;
  priceRange: [number, number];
  checkInDate: string | null;
  checkOutDate: string | null;
  propertyTypes: PropertyType[];
  minBeds: number;
  minBedrooms: number;
  minBathrooms: number;
  amenities: Amenity[];
  instantBookOnly: boolean;
  superhostOnly: boolean;
  minRating: number;
  sortBy: ListingSortOption;
}

/** Client-only single-user collection (no remote multi-user backend required). */
export interface UserFavoriteRecord {
  listingId: string;
  savedAt: string;
  folderName: string;
}

export interface PriceDistributionBucket {
  rangeStart: number;
  rangeEnd: number;
  count: number;
}

/* -------------------------------------------------------------------------- */
/* 5. Numeric validation limits                                               */
/* -------------------------------------------------------------------------- */

export const VALIDATION_LIMITS = {
  MIN_PRICE: 10,
  MAX_PRICE: 2000,
  MIN_CAPACITY: 1,
  MAX_CAPACITY: 16,
  MIN_COORDINATES: { lat: -90, lng: -180 },
  MAX_COORDINATES: { lat: 90, lng: 180 },
} as const;

export const MAX_SEARCH_QUERY_LENGTH = 100;

/* -------------------------------------------------------------------------- */
/* 6. Label registries (exhaustive by construction)                           */
/* -------------------------------------------------------------------------- */

/**
 * `Record<PropertyType, string>` forces exhaustiveness at compile time: adding a
 * member to the union without a label is a type error, which keeps the derived
 * `PROPERTY_TYPES` array authoritative.
 */
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: "Apartment",
  house: "House",
  villa: "Villa",
  cabin: "Cabin",
  loft: "Loft",
  studio: "Studio",
  townhouse: "Townhouse",
};

export const AMENITY_LABELS: Record<Amenity, string> = {
  wifi: "Wifi",
  kitchen: "Kitchen",
  washer: "Washer",
  dryer: "Dryer",
  air_conditioning: "Air conditioning",
  heating: "Heating",
  pool: "Pool",
  hot_tub: "Hot tub",
  free_parking: "Free parking on premises",
  ev_charger: "EV charger",
  gym: "Gym",
  bbq_grill: "BBQ grill",
  patio: "Patio or balcony",
  lake_access: "Lake access",
  ski_in_out: "Ski-in/ski-out",
  workspace: "Dedicated workspace",
  pets_allowed: "Pets allowed",
  smoke_alarm: "Smoke alarm",
};

export const SORT_OPTION_LABELS: Record<ListingSortOption, string> = {
  featured: "Recommended",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  rating_desc: "Top rated",
};

export const PROPERTY_TYPES: readonly PropertyType[] = Object.keys(
  PROPERTY_TYPE_LABELS,
) as PropertyType[];

export const AMENITIES: readonly Amenity[] = Object.keys(
  AMENITY_LABELS,
) as Amenity[];

export const SORT_OPTIONS: readonly ListingSortOption[] = Object.keys(
  SORT_OPTION_LABELS,
) as ListingSortOption[];

export const RATING_OPTIONS: readonly number[] = [0, 4.5, 4.7, 4.8, 4.9, 5];

const PROPERTY_TYPE_SET: ReadonlySet<string> = new Set<string>(PROPERTY_TYPES);
const AMENITY_SET: ReadonlySet<string> = new Set<string>(AMENITIES);
const SORT_OPTION_SET: ReadonlySet<string> = new Set<string>(SORT_OPTIONS);

/* -------------------------------------------------------------------------- */
/* 7. Runtime type guards                                                     */
/* -------------------------------------------------------------------------- */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isPropertyType(value: unknown): value is PropertyType {
  return typeof value === "string" && PROPERTY_TYPE_SET.has(value);
}

export function isAmenity(value: unknown): value is Amenity {
  return typeof value === "string" && AMENITY_SET.has(value);
}

export function isListingSortOption(
  value: unknown,
): value is ListingSortOption {
  return typeof value === "string" && SORT_OPTION_SET.has(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isValidCoordinates(value: unknown): value is Coordinates {
  if (!isRecord(value)) return false;
  return (
    isFiniteNumber(value.lat) &&
    isFiniteNumber(value.lng) &&
    value.lat >= VALIDATION_LIMITS.MIN_COORDINATES.lat &&
    value.lat <= VALIDATION_LIMITS.MAX_COORDINATES.lat &&
    value.lng >= VALIDATION_LIMITS.MIN_COORDINATES.lng &&
    value.lng <= VALIDATION_LIMITS.MAX_COORDINATES.lng
  );
}

export function isValidGeoBounds(value: unknown): value is GeoBounds {
  if (!isRecord(value)) return false;
  const { north, south, east, west } = value;
  return (
    isFiniteNumber(north) &&
    isFiniteNumber(south) &&
    isFiniteNumber(east) &&
    isFiniteNumber(west) &&
    north <= VALIDATION_LIMITS.MAX_COORDINATES.lat &&
    south >= VALIDATION_LIMITS.MIN_COORDINATES.lat &&
    north > south &&
    east <= VALIDATION_LIMITS.MAX_COORDINATES.lng &&
    east >= VALIDATION_LIMITS.MIN_COORDINATES.lng &&
    west <= VALIDATION_LIMITS.MAX_COORDINATES.lng &&
    west >= VALIDATION_LIMITS.MIN_COORDINATES.lng
  );
}

export function isValidAvailabilityRange(
  value: unknown,
): value is AvailabilityRange {
  if (!isRecord(value)) return false;
  return (
    isIsoDateString(value.startDate) &&
    isIsoDateString(value.endDate) &&
    value.startDate < value.endDate
  );
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Structural + semantic validation for a persisted or fetched listing record.
 * Price bounds, coordinate bounds, capacity sanity, and relationship integrity
 * (host payload, review breakdown, blocked ranges) are all verified before a
 * record is trusted by the application.
 */
export function isValidListing(data: unknown): data is PropertyListing {
  if (!isRecord(data)) return false;
  const item = data;

  const hasValidPrimitives =
    isNonEmptyString(item.id) &&
    isNonEmptyString(item.title) &&
    isNonEmptyString(item.slug) &&
    isFiniteNumber(item.pricePerNight) &&
    item.pricePerNight >= VALIDATION_LIMITS.MIN_PRICE &&
    item.pricePerNight <= VALIDATION_LIMITS.MAX_PRICE &&
    isPropertyType(item.propertyType) &&
    isFiniteNumber(item.cleaningFee) &&
    item.cleaningFee >= 0 &&
    isFiniteNumber(item.serviceFeePercent) &&
    item.serviceFeePercent >= 0 &&
    item.serviceFeePercent <= 1 &&
    isNonEmptyString(item.currency) &&
    isFiniteNumber(item.ratingAverage) &&
    item.ratingAverage >= 0 &&
    item.ratingAverage <= 5 &&
    isFiniteNumber(item.ratingCount) &&
    item.ratingCount >= 0 &&
    isFiniteNumber(item.minNights) &&
    item.minNights >= 1 &&
    typeof item.isInstantBook === "boolean" &&
    typeof item.isRareFind === "boolean";

  if (!hasValidPrimitives) return false;

  if (
    !Array.isArray(item.images) ||
    item.images.length === 0 ||
    !item.images.every(isNonEmptyString)
  ) {
    return false;
  }

  if (!isValidCoordinates(item.coordinates)) return false;

  const capacity = item.capacity;
  if (
    !isRecord(capacity) ||
    !isFiniteNumber(capacity.maxGuests) ||
    capacity.maxGuests < VALIDATION_LIMITS.MIN_CAPACITY ||
    capacity.maxGuests > VALIDATION_LIMITS.MAX_CAPACITY ||
    !isFiniteNumber(capacity.bedrooms) ||
    capacity.bedrooms < 0 ||
    !isFiniteNumber(capacity.beds) ||
    capacity.beds < 0 ||
    !isFiniteNumber(capacity.bathrooms) ||
    capacity.bathrooms < 0
  ) {
    return false;
  }

  const address = item.address;
  if (
    !isRecord(address) ||
    !isNonEmptyString(address.city) ||
    !isNonEmptyString(address.state) ||
    !isNonEmptyString(address.country)
  ) {
    return false;
  }

  if (
    !Array.isArray(item.amenities) ||
    !item.amenities.every(isAmenity) ||
    !Array.isArray(item.blockedRanges) ||
    !item.blockedRanges.every(isValidAvailabilityRange)
  ) {
    return false;
  }

  const host = item.host;
  if (
    !isRecord(host) ||
    !isNonEmptyString(host.id) ||
    !isNonEmptyString(host.name) ||
    !isNonEmptyString(host.avatarUrl) ||
    typeof host.isSuperhost !== "boolean" ||
    !isFiniteNumber(host.responseRatePercent) ||
    host.responseRatePercent < 0 ||
    host.responseRatePercent > 100 ||
    !isFiniteNumber(host.responseTimeMinutes) ||
    host.responseTimeMinutes < 0
  ) {
    return false;
  }

  const breakdown = item.reviewBreakdown;
  if (!isRecord(breakdown)) return false;

  const breakdownKeys: readonly (keyof ReviewBreakdown)[] = [
    "cleanliness",
    "accuracy",
    "communication",
    "location",
    "checkIn",
    "value",
  ];

  return breakdownKeys.every((key) => {
    const score = breakdown[key];
    return isFiniteNumber(score) && score >= 0 && score <= 5;
  });
}

export function isValidUserFavoriteRecord(
  data: unknown,
): data is UserFavoriteRecord {
  if (!isRecord(data)) return false;
  return (
    isNonEmptyString(data.listingId) &&
    typeof data.savedAt === "string" &&
    !Number.isNaN(Date.parse(data.savedAt)) &&
    isNonEmptyString(data.folderName)
  );
}

/** Validates a raw `YYYY-MM-DD` string, including real calendar day checks. */
export function isIsoDateString(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

/* -------------------------------------------------------------------------- */
/* 8. Filter-state sanitisation                                               */
/* -------------------------------------------------------------------------- */

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toFiniteOr(value: unknown, fallback: number): number {
  return isFiniteNumber(value) ? value : fallback;
}

/**
 * Coerces untrusted input (URL search params, localStorage, restored history)
 * into a fully valid `FilterState`. Unknown enum members are dropped rather
 * than trusted, and the price window is normalised so `min <= max`.
 */
export function sanitizeFilterState(
  raw: Partial<FilterState> | null | undefined,
): FilterState {
  const source: Partial<FilterState> = isRecord(raw) ? raw : {};
  const rawRange = Array.isArray(source.priceRange)
    ? source.priceRange
    : undefined;

  const minPrice = clampNumber(
    toFiniteOr(rawRange?.[0], VALIDATION_LIMITS.MIN_PRICE),
    VALIDATION_LIMITS.MIN_PRICE,
    VALIDATION_LIMITS.MAX_PRICE,
  );
  const maxPrice = clampNumber(
    toFiniteOr(rawRange?.[1], VALIDATION_LIMITS.MAX_PRICE),
    VALIDATION_LIMITS.MIN_PRICE,
    VALIDATION_LIMITS.MAX_PRICE,
  );

  const propertyTypes = Array.isArray(source.propertyTypes)
    ? Array.from(new Set(source.propertyTypes.filter(isPropertyType)))
    : [];
  const amenities = Array.isArray(source.amenities)
    ? Array.from(new Set(source.amenities.filter(isAmenity)))
    : [];

  const rawCheckIn = source.checkInDate;
  const rawCheckOut = source.checkOutDate;
  const checkInDate = isIsoDateString(rawCheckIn) ? rawCheckIn : null;
  const checkOutDate =
    isIsoDateString(rawCheckOut) && (!checkInDate || rawCheckOut > checkInDate)
      ? rawCheckOut
      : null;

  return {
    searchQuery: String(source.searchQuery ?? "")
      .trim()
      .slice(0, MAX_SEARCH_QUERY_LENGTH),
    bounds: isValidGeoBounds(source.bounds) ? source.bounds : null,
    priceRange: [Math.min(minPrice, maxPrice), Math.max(minPrice, maxPrice)],
    checkInDate,
    checkOutDate,
    propertyTypes,
    minBeds: Math.floor(
      clampNumber(
        toFiniteOr(source.minBeds, 0),
        0,
        VALIDATION_LIMITS.MAX_CAPACITY,
      ),
    ),
    minBedrooms: Math.floor(
      clampNumber(
        toFiniteOr(source.minBedrooms, 0),
        0,
        VALIDATION_LIMITS.MAX_CAPACITY,
      ),
    ),
    minBathrooms: Math.floor(
      clampNumber(
        toFiniteOr(source.minBathrooms, 0),
        0,
        VALIDATION_LIMITS.MAX_CAPACITY,
      ),
    ),
    amenities,
    instantBookOnly: Boolean(source.instantBookOnly),
    superhostOnly: Boolean(source.superhostOnly),
    minRating: clampNumber(toFiniteOr(source.minRating, 0), 0, 5),
    sortBy: isListingSortOption(source.sortBy) ? source.sortBy : "featured",
  };
}

/** Returns a fresh, fully-populated filter state (never a shared reference). */
export function createDefaultFilterState(): FilterState {
  return {
    searchQuery: "",
    bounds: null,
    priceRange: [VALIDATION_LIMITS.MIN_PRICE, VALIDATION_LIMITS.MAX_PRICE],
    checkInDate: null,
    checkOutDate: null,
    propertyTypes: [],
    minBeds: 0,
    minBedrooms: 0,
    minBathrooms: 0,
    amenities: [],
    instantBookOnly: false,
    superhostOnly: false,
    minRating: 0,
    sortBy: "featured",
  };
}

/** Read-only baseline. Treat as immutable; clone with `createDefaultFilterState()`. */
export const DEFAULT_FILTER_STATE: FilterState = createDefaultFilterState();

/* -------------------------------------------------------------------------- */
/* 9. Persistence contracts                                                   */
/* -------------------------------------------------------------------------- */

export const STORAGE_KEYS = {
  FAVORITES: "realestate_explorer_favorites_v1",
  FILTER_PREFERENCES: "realestate_explorer_filter_prefs_v1",
  RECENT_SEARCHES: "realestate_explorer_recent_searches_v1",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export interface StoredFilterPreferences {
  priceRange: [number, number];
  propertyTypes: PropertyType[];
  amenities: Amenity[];
}

export interface StoredSearchHistory {
  query: string;
  timestamp: number;
}

export const DEFAULT_FAVORITE_FOLDER = "Wishlist";
