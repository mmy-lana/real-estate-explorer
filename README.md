# Real Estate Explorer (StayExplorer)

An Airbnb-grade listing discovery and property exploration interface engineered with React, TypeScript, and Tailwind CSS. Built to demonstrate high-performance client-side state filtering, accessibility compliance, and a zero-dependency geographic projection engine.

Live Demo: https://real-estate-explorer-two.vercel.app

---

## Technical Highlights

- Mathematical Projection Map: Plots geographic coordinates onto container viewports using pure bounding-box math. Zero external map dependencies, zero API rate limits, and instant first paint.
- Multidimensional Filter Engine: Sub-millisecond evaluation across price distributions, room/bed allocations, 18 domain amenities, property types, and calendar blackout date ranges.
- Dual-Thumb Range Slider & Dynamic Histogram: Continuous custom pointer-event slider synchronized with responsive dataset price distribution buckets (12 buckets on mobile, 28 on desktop).
- Reactive Cross-Tab Persistence: Local storage hydration paired with a validated `BroadcastChannel` pipeline that updates saved wishlists across browser tabs without race conditions.
- Strict Touch & Gesture Architecture: 100% hover-independent workflows with uniform 44x44px touch targets, non-passive wheel event isolation, and gesture-driven mobile sheets.

---

## Architectural Deep Dive: The Standalone Projection Map

### Why the Map Uses a Custom Engine

Commercial maps (Google Maps, Mapbox GL) add substantial bundle overhead, require paid API keys, and enforce third-party telemetry. 

This application implements `CoordinateProjectionEngine`, an in-memory Mercator bounding-box projector:

1. Coordinate Transformation: Converts GPS coordinates `(latitude, longitude)` into normalized container space `[0, 1]` and discrete pixel anchors `(x, y)` relative to active viewport bounds.
2. Dynamic Clustering: Automatically groups nearby markers within a 44px radius at lower zoom levels, displaying cluster counts and mean prices.
3. Bidirectional Sync: Panning and zooming emit settled geographic boundaries (`north, south, east, west`) back into the filter pipeline to narrow the listing grid in real time.

### Integrating External Tile Providers

The projection engine is tile-agnostic. To render real-world satellite imagery, streets, or terrain behind the markers:

1. Add a raster tile layer inside `InteractiveMap.tsx` using standard slippy map math:
   ```typescript
   // Slippy map tile calculation:
   // tileX = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom))
   // tileY = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom))
   ```
2. Connect to free raster endpoints (e.g., CartoDB Positron or OpenStreetMap):
   ```
   https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png
   ```
3. Or swap the map viewport container for Leaflet / Mapbox GL while preserving the existing `useMapSync` hook.

---

## Core Modules & Data Pipeline

```
src/
├── components/
│   ├── molecules/         # Image carousel, price histogram, map markers, rating summary
│   ├── organisms/         # Interactive map, compound filter modal, detail sheet, navigation
│   ├── primitives/        # Accessible dual slider, focus-trapped modal, bottom sheet, stepper
│   └── templates/         # Desktop split-view shell, responsive grid container
├── hooks/
│   ├── useFavorites.ts    # Wishlist storage with cross-document synchronization
│   ├── useFocusTrap.ts    # Accessible focus containment and ref-counted scroll locking
│   ├── useLocalStorage.ts # Safe storage reader/writer with BroadcastChannel validation
│   └── useMapSync.ts      # Bidirectional hover and selection synchronization
├── lib/
│   ├── coordinate-projection.ts # Mathematical Mercator engine and viewport calculations
│   ├── filter-engine.ts         # Multi-predicate filtering and date-overlap logic
│   ├── histogram-calculator.ts  # Bucket quantization and bar height normalization
│   └── pricing.ts               # Subtotal, service fee, and stay breakdown formulas
└── types/
    └── index.ts                 # Domain models, type guards, and validation limits
```

---

## Enterprise Defensive Engineering Standards

The codebase has undergone tier-1 systems auditing and implements the following security and reliability patterns:

- Calendar Blackout Enforcement: Date reservations use the half-open interval rule (`startA < endB && endA > startB`) to prevent booking collisions on blocked calendar ranges.
- Passive Event Listener Compliance: Native wheel listeners are registered with `{ passive: false }` to cancel parent page scrolling without triggering browser console violations.
- Payload Verification: `BroadcastChannel` messages pass through runtime type guards before updating state to eliminate cross-tab prototype injection vectors.
- Antimeridian Support: Viewport boundary logic accommodates International Date Line wrap-around envelopes where `east < west`.
- Reference-Counted Scroll Locks: Prevents nested modal overlays and bottom sheets from prematurely releasing document scrolling.

---

## Getting Started

### Prerequisites

- Node.js runtime (latest stable)
- pnpm package manager (`corepack enable pnpm`)

### Installation & Development

```bash
# Clone the repository
git clone https://github.com/mmy-lana/real-estate-explorer.git
cd real-estate-explorer

# Install dependencies using pnpm
pnpm install

# Start the Vite development server
pnpm run dev
```

### Production Build

```bash
# Type check and generate production bundle
pnpm run build

# Preview the production build locally
pnpm run preview
```

---

## Tech Stack

- Framework: React (latest)
- Language: TypeScript (strict mode enabled)
- Styling: Tailwind CSS (latest CSS-first `@theme` configuration)
- Bundler: Vite (latest)
- Icons: Lucide React
- Deployment: Vercel

---

## License

MIT License. Free for personal, commercial, and educational use.
