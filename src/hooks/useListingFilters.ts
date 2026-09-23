import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AMENITIES,
  PROPERTY_TYPES,
  STORAGE_KEYS,
  VALIDATION_LIMITS,
  createDefaultFilterState,
  isAmenity,
  isIsoDateString,
  isListingSortOption,
  isPropertyType,
  sanitizeFilterState,
  type FilterState,
  type GeoBounds,
  type StoredFilterPreferences,
} from "../types";
import { APP_CONFIG } from "../lib/config";
import { readStorageRecord, writeStorageJson } from "../lib/storage";
import { countActiveFilters, normalizeStayWindow } from "../lib/filter-engine";
import { clamp, clampInt, toFiniteNumber } from "../lib/utils";

/**
 * Owns the authoritative `FilterState` for the explorer.
 *
 * Responsibilities
 * - Immediate state for every control, so sliders and text fields never lag.
 * - A debounced projection of that state for expensive filtering
 *   (`APP_CONFIG.searchDebounceMs`, 250ms by default).
 * - Two-way URL query persistence, so a filtered view is shareable and survives
 *   a reload or a shared link.
 * - Preference persistence for the price window, property types, and amenities.
 * - Active criteria counting for the filter badge.
 */

/** Trailing-edge debounce for arbitrary values. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    if (delayMs <= 0) {
      setDebounced(value);
      return;
    }
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

const URL_PARAM_KEYS = {
  query: "q",
  checkIn: "checkin",
  checkOut: "checkout",
  minPrice: "min",
  maxPrice: "max",
  types: "types",
  amenities: "amenities",
  beds: "beds",
  bedrooms: "bedrooms",
  bathrooms: "baths",
  rating: "rating",
  instant: "instant",
  superhost: "superhost",
  sort: "sort",
  north: "n",
  south: "s",
  east: "e",
  west: "w",
} as const;

/** Reads a partial filter state from the current URL query string. */
export function readFiltersFromUrl(search?: string): Partial<FilterState> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(search ?? window.location.search);
  const patch: Partial<FilterState> = {};

  const query = params.get(URL_PARAM_KEYS.query);
  if (query) patch.searchQuery = query;

  const checkIn = params.get(URL_PARAM_KEYS.checkIn);
  const checkOut = params.get(URL_PARAM_KEYS.checkOut);
  if (checkIn || checkOut) {
    const stayWindow = normalizeStayWindow(checkIn, checkOut);
    patch.checkInDate = stayWindow.checkInDate;
    patch.checkOutDate = stayWindow.checkOutDate;
  }

  const minPrice = params.get(URL_PARAM_KEYS.minPrice);
  const maxPrice = params.get(URL_PARAM_KEYS.maxPrice);
  if (minPrice !== null || maxPrice !== null) {
    patch.priceRange = [
      clamp(
        toFiniteNumber(minPrice, VALIDATION_LIMITS.MIN_PRICE),
        VALIDATION_LIMITS.MIN_PRICE,
        VALIDATION_LIMITS.MAX_PRICE,
      ),
      clamp(
        toFiniteNumber(maxPrice, VALIDATION_LIMITS.MAX_PRICE),
        VALIDATION_LIMITS.MIN_PRICE,
        VALIDATION_LIMITS.MAX_PRICE,
      ),
    ];
  }

  const types = params.get(URL_PARAM_KEYS.types);
  if (types) patch.propertyTypes = types.split(",").filter(isPropertyType);

  const amenities = params.get(URL_PARAM_KEYS.amenities);
  if (amenities) patch.amenities = amenities.split(",").filter(isAmenity);

  const beds = params.get(URL_PARAM_KEYS.beds);
  if (beds !== null) patch.minBeds = clampInt(toFiniteNumber(beds, 0), 0, 16);

  const bedrooms = params.get(URL_PARAM_KEYS.bedrooms);
  if (bedrooms !== null) {
    patch.minBedrooms = clampInt(toFiniteNumber(bedrooms, 0), 0, 16);
  }

  const bathrooms = params.get(URL_PARAM_KEYS.bathrooms);
  if (bathrooms !== null) {
    patch.minBathrooms = clampInt(toFiniteNumber(bathrooms, 0), 0, 16);
  }

  const rating = params.get(URL_PARAM_KEYS.rating);
  if (rating !== null) patch.minRating = clamp(toFiniteNumber(rating, 0), 0, 5);

  if (params.get(URL_PARAM_KEYS.instant) === "1") patch.instantBookOnly = true;
  if (params.get(URL_PARAM_KEYS.superhost) === "1") patch.superhostOnly = true;

  const sort = params.get(URL_PARAM_KEYS.sort);
  if (isListingSortOption(sort)) patch.sortBy = sort;

  const north = params.get(URL_PARAM_KEYS.north);
  const south = params.get(URL_PARAM_KEYS.south);
  const east = params.get(URL_PARAM_KEYS.east);
  const west = params.get(URL_PARAM_KEYS.west);
  if (north && south && east && west) {
    // `sanitizeFilterState` drops the bounds again if they are not well formed.
    patch.bounds = {
      north: toFiniteNumber(north, Number.NaN),
      south: toFiniteNumber(south, Number.NaN),
      east: toFiniteNumber(east, Number.NaN),
      west: toFiniteNumber(west, Number.NaN),
    };
  }

  return patch;
}

/** Serialises the filter state into a compact query string (defaults omitted). */
export function writeFiltersToUrl(filters: FilterState): void {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams();
  const defaults = createDefaultFilterState();

  if (filters.searchQuery.trim().length > 0) {
    params.set(URL_PARAM_KEYS.query, filters.searchQuery.trim());
  }
  if (isIsoDateString(filters.checkInDate)) {
    params.set(URL_PARAM_KEYS.checkIn, filters.checkInDate);
  }
  if (isIsoDateString(filters.checkOutDate)) {
    params.set(URL_PARAM_KEYS.checkOut, filters.checkOutDate);
  }
  if (filters.priceRange[0] !== defaults.priceRange[0]) {
    params.set(URL_PARAM_KEYS.minPrice, String(filters.priceRange[0]));
  }
  if (filters.priceRange[1] !== defaults.priceRange[1]) {
    params.set(URL_PARAM_KEYS.maxPrice, String(filters.priceRange[1]));
  }
  if (filters.propertyTypes.length > 0) {
    params.set(URL_PARAM_KEYS.types, filters.propertyTypes.join(","));
  }
  if (filters.amenities.length > 0) {
    params.set(URL_PARAM_KEYS.amenities, filters.amenities.join(","));
  }
  if (filters.minBeds > 0) {
    params.set(URL_PARAM_KEYS.beds, String(filters.minBeds));
  }
  if (filters.minBedrooms > 0) {
    params.set(URL_PARAM_KEYS.bedrooms, String(filters.minBedrooms));
  }
  if (filters.minBathrooms > 0) {
    params.set(URL_PARAM_KEYS.bathrooms, String(filters.minBathrooms));
  }
  if (filters.minRating > 0) {
    params.set(URL_PARAM_KEYS.rating, String(filters.minRating));
  }
  if (filters.instantBookOnly) params.set(URL_PARAM_KEYS.instant, "1");
  if (filters.superhostOnly) params.set(URL_PARAM_KEYS.superhost, "1");
  if (filters.sortBy !== defaults.sortBy) {
    params.set(URL_PARAM_KEYS.sort, filters.sortBy);
  }
  if (filters.bounds) {
    params.set(URL_PARAM_KEYS.north, filters.bounds.north.toFixed(4));
    params.set(URL_PARAM_KEYS.south, filters.bounds.south.toFixed(4));
    params.set(URL_PARAM_KEYS.east, filters.bounds.east.toFixed(4));
    params.set(URL_PARAM_KEYS.west, filters.bounds.west.toFixed(4));
  }

  const queryString = params.toString();
  const nextUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ""}${window.location.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, "", nextUrl);
  }
}

/** Restores persisted price/type/amenity preferences, if present. */
function readStoredPreferences(): Partial<FilterState> {
  const record = readStorageRecord(STORAGE_KEYS.FILTER_PREFERENCES);
  if (!record) return {};

  const patch: Partial<FilterState> = {};

  const priceRange = record.priceRange;
  if (Array.isArray(priceRange) && priceRange.length === 2) {
    patch.priceRange = [
      clamp(
        toFiniteNumber(priceRange[0], VALIDATION_LIMITS.MIN_PRICE),
        VALIDATION_LIMITS.MIN_PRICE,
        VALIDATION_LIMITS.MAX_PRICE,
      ),
      clamp(
        toFiniteNumber(priceRange[1], VALIDATION_LIMITS.MAX_PRICE),
        VALIDATION_LIMITS.MIN_PRICE,
        VALIDATION_LIMITS.MAX_PRICE,
      ),
    ];
  }

  if (Array.isArray(record.propertyTypes)) {
    const types = record.propertyTypes.filter(isPropertyType);
    if (types.length > 0) patch.propertyTypes = types;
  }

  if (Array.isArray(record.amenities)) {
    const amenities = record.amenities.filter(isAmenity);
    if (amenities.length > 0) patch.amenities = amenities;
  }

  return patch;
}

function persistPreferences(preferences: StoredFilterPreferences): void {
  writeStorageJson(STORAGE_KEYS.FILTER_PREFERENCES, preferences);
}

export type FilterSectionKey =
  | "price"
  | "dates"
  | "rooms"
  | "type"
  | "amenities"
  | "booking"
  | "location";

export interface UseListingFiltersOptions {
  /** Values layered over defaults, preferences, and the URL (in that order). */
  initialFilters?: Partial<FilterState>;
  /** Persists the filter state into the URL query string. Defaults to `true`. */
  syncToUrl?: boolean;
  /** Debounce window for the filtering projection. Defaults to the app config. */
  debounceMs?: number;
}

export interface UseListingFiltersResult {
  /** Immediate state — bind directly to controls. */
  filters: FilterState;
  /** Debounced state — use for filtering and histogram aggregation. */
  effectiveFilters: FilterState;
  /** True while the debounced projection is catching up. */
  isDebouncing: boolean;
  activeFilterCount: number;
  hasActiveFilters: boolean;
  updateFilters: (patch: Partial<FilterState>) => void;
  setSearchQuery: (query: string) => void;
  setPriceRange: (range: [number, number]) => void;
  setStayWindow: (
    checkInDate: string | null,
    checkOutDate: string | null,
  ) => void;
  setBounds: (bounds: GeoBounds | null) => void;
  togglePropertyType: (
    propertyType: FilterState["propertyTypes"][number],
  ) => void;
  setPropertyTypes: (propertyTypes: FilterState["propertyTypes"]) => void;
  toggleAmenity: (amenity: FilterState["amenities"][number]) => void;
  setAmenities: (amenities: FilterState["amenities"]) => void;
  setCapacity: (
    patch: Partial<Pick<FilterState, "minBeds" | "minBedrooms" | "minBathrooms">>,
  ) => void;
  setMinRating: (rating: number) => void;
  setInstantBookOnly: (value: boolean) => void;
  setSuperhostOnly: (value: boolean) => void;
  setSortBy: (sortBy: FilterState["sortBy"]) => void;
  /** Clears every criterion, keeping the current sort order. */
  resetFilters: () => void;
  /** Clears only the criteria owned by one filter section. */
  resetSection: (section: FilterSectionKey) => void;
}

function createInitialState(options: UseListingFiltersOptions): FilterState {
  const fromUrl = options.syncToUrl === false ? {} : readFiltersFromUrl();
  const fromStorage = readStoredPreferences();

  return sanitizeFilterState({
    ...fromStorage,
    ...fromUrl,
    ...options.initialFilters,
  });
}

export function useListingFilters(
  options: UseListingFiltersOptions = {},
): UseListingFiltersResult {
  const syncToUrl = options.syncToUrl ?? APP_CONFIG.features.urlStateSync;
  const debounceMs = options.debounceMs ?? APP_CONFIG.searchDebounceMs;

  const [filters, setFilters] = useState<FilterState>(() =>
    createInitialState({ ...options, syncToUrl }),
  );

  const effectiveFilters = useDebouncedValue(filters, debounceMs);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  // URL persistence runs on the debounced projection so typing does not rewrite
  // history on every keystroke.
  useEffect(() => {
    if (!syncToUrl) return;
    writeFiltersToUrl(effectiveFilters);
  }, [effectiveFilters, syncToUrl]);

  // Preferences cover only the fields they own; other criteria are session state.
  const preferences = useMemo<StoredFilterPreferences>(
    () => ({
      priceRange: effectiveFilters.priceRange,
      propertyTypes: effectiveFilters.propertyTypes,
      amenities: effectiveFilters.amenities,
    }),
    [
      effectiveFilters.amenities,
      effectiveFilters.priceRange,
      effectiveFilters.propertyTypes,
    ],
  );

  useEffect(() => {
    persistPreferences(preferences);
  }, [preferences]);

  const updateFilters = useCallback((patch: Partial<FilterState>) => {
    setFilters((previous) => sanitizeFilterState({ ...previous, ...patch }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setFilters((previous) =>
      sanitizeFilterState({ ...previous, searchQuery: query }),
    );
  }, []);

  const setPriceRange = useCallback((range: [number, number]) => {
    setFilters((previous) =>
      sanitizeFilterState({ ...previous, priceRange: range }),
    );
  }, []);

  const setStayWindow = useCallback(
    (checkInDate: string | null, checkOutDate: string | null) => {
      const stayWindow = normalizeStayWindow(checkInDate, checkOutDate);
      setFilters((previous) => sanitizeFilterState({ ...previous, ...stayWindow }));
    },
    [],
  );

  const setBounds = useCallback((bounds: GeoBounds | null) => {
    setFilters((previous) => sanitizeFilterState({ ...previous, bounds }));
  }, []);

  const togglePropertyType = useCallback(
    (propertyType: FilterState["propertyTypes"][number]) => {
      setFilters((previous) => {
        const has = previous.propertyTypes.includes(propertyType);
        const next = has
          ? previous.propertyTypes.filter((item) => item !== propertyType)
          : [...previous.propertyTypes, propertyType];
        return sanitizeFilterState({ ...previous, propertyTypes: next });
      });
    },
    [],
  );

  const setPropertyTypes = useCallback(
    (propertyTypes: FilterState["propertyTypes"]) => {
      setFilters((previous) =>
        sanitizeFilterState({
          ...previous,
          propertyTypes: propertyTypes.filter(isPropertyType),
        }),
      );
    },
    [],
  );

  const toggleAmenity = useCallback(
    (amenity: FilterState["amenities"][number]) => {
      setFilters((previous) => {
        const has = previous.amenities.includes(amenity);
        const next = has
          ? previous.amenities.filter((item) => item !== amenity)
          : [...previous.amenities, amenity];
        return sanitizeFilterState({ ...previous, amenities: next });
      });
    },
    [],
  );

  const setAmenities = useCallback((amenities: FilterState["amenities"]) => {
    setFilters((previous) =>
      sanitizeFilterState({ ...previous, amenities: amenities.filter(isAmenity) }),
    );
  }, []);

  const setCapacity = useCallback(
    (
      patch: Partial<
        Pick<FilterState, "minBeds" | "minBedrooms" | "minBathrooms">
      >,
    ) => {
      setFilters((previous) => sanitizeFilterState({ ...previous, ...patch }));
    },
    [],
  );

  const setMinRating = useCallback((rating: number) => {
    setFilters((previous) =>
      sanitizeFilterState({ ...previous, minRating: rating }),
    );
  }, []);

  const setInstantBookOnly = useCallback((value: boolean) => {
    setFilters((previous) =>
      sanitizeFilterState({ ...previous, instantBookOnly: value }),
    );
  }, []);

  const setSuperhostOnly = useCallback((value: boolean) => {
    setFilters((previous) =>
      sanitizeFilterState({ ...previous, superhostOnly: value }),
    );
  }, []);

  const setSortBy = useCallback((sortBy: FilterState["sortBy"]) => {
    setFilters((previous) => sanitizeFilterState({ ...previous, sortBy }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters((previous) => {
      const defaults = createDefaultFilterState();
      return sanitizeFilterState({ ...defaults, sortBy: previous.sortBy });
    });
  }, []);

  const resetSection = useCallback((section: FilterSectionKey) => {
    setFilters((previous) => {
      switch (section) {
        case "price":
          return sanitizeFilterState({
            ...previous,
            priceRange: [
              VALIDATION_LIMITS.MIN_PRICE,
              VALIDATION_LIMITS.MAX_PRICE,
            ],
          });
        case "dates":
          return sanitizeFilterState({
            ...previous,
            checkInDate: null,
            checkOutDate: null,
          });
        case "rooms":
          return sanitizeFilterState({
            ...previous,
            minBeds: 0,
            minBedrooms: 0,
            minBathrooms: 0,
          });
        case "type":
          return sanitizeFilterState({ ...previous, propertyTypes: [] });
        case "amenities":
          return sanitizeFilterState({ ...previous, amenities: [] });
        case "booking":
          return sanitizeFilterState({
            ...previous,
            instantBookOnly: false,
            superhostOnly: false,
            minRating: 0,
          });
        case "location":
          return sanitizeFilterState({
            ...previous,
            searchQuery: "",
            bounds: null,
          });
        default:
          return previous;
      }
    });
  }, []);

  return {
    filters,
    effectiveFilters,
    isDebouncing: filters !== effectiveFilters,
    activeFilterCount,
    hasActiveFilters: activeFilterCount > 0,
    updateFilters,
    setSearchQuery,
    setPriceRange,
    setStayWindow,
    setBounds,
    togglePropertyType,
    setPropertyTypes,
    toggleAmenity,
    setAmenities,
    setCapacity,
    setMinRating,
    setInstantBookOnly,
    setSuperhostOnly,
    setSortBy,
    resetFilters,
    resetSection,
  };
}

/** Option tuples re-exported so filter UIs do not import from `types` directly. */
export { AMENITIES, PROPERTY_TYPES };

export default useListingFilters;
