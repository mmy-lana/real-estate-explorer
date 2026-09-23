/**
 * Client runtime configuration.
 *
 * The explorer is a fully client-side application (listings live in an
 * in-memory repository seeded from `src/lib/seed-data.ts`), so there is no
 * remote HTTP client to configure. This module is therefore the single
 * "client config" surface: environment parsing, currency/locale defaults,
 * pricing model, interaction budgets, responsive breakpoints, and map tuning.
 *
 * Every value has a hard-coded production default, so the app boots correctly
 * with no `.env` file present. Malformed values are ignored in favour of the
 * default rather than surfacing `NaN` deep in the render tree.
 */

import type { GeoBounds } from "../types";
import { DEFAULT_FAVORITE_FOLDER } from "../types";

/** Raw, untyped environment bag. Keeps `import.meta.env` access in one place. */
const RAW_ENV: Record<string, unknown> = (() => {
  try {
    return (import.meta.env ?? {}) as Record<string, unknown>;
  } catch {
    return {};
  }
})();

function readString(key: string, fallback: string): string {
  const raw = RAW_ENV[key];
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function readNumber(
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = RAW_ENV[key];
  const parsed =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseFloat(raw)
        : Number.NaN;

  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function readBoolean(key: string, fallback: boolean): boolean {
  const raw = RAW_ENV[key];
  if (typeof raw === "boolean") return raw;
  if (typeof raw !== "string") return fallback;
  const normalized = raw.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

export interface BreakpointConfig {
  /** Small Android phones (Galaxy A-series). */
  smallMobile: number;
  /** Standard iPhone widths. */
  mobile: number;
  /** Large mobile (iPhone Pro Max / Plus). */
  largeMobile: number;
  /** Tablet portrait (iPad Mini / Air). */
  tablet: number;
  /** Desktop split view threshold. */
  desktop: number;
  /** Large desktop / ultrawide. */
  wide: number;
}

export interface MapConfig {
  minZoom: number;
  maxZoom: number;
  initialZoom: number;
  zoomStep: number;
  /** Pixel radius used when collapsing neighbouring pins into a cluster. */
  clusterRadiusPx: number;
  /** Fallback viewport used before listings are fitted to the visible area. */
  initialBounds: GeoBounds;
}

export interface StorageConfig {
  maxRecentSearches: number;
  defaultFavoriteFolder: string;
}

export interface FeatureFlags {
  mapClustering: boolean;
  urlStateSync: boolean;
}

export interface AppConfig {
  appTitle: string;
  locale: string;
  currency: string;
  /** Service fee expressed as a fraction of the nightly subtotal (0.14 === 14%). */
  serviceFeePercent: number;
  /** Debounce window applied to text queries and slider movement. */
  searchDebounceMs: number;
  histogram: {
    mobileBucketCount: number;
    desktopBucketCount: number;
  };
  breakpoints: BreakpointConfig;
  map: MapConfig;
  storage: StorageConfig;
  features: FeatureFlags;
  isDevelopment: boolean;
  mode: string;
}

function createAppConfig(): AppConfig {
  return {
    appTitle: readString("VITE_APP_TITLE", "Real Estate Explorer"),
    locale: readString("VITE_DEFAULT_LOCALE", "en-US"),
    currency: readString("VITE_DEFAULT_CURRENCY", "USD"),
    serviceFeePercent: readNumber("VITE_SERVICE_FEE_PERCENT", 0.14, 0, 0.5),
    searchDebounceMs: Math.round(
      readNumber("VITE_SEARCH_DEBOUNCE_MS", 250, 0, 2000),
    ),
    histogram: {
      // Mobile renders 12 wider bars to prevent sub-pixel illegibility.
      mobileBucketCount: 12,
      desktopBucketCount: 28,
    },
    breakpoints: {
      smallMobile: 360,
      mobile: 390,
      largeMobile: 430,
      tablet: 768,
      desktop: 1024,
      wide: 1440,
    },
    map: {
      minZoom: 1,
      maxZoom: 16,
      initialZoom: 4,
      zoomStep: 0.5,
      clusterRadiusPx: 44,
      // Continental United States envelope: the seed repository's extent.
      initialBounds: {
        north: 49.4,
        south: 24.4,
        east: -66.9,
        west: -124.8,
      },
    },
    storage: {
      maxRecentSearches: 8,
      defaultFavoriteFolder: DEFAULT_FAVORITE_FOLDER,
    },
    features: {
      mapClustering: readBoolean("VITE_ENABLE_MAP_CLUSTERING", true),
      urlStateSync: readBoolean("VITE_ENABLE_URL_STATE_SYNC", true),
    },
    isDevelopment: readBoolean("DEV", false) || RAW_ENV.MODE === "development",
    mode: readString("MODE", "production"),
  };
}

/** Immutable, validated application configuration. */
export const APP_CONFIG: AppConfig = createAppConfig();

export const DEFAULT_LOCALE: string = APP_CONFIG.locale;
export const DEFAULT_CURRENCY: string = APP_CONFIG.currency;

/** Media queries derived from the breakpoint matrix, ready for `matchMedia`. */
export const MEDIA_QUERIES = {
  mobileOnly: `(max-width: ${APP_CONFIG.breakpoints.tablet - 1}px)`,
  tabletUp: `(min-width: ${APP_CONFIG.breakpoints.tablet}px)`,
  desktopUp: `(min-width: ${APP_CONFIG.breakpoints.desktop}px)`,
  wideUp: `(min-width: ${APP_CONFIG.breakpoints.wide}px)`,
  smallMobile: `(max-width: ${APP_CONFIG.breakpoints.smallMobile}px)`,
  reducedMotion: "(prefers-reduced-motion: reduce)",
} as const;

export type MediaQueryKey = keyof typeof MEDIA_QUERIES;
