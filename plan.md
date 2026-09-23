# Real Estate Explorer - Architecture and Implementation Plan (`plan.md`)

## 1. Data Schema & Pure TypeScript Interfaces

```typescript
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

export interface AvailabilityRange {
  startDate: string; // ISO 8601 (YYYY-MM-DD)
  endDate: string; // ISO 8601 (YYYY-MM-DD)
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
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
    neighborhood: string;
  };
  capacity: {
    maxGuests: number;
    bedrooms: number;
    beds: number;
    bathrooms: number;
  };
  amenities: Amenity[];
  blockedRanges: AvailabilityRange[]; // Standardized calendar range blocks
  minNights: number;
  isInstantBook: boolean;
  isRareFind: boolean;
  host: HostProfile;
  createdAt: string;
  updatedAt: string;
}

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
  sortBy: "price_asc" | "price_desc" | "rating_desc" | "featured";
}

// Client-only single-user collection (no remote multi-user backend required)
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
```

### Data Validation Rules & Guard Functions

```typescript
export const VALIDATION_LIMITS = {
  MIN_PRICE: 10,
  MAX_PRICE: 2000,
  MIN_CAPACITY: 1,
  MAX_CAPACITY: 16,
  MIN_COORDINATES: { lat: -90, lng: -180 },
  MAX_COORDINATES: { lat: 90, lng: 180 },
} as const;

export function isValidListing(data: unknown): data is PropertyListing {
  if (typeof data !== "object" || data === null) return false;
  const item = data as Record<string, unknown>;

  const hasValidPrimitives =
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.pricePerNight === "number" &&
    item.pricePerNight >= VALIDATION_LIMITS.MIN_PRICE &&
    item.pricePerNight <= VALIDATION_LIMITS.MAX_PRICE &&
    Array.isArray(item.images) &&
    item.images.length > 0 &&
    typeof item.coordinates === "object" &&
    item.coordinates !== null;

  if (!hasValidPrimitives) return false;

  const coords = item.coordinates as Record<string, unknown>;
  const hasValidCoords =
    typeof coords.lat === "number" &&
    typeof coords.lng === "number" &&
    coords.lat >= VALIDATION_LIMITS.MIN_COORDINATES.lat &&
    coords.lat <= VALIDATION_LIMITS.MAX_COORDINATES.lat &&
    coords.lng >= VALIDATION_LIMITS.MIN_COORDINATES.lng &&
    coords.lng <= VALIDATION_LIMITS.MAX_COORDINATES.lng;

  return hasValidCoords;
}

export function sanitizeFilterState(raw: Partial<FilterState>): FilterState {
  const minPrice = Math.max(
    VALIDATION_LIMITS.MIN_PRICE,
    raw.priceRange?.[0] ?? VALIDATION_LIMITS.MIN_PRICE,
  );
  const maxPrice = Math.min(
    VALIDATION_LIMITS.MAX_PRICE,
    raw.priceRange?.[1] ?? VALIDATION_LIMITS.MAX_PRICE,
  );

  return {
    searchQuery: (raw.searchQuery ?? "").trim().slice(0, 100),
    bounds: raw.bounds ?? null,
    priceRange: [Math.min(minPrice, maxPrice), Math.max(minPrice, maxPrice)],
    propertyTypes: Array.isArray(raw.propertyTypes) ? raw.propertyTypes : [],
    minBeds: Math.max(0, Number(raw.minBeds) || 0),
    minBedrooms: Math.max(0, Number(raw.minBedrooms) || 0),
    minBathrooms: Math.max(0, Number(raw.minBathrooms) || 0),
    amenities: Array.isArray(raw.amenities) ? raw.amenities : [],
    instantBookOnly: Boolean(raw.instantBookOnly),
    superhostOnly: Boolean(raw.superhostOnly),
    minRating: Math.max(0, Math.min(5, Number(raw.minRating) || 0)),
    sortBy: ["price_asc", "price_desc", "rating_desc", "featured"].includes(
      raw.sortBy as string,
    )
      ? (raw.sortBy as FilterState["sortBy"])
      : "featured",
  };
}
```

---

## 2. Component Architecture

```
src/
├── main.tsx                         # Pure React Client SPA entry
├── App.tsx                          # Root Explorer Shell
├── index.css                        # Tailwind latest (@theme tokens)
├── components/
│   ├── primitives/
│   │   ├── Button.tsx
│   │   ├── Badge.tsx
│   │   ├── Checkbox.tsx
│   │   ├── Counter.tsx
│   │   ├── Modal.tsx
│   │   ├── SliderDual.tsx           # Thumb-crossing clamp included
│   │   ├── Skeleton.tsx
│   │   └── Sheet.tsx                # Snap points (40%/90%) + overflow-y-auto
│   ├── molecules/
│   │   ├── AmenityPill.tsx          # 18-member exhaustive SVG map
│   │   ├── ImageCarousel.tsx        # aspect-[4/3] persistent ratio
│   │   ├── PriceHistogram.tsx       # Responsive bucket counts (12 mobile / 28 desktop)
│   │   ├── PropertyCard.tsx
│   │   ├── SearchBarCompact.tsx
│   │   ├── MapPin.tsx               # 44x44px minimum touch targets
│   │   └── RatingSummary.tsx
│   ├── organisms/
│   │   ├── FilterModal.tsx
│   │   ├── ListingGrid.tsx
│   │   ├── InteractiveMap.tsx       # Layout-measurement gate + unproject bounds
│   │   ├── MobileMapOverlay.tsx     # Clean mount/unmount wrapper for mobile map
│   │   ├── ListingDetailSheet.tsx   # Integrated BookingDraft computation
│   │   ├── MobileNavigationHeader.tsx
│   │   └── MainNavigationBar.tsx
│   └── templates/
│       ├── ExplorerLayout.tsx
│       └── SplitExplorerView.tsx
├── hooks/
│   ├── useListingsQuery.ts
│   ├── useListingFilters.ts
│   ├── useFavorites.ts
│   ├── useMapSync.ts
│   ├── useLocalStorage.ts
│   └── useMediaQuery.ts
├── lib/
│   ├── coordinate-projection.ts
│   ├── filter-engine.ts
│   ├── histogram-calculator.ts
│   └── seed-data.ts
└── types/
    └── index.ts
```

### Component Breakdown & Contracts

1. **Primitives:**
   - `Button`: Variant styles (`primary`, `outline`, `ghost`, `circle`), loading spinner, accessibility attributes (`aria-pressed`, `aria-label`).
   - `SliderDual`: Accessible dual-thumb continuous range slider with raw pointer down/move/up event handling and keyboard navigation (`ArrowLeft`, `ArrowRight`, `Home`, `End`).
   - `Sheet`: Accessible drawer bottom sheet for mobile (swipable, translates on Y-axis, backdrop blur).
   - `Modal`: Focus-trapped dialog modal with backdrop blur, `aria-modal="true"`, esc key dismissal.
   - `Counter`: Increment/decrement stepper component with min/max caps.

2. **Molecules:**
   - `PropertyCard`: Airbnb-style listing card with persistent image slider, favorite button, price per night with tax calculation, rating badge, and active state binding.
   - `PriceHistogram`: SVG/CSS-bar distribution visualization matching the active price range selection.
   - `ImageCarousel`: Mobile-touch swipable, desktop arrow-navigable multi-image gallery with dot indicators.
   - `MapPin`: Coordinate-projected interactive marker supporting `price-pill` mode, hover lift, and active-selection highlight.

3. **Organisms:**
   - `InteractiveMap`: High-performance canvas/SVG projection map supporting zoom, pan, hover pin synchronizations, and boundary-change emission. Must not render `MapPin` markers until `projectionEngine.isReady()` evaluates to true; renders `MapSkeleton` placeholder during initial layout measurement.
   - `FilterModal`: Complex compound dialog housing price histogram sliders, property type grid selectors, bed/bath counters, and amenity toggles.
   - `ListingDetailSheet`: Deep inspection overlay with full spec breakdown, host profile, amenity breakdown, and reservation price matrix.

---

## 3. Core Feature Logic

### 3.1 In-Memory Multidimensional Filter Engine

```typescript
import { PropertyListing, FilterState } from "../types";

export function isListingAvailable(
  listing: PropertyListing,
  checkInDate: string | null,
  checkOutDate: string | null,
): boolean {
  if (!checkInDate || !checkOutDate) return true;

  const targetStart = new Date(checkInDate).getTime();
  const targetEnd = new Date(checkOutDate).getTime();

  if (isNaN(targetStart) || isNaN(targetEnd) || targetStart >= targetEnd)
    return false;

  const nightCount = Math.round(
    (targetEnd - targetStart) / (1000 * 60 * 60 * 24),
  );
  if (nightCount < listing.minNights) return false;

  // Check collision with any blocked range: Overlap exists if StartA < EndB and EndA > StartB
  return !listing.blockedRanges.some((range) => {
    const blockedStart = new Date(range.startDate).getTime();
    const blockedEnd = new Date(range.endDate).getTime();
    return targetStart < blockedEnd && targetEnd > blockedStart;
  });
}

export function matchesListingFilters(
  listing: PropertyListing,
  filters: FilterState,
): boolean {
  if (filters.searchQuery) {
    const q = filters.searchQuery.toLowerCase();
    const matchesTitle = listing.title.toLowerCase().includes(q);
    const matchesCity = listing.address.city.toLowerCase().includes(q);
    const matchesNeighborhood = listing.address.neighborhood
      .toLowerCase()
      .includes(q);
    const matchesType = listing.propertyType.toLowerCase().includes(q);

    if (!matchesTitle && !matchesCity && !matchesNeighborhood && !matchesType) {
      return false;
    }
  }

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

  if (filters.amenities.length > 0) {
    const hasAllAmenities = filters.amenities.every((requiredAmenity) =>
      listing.amenities.includes(requiredAmenity),
    );
    if (!hasAllAmenities) return false;
  }

  if (filters.instantBookOnly && !listing.isInstantBook) return false;
  if (filters.superhostOnly && !listing.host.isSuperhost) return false;
  if (listing.ratingAverage < filters.minRating) return false;

  if (filters.bounds) {
    const { lat, lng } = listing.coordinates;
    const { north, south, east, west } = filters.bounds;
    const withinLat = lat <= north && lat >= south;
    const withinLng =
      east >= west ? lng >= west && lng <= east : lng >= west || lng <= east; // International Date Line wrap-around handling
    if (!withinLat || !withinLng) return false;
  }

  return true;
}

export function sortListings(
  listings: PropertyListing[],
  sortBy: FilterState["sortBy"],
): PropertyListing[] {
  const cloned = [...listings];
  switch (sortBy) {
    case "price_asc":
      return cloned.sort((a, b) => a.pricePerNight - b.pricePerNight);
    case "price_desc":
      return cloned.sort((a, b) => b.pricePerNight - a.pricePerNight);
    case "rating_desc":
      return cloned.sort((a, b) => b.ratingAverage - a.ratingAverage);
    case "featured":
    default:
      return cloned.sort((a, b) => {
        const aScore = a.ratingAverage * 10 + (a.host.isSuperhost ? 5 : 0);
        const bScore = b.ratingAverage * 10 + (b.host.isSuperhost ? 5 : 0);
        return bScore - aScore;
      });
  }
}
```

### 3.2 Price Histogram Generation Algorithm

```typescript
import { PropertyListing, PriceDistributionBucket } from "../types";

export function computePriceBuckets(
  listings: PropertyListing[],
  isMobile: boolean = false,
  minBound: number = 10,
  maxBound: number = 2000,
): PriceDistributionBucket[] {
  // Mobile renders 12 wider bars to prevent sub-pixel illegibility; Desktop renders 28 bars
  const bucketCount = isMobile ? 12 : 28;
  const step = (maxBound - minBound) / bucketCount;
  const buckets: PriceDistributionBucket[] = Array.from(
    { length: bucketCount },
    (_, idx) => {
      const start = Math.round(minBound + idx * step);
      const end = Math.round(start + step);
      return { rangeStart: start, rangeEnd: end, count: 0 };
    },
  );

  for (let i = 0; i < listings.length; i++) {
    const price = listings[i].pricePerNight;
    if (price < minBound || price > maxBound) continue;

    const bucketIndex = Math.min(
      Math.floor((price - minBound) / step),
      bucketCount - 1,
    );
    if (bucketIndex >= 0) {
      buckets[bucketIndex].count += 1;
    }
  }

  return buckets;
}
```

### 3.3 Mercator Bounding-Box Coordinate Projection Engine

Pure mathematical projection converting GPS coordinates `(lat, lng)` into normalized container space `[0, 1]` or pixel offsets `(x, y)` without external map engine runtime dependencies.

```typescript
import { Coordinates, GeoBounds } from "../types";

export const WORLD_FALLBACK_BOUNDS: GeoBounds = {
  north: 85.0511,
  south: -85.0511,
  east: 180,
  west: -180,
};

export class CoordinateProjectionEngine {
  private bounds: GeoBounds;
  private width: number;
  private height: number;

  constructor(bounds: GeoBounds | null, width: number, height: number) {
    this.bounds = bounds ?? WORLD_FALLBACK_BOUNDS;
    this.width = Math.max(0, width);
    this.height = Math.max(0, height);
  }

  public isReady(): boolean {
    return this.width > 0 && this.height > 0;
  }

  public project(coords: Coordinates): {
    x: number;
    y: number;
    isVisible: boolean;
  } {
    if (!this.isReady()) {
      return { x: 0, y: 0, isVisible: false };
    }
    const { north, south, east, west } = this.bounds;
    const latSpan = north - south;
    const lngSpan = east >= west ? east - west : 360 - (west - east);

    if (latSpan <= 0 || lngSpan <= 0) {
      return { x: -100, y: -100, isVisible: false };
    }

    const normY = (north - coords.lat) / latSpan;
    let normX: number;

    if (east >= west) {
      normX = (coords.lng - west) / lngSpan;
    } else {
      normX =
        coords.lng >= west
          ? (coords.lng - west) / lngSpan
          : (coords.lng + 360 - west) / lngSpan;
    }

    const isVisible = normX >= 0 && normX <= 1 && normY >= 0 && normY <= 1;

    return {
      x: Math.round(normX * this.width),
      y: Math.round(normY * this.height),
      isVisible,
    };
  }

  public unproject(x: number, y: number): Coordinates {
    const normX = Math.max(0, Math.min(1, x / this.width));
    const normY = Math.max(0, Math.min(1, y / this.height));

    const { north, south, east, west } = this.bounds;
    const latSpan = north - south;
    const lngSpan = east >= west ? east - west : 360 - (west - east);

    const lat = north - normY * latSpan;
    let lng: number;

    if (east >= west) {
      lng = west + normX * lngSpan;
    } else {
      lng = west + normX * lngSpan;
      if (lng > 180) lng -= 360;
    }

    return { lat, lng };
  }
}
```

### 3.4 Mobile-First Responsive Breakpoint Matrix

| Target Screen Width | Target Device                        | Layout Paradigm                                                                                   | Interaction Constraints                                                                                                                                                              |
| :------------------ | :----------------------------------- | :------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **360px**           | Small Android (e.g. Galaxy A-series) | Single column vertical grid (1 card/row). Bottom navigation bar. Compact search trigger header.   | Touch targets min 44x44px across all controls (`Counter`, `AmenityPill`, `MapPin`). Bottom sheet snap (40%/90%) with mandatory `overflow-y-auto`. Carousel locked to `aspect-[4/3]`. |
| **390px**           | Standard iPhone (12, 13, 14, 15)     | Single column with 16px margins. Carousel swipe with thumb dots. Floating Map Toggle pill button. | Touch targets min 44x44px. Bottom sheet snap (40%/90%) with `overflow-y-auto`. Carousel locked to `aspect-[4/3]`.                                                                    |
| **430px**           | Large Mobile (iPhone Pro Max, Plus)  | Single column with 20px padding. Floating Map Toggle pill button.                                 | Touch targets min 44x44px. Bottom sheet snap (40%/90%) with `overflow-y-auto`. Carousel locked to `aspect-[4/3]`.                                                                    |
| **768px**           | Tablet Portrait (iPad Mini/Air)      | 2 column listing grid. Top search navigation bar with secondary filter chips.                     | Map toggle remains accessible as split view switch. Minimum 44x44px touch targets retained.                                                                                          |
| **1024px+**         | Desktop Large & Ultrawide            | Split-view viewports: 60% scrollable listing grid (3 columns) + 40% sticky coordinate map view.   | Pointer sync active. Dual-thumb price slider with live 28-bucket histogram.                                                                                                          |

---

## 4. Five-Phase Sequential Queue

### Phase 1: Types, Storage/API Client Config, and Base Utilities

1. Configure canonical dependency manifest in `package.json` using latest tags exclusively:
   ```json
   {
     "dependencies": {
       "react": "latest",
       "react-dom": "latest",
       "lucide-react": "latest"
     },
     "devDependencies": {
       "@types/react": "latest",
       "@types/react-dom": "latest",
       "@vitejs/plugin-react": "latest",
       "tailwindcss": "latest",
       "@tailwindcss/vite": "latest",
       "typescript": "latest",
       "vite": "latest"
     }
   }
   ```
2. Build seed data generator (`src/lib/seed-data.ts`) producing 60+ realistic, high-fidelity real estate records with high-res property assets, coordinates, reviews, and host metadata.
3. Implement numerical clamp, currency formatters, date string normalizers, and geo-distance calculations in `src/lib/utils.ts`.

### Phase 2: Design Foundation & Atomic UI Primitives

1. Configure Tailwind token extensions: Airbnb brand palette (`#FF385C` primary, neutral spectrum, radius presets `rounded-2xl`, `rounded-3xl`, soft shadows).
2. Build base primitives:
   - `Button.tsx`: Ripple-free, accessible tap highlights, outline/solid/ghost states.
   - `SliderDual.tsx`: Pure dual-range pointer-event slider without HTML input collision bugs.
   - `Modal.tsx`: Accessible portal container with scroll-locking and inert attributes.
   - `Sheet.tsx`: Mobile gesture-capable bottom sheet with smooth spring-like CSS transitions.
   - `Counter.tsx`: Airbnb-style guest/room numeric stepper with min/max disable states.
   - `Badge.tsx`: Clean tag indicator for Superhost, Rare Find, and ratings.

### Phase 3: Compound Molecules & Feature Components

1. Construct `ImageCarousel.tsx` supporting pointer drag/touch swipe, transition animations, pre-loading next images, and favorite toggle overlays.
2. Construct `PriceHistogram.tsx` dynamically mapping dataset price distribution against dual-slider thumb positions.
3. Build `PropertyCard.tsx` combining carousel, pricing calculation, instant-booking indicators, and active map synchronization callbacks.
4. Build `SearchBarCompact.tsx` presenting interactive pills: "Where", "Price", "Property Type", and "Filters".
5. Build `AmenityPill.tsx` with unified SVG icon mapping for all 18 standard amenities.

### Phase 4: Domain Logic, Reactive State, and Specialized APIs

1. Implement `CoordinateProjectionEngine` in `src/lib/coordinate-projection.ts` to transform real-world coordinates into responsive canvas coordinates.
2. Build `InteractiveMap.tsx` utilizing the projection engine:
   - Pin clustering and responsive Pin markers showing listing price labels.
   - Viewport boundary calculation on drag/zoom that feeds back into active bounds filters.
   - Bidirectional listing selection: hover or select card highlights pin; clicking pin focuses listing card.
3. Implement `useListingsQuery.ts` and `useListingFilters.ts` handling debounced state updates, URL query search param persistence, and active criteria counts.
4. Implement `useFavorites.ts` providing instant reactive persistence into browser storage with heart animations.

### Phase 5: Complete Page/Screen Assembly & Responsive Shell

1. Build `ListingDetailSheet.tsx` rendering comprehensive property specifications, full image gallery grid, reviews breakdown bars, host credentials, and reservation calculation breakdown.
2. Build `FilterModal.tsx` consolidating price histogram range, property-type icon toggles, room steppers, and amenity grids with a reset-all and apply-filter action bar.
3. Construct `SplitExplorerView.tsx` coordinating the responsive layout:
   - Mobile: Grid view with bottom navigation bar and floating "Show Map" floating pill button.
   - Desktop: Sticky header with auto-collapsing search bar + Split-screen listing collection and sticky projection map.
4. Implement empty states ("No listings match your criteria" with clear-filters trigger) and loading skeletons matching card geometry.
5. Finalize responsive testing across 360px, 390px, 430px, 768px, and 1440px breakpoints.

---

## 5. Storage Schema & Client-Side Persistence Layer

```typescript
// LocalStorage key definitions
export const STORAGE_KEYS = {
  FAVORITES: "realestate_explorer_favorites_v1",
  FILTER_PREFERENCES: "realestate_explorer_filter_prefs_v1",
  RECENT_SEARCHES: "realestate_explorer_recent_searches_v1",
} as const;

export interface StoredFilterPreferences {
  priceRange: [number, number];
  propertyTypes: PropertyType[];
  amenities: Amenity[];
}

export interface StoredSearchHistory {
  query: string;
  timestamp: number;
}
```

```typescript
// src/hooks/useLocalStorage.ts
import { useState, useEffect, useCallback, useRef } from "react";

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((val: T) => T)) => void] {
  const channelRef = useRef<BroadcastChannel | null>(null);

  const readValue = useCallback((): T => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  }, [key, initialValue]);

  const [storedValue, setStoredValue] = useState<T>(readValue);

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      if (typeof window === "undefined") return;
      try {
        setStoredValue((prev) => {
          const next = value instanceof Function ? value(prev) : value;
          window.localStorage.setItem(key, JSON.stringify(next));
          channelRef.current?.postMessage({ key, payload: next });
          return next;
        });
      } catch (err) {
        console.error(`Error setting localStorage key "${key}":`, err);
      }
    },
    [key],
  );

  useEffect(() => {
    setStoredValue(readValue());
    let channel: BroadcastChannel | null = null;

    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        channel = new BroadcastChannel(`storage_sync_${key}`);
        channelRef.current = channel;
        channel.onmessage = (
          event: MessageEvent<{ key: string; payload: T }>,
        ) => {
          if (event.data?.key === key) {
            setStoredValue(event.data.payload);
          }
        };
      } catch {
        channelRef.current = null;
      }
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== null) {
        try {
          setStoredValue(JSON.parse(event.newValue) as T);
        } catch {
          setStoredValue(readValue());
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      if (channel) {
        channel.close();
        channelRef.current = null;
      }
      window.removeEventListener("storage", handleStorage);
    };
  }, [key, readValue]);

  return [storedValue, setValue];
}
```

---

## 6. Complete Seed Fixture Architecture (Sample Blueprint)

```typescript
// src/lib/seed-data.ts
import { PropertyListing } from "../types";

export const INITIAL_LISTINGS: PropertyListing[] = [
  {
    id: "prop-001",
    title: "Architectural Hilltop Sanctuary with Panoramic Ocean Views",
    slug: "architectural-hilltop-sanctuary",
    description:
      "Designed by renowned modernist architects, this glass pavilion sits atop the Pacific Palisades offering 270-degree ocean and mountain horizons.",
    propertyType: "villa",
    pricePerNight: 850,
    cleaningFee: 220,
    serviceFeePercent: 0.14,
    currency: "USD",
    ratingAverage: 4.98,
    ratingCount: 142,
    reviewBreakdown: {
      cleanliness: 5.0,
      accuracy: 4.9,
      communication: 5.0,
      location: 5.0,
      checkIn: 5.0,
      value: 4.8,
    },
    images: [
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80",
    ],
    coordinates: {
      lat: 34.0489,
      lng: -118.5283,
    },
    address: {
      street: "14920 Corona Del Mar",
      city: "Pacific Palisades",
      state: "CA",
      country: "United States",
      zipCode: "90272",
      neighborhood: "Pacific Palisades",
    },
    capacity: {
      maxGuests: 8,
      bedrooms: 4,
      beds: 5,
      bathrooms: 4.5,
    },
    amenities: [
      "wifi",
      "kitchen",
      "washer",
      "dryer",
      "air_conditioning",
      "pool",
      "hot_tub",
      "free_parking",
      "ev_charger",
      "workspace",
      "bbq_grill",
    ],
    isInstantBook: true,
    isRareFind: true,
    host: {
      id: "host-101",
      name: "Elena Rostova",
      avatarUrl:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
      isSuperhost: true,
      joinedDate: "March 2018",
      responseRatePercent: 100,
      responseTimeMinutes: 15,
    },
    createdAt: "2024-01-15T08:00:00.000Z",
    updatedAt: "2024-06-01T12:00:00.000Z",
  },
  {
    id: "prop-002",
    title: "Minimalist Downtown Loft in Historic District",
    slug: "minimalist-downtown-loft",
    description:
      "Double-height concrete ceilings, exposed original brickwork, and curated mid-century furnishings in the heart of the Arts District.",
    propertyType: "loft",
    pricePerNight: 245,
    cleaningFee: 95,
    serviceFeePercent: 0.14,
    currency: "USD",
    ratingAverage: 4.92,
    ratingCount: 88,
    reviewBreakdown: {
      cleanliness: 4.9,
      accuracy: 5.0,
      communication: 4.9,
      location: 4.8,
      checkIn: 5.0,
      value: 4.9,
    },
    images: [
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1536376072261-38c75010e6c9?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=80",
    ],
    coordinates: {
      lat: 34.0407,
      lng: -118.2337,
    },
    address: {
      street: "580 Mateo St Unit 402",
      city: "Los Angeles",
      state: "CA",
      country: "United States",
      zipCode: "90013",
      neighborhood: "Arts District",
    },
    capacity: {
      maxGuests: 2,
      bedrooms: 1,
      beds: 1,
      bathrooms: 1.0,
    },
    amenities: [
      "wifi",
      "kitchen",
      "washer",
      "air_conditioning",
      "workspace",
      "gym",
      "pets_allowed",
    ],
    isInstantBook: false,
    isRareFind: false,
    host: {
      id: "host-102",
      name: "Marcus Chen",
      avatarUrl:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
      isSuperhost: true,
      joinedDate: "September 2019",
      responseRatePercent: 98,
      responseTimeMinutes: 30,
    },
    createdAt: "2024-02-10T10:15:00.000Z",
    updatedAt: "2024-05-20T14:40:00.000Z",
  },
];
```

---

## 7. Performance & Quality Guarantees

- **Zero Hover Dependency:** Every action trigger (image carousels, heart bookmark toggles, map markers, detail sheet modals) is fully accessible via direct touch events (`onClick`, `onTouchStart`) and keyboard controls (`Tab`, `Space`, `Enter`).
- **Sub-16ms Animation Budgets:** Map viewport transforms and bottom sheet transitions rely strictly on CSS `transform: translate3d()` and `opacity` properties to prevent layout recalculations.
- **Debounced State Engine:** Search text queries and price range slider movements use an internal 250ms debounce window before filtering listings, maintaining 60 FPS slider manipulation without frame stutter.
- **Accessible Contrast Matrix:** All text layers satisfy WCAG AAA standards for large copy and AA standards for regular copy against background elements (`#222222` on `#FFFFFF`, `#717171` for secondary labels).
