/**
 * Base utility layer: numeric clamps, currency/number formatters, ISO date
 * normalisers, geodesic distance maths, and small generic helpers.
 *
 * Every export is pure and total: invalid input yields a sensible value instead
 * of `NaN`, `undefined`, or a thrown error, so downstream components never need
 * defensive guards of their own.
 */

import { APP_CONFIG, DEFAULT_CURRENCY, DEFAULT_LOCALE } from "./config";
import {
  isIsoDateString,
  VALIDATION_LIMITS,
  type Coordinates,
  type GeoBounds,
} from "../types";

const MS_PER_DAY = 86_400_000;
const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/* -------------------------------------------------------------------------- */
/* 1. Numeric helpers                                                         */
/* -------------------------------------------------------------------------- */

/** Constrains `value` to the inclusive `[min, max]` window. */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  return Math.min(upper, Math.max(lower, value));
}

/** Clamps and truncates toward zero, yielding a whole number. */
export function clampInt(value: number, min: number, max: number): number {
  return Math.trunc(clamp(value, min, max));
}

/** Coerces unknown input to a finite number, else `fallback`. */
export function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/** Coerces unknown input to a finite integer, else `fallback`. */
export function toInteger(value: unknown, fallback = 0): number {
  const numeric = toFiniteNumber(value, Number.NaN);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : fallback;
}

/** Rounds to a fixed number of decimal places with half-up behaviour. */
export function roundTo(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** clampInt(decimals, 0, 10);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Returns `[min, max]` with the arguments ordered and both finite. */
export function normalizeRange(
  first: number,
  second: number,
): [number, number] {
  const a = Number.isFinite(first) ? first : 0;
  const b = Number.isFinite(second) ? second : 0;
  return a <= b ? [a, b] : [b, a];
}

/** Sums a numeric projection over a collection. */
export function sumBy<T>(
  items: readonly T[],
  select: (item: T, index: number) => number,
): number {
  let total = 0;
  for (let index = 0; index < items.length; index += 1) {
    const value = select(items[index], index);
    if (Number.isFinite(value)) total += value;
  }
  return total;
}

/** Returns `percent` (0-100) of `total`. */
export function percentOf(total: number, percent: number): number {
  if (!Number.isFinite(total) || !Number.isFinite(percent)) return 0;
  return (total * percent) / 100;
}

/** Orders numbers ascending without mutating the input array. */
export function sortNumbers(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

/** Extracts the numeric minimum, or `fallback` for an empty collection. */
export function minOr(values: readonly number[], fallback: number): number {
  const finite = values.filter((value) => Number.isFinite(value));
  return finite.length > 0 ? Math.min(...finite) : fallback;
}

/** Extracts the numeric maximum, or `fallback` for an empty collection. */
export function maxOr(values: readonly number[], fallback: number): number {
  const finite = values.filter((value) => Number.isFinite(value));
  return finite.length > 0 ? Math.max(...finite) : fallback;
}

/* -------------------------------------------------------------------------- */
/* 2. Currency and number formatting                                          */
/* -------------------------------------------------------------------------- */

function resolveCurrency(currency?: string): string {
  const candidate = (currency ?? DEFAULT_CURRENCY).trim().toUpperCase();
  return candidate.length === 3 ? candidate : DEFAULT_CURRENCY;
}

function resolveLocale(locale?: string): string {
  const candidate = (locale ?? DEFAULT_LOCALE).trim();
  return candidate.length > 0 ? candidate : DEFAULT_LOCALE;
}

function safeFormat(formatter: Intl.NumberFormat, value: number): string {
  return formatter.format(Number.isFinite(value) ? value : 0);
}

/** `1234.5` → `"$1,234.50"`. */
export function formatCurrency(
  amount: number,
  currency?: string,
  locale?: string,
): string {
  const formatter = new Intl.NumberFormat(resolveLocale(locale), {
    style: "currency",
    currency: resolveCurrency(currency),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return safeFormat(formatter, amount);
}

/** `1234.5` → `"$1,235"`. Used for headline prices and histogram ticks. */
export function formatCurrencyWhole(
  amount: number,
  currency?: string,
  locale?: string,
): string {
  const formatter = new Intl.NumberFormat(resolveLocale(locale), {
    style: "currency",
    currency: resolveCurrency(currency),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return safeFormat(formatter, amount);
}

/** `18400` → `"$18.4K"`. Used for axis labels and aggregate summaries. */
export function formatCurrencyCompact(
  amount: number,
  currency?: string,
  locale?: string,
): string {
  const formatter = new Intl.NumberFormat(resolveLocale(locale), {
    style: "currency",
    currency: resolveCurrency(currency),
    notation: "compact",
    maximumFractionDigits: 1,
  });
  return safeFormat(formatter, amount);
}

/** Nightly rate label, e.g. `"$245"`. */
export function formatPricePerNight(
  amount: number,
  currency?: string,
  locale?: string,
): string {
  return formatCurrencyWhole(amount, currency, locale);
}

/** Price-window label for filter chips, e.g. `"$120 – $480"`. */
export function formatPriceRangeLabel(
  range: readonly [number, number],
  currency?: string,
  locale?: string,
): string {
  const [min, max] = normalizeRange(range[0], range[1]);
  return `${formatCurrencyWhole(min, currency, locale)} – ${formatCurrencyWhole(max, currency, locale)}`;
}

/** `4.9166` → `"4.92"`. */
export function formatRating(rating: number, locale?: string): string {
  const formatter = new Intl.NumberFormat(resolveLocale(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return safeFormat(formatter, clamp(rating, 0, 5));
}

/** `0.14` → `"14%"`. */
export function formatPercentFraction(
  fraction: number,
  locale?: string,
  fractionDigits = 0,
): string {
  const formatter = new Intl.NumberFormat(resolveLocale(locale), {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return safeFormat(formatter, fraction);
}

/** `100` → `"100%"`. */
export function formatPercentValue(
  percent: number,
  locale?: string,
  fractionDigits = 0,
): string {
  return formatPercentFraction(percent / 100, locale, fractionDigits);
}

/** `1420` → `"1.4K"`. */
export function formatCompactNumber(value: number, locale?: string): string {
  const formatter = new Intl.NumberFormat(resolveLocale(locale), {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  return safeFormat(formatter, value);
}

export function formatNumber(
  value: number,
  locale?: string,
  fractionDigits = 0,
): string {
  const formatter = new Intl.NumberFormat(resolveLocale(locale), {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return safeFormat(formatter, value);
}

/** Singular/plural selection with an automatic `+s` fallback. */
export function formatPlural(
  count: number,
  singular: string,
  plural?: string,
): string {
  const resolved = plural ?? `${singular}s`;
  return count === 1 ? singular : resolved;
}

/** `142` → `"142 reviews"`. */
export function formatReviewCount(count: number, locale?: string): string {
  const safeCount = Math.max(0, toInteger(count, 0));
  return `${formatNumber(safeCount, locale)} ${formatPlural(safeCount, "review")}`;
}

/** `15` → `"within 15 minutes"`; `90` → `"within 2 hours"`. */
export function formatResponseTime(minutes: number): string {
  const safeMinutes = Math.max(0, toInteger(minutes, 0));
  if (safeMinutes <= 5) return "within a few minutes";
  if (safeMinutes < 60) return `within ${safeMinutes} minutes`;
  const hours = Math.max(1, Math.round(safeMinutes / 60));
  return `within ${hours} ${formatPlural(hours, "hour")}`;
}

/* -------------------------------------------------------------------------- */
/* 3. ISO date normalisation and formatting                                   */
/* -------------------------------------------------------------------------- */

/** Any `Date` → `"YYYY-MM-DD"` using UTC components. */
export function toIsoDateString(date: Date): string {
  const safe = Number.isNaN(date.getTime()) ? new Date(0) : date;
  return safe.toISOString().slice(0, 10);
}

/** Any `Date` → `"YYYY-MM-DDTHH:mm:ss.sssZ"`. */
export function toIsoDateTimeString(date: Date): string {
  const safe = Number.isNaN(date.getTime()) ? new Date(0) : date;
  return safe.toISOString();
}

/** UTC midnight of the supplied instant. */
export function startOfUtcDay(date: Date): Date {
  const safe = Number.isNaN(date.getTime()) ? new Date(0) : date;
  return new Date(
    Date.UTC(safe.getUTCFullYear(), safe.getUTCMonth(), safe.getUTCDate()),
  );
}

/** Adds (or subtracts) whole days, immune to DST transitions. */
export function addDays(date: Date, days: number): Date {
  const base = startOfUtcDay(date).getTime();
  return new Date(base + toInteger(days, 0) * MS_PER_DAY);
}

/**
 * Parses a date-only ISO string (`YYYY-MM-DD`) or any full ISO timestamp.
 * Date-only values are anchored to UTC midnight so no timezone can shift the day.
 */
export function parseIsoDate(value: string | null | undefined): Date | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  if (ISO_DATE_ONLY_PATTERN.test(trimmed)) {
    if (!isIsoDateString(trimmed)) return null;
    const parsed = new Date(`${trimmed}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Coerces unknown input to a canonical `YYYY-MM-DD` string, else `null`. */
export function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = parseIsoDate(value);
  return parsed ? toIsoDateString(parsed) : null;
}

/** Today (UTC) as `YYYY-MM-DD`. */
export function todayIsoDate(reference: Date = new Date()): string {
  return toIsoDateString(startOfUtcDay(reference));
}

/** Signed whole-day delta `end - start`, or `null` when either date is invalid. */
export function diffInDays(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): number | null {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (!start || !end) return null;
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

/** Night count for a stay; `0` when the window is absent, invalid, or inverted. */
export function nightsBetween(
  checkInDate: string | null | undefined,
  checkOutDate: string | null | undefined,
): number {
  const days = diffInDays(checkInDate, checkOutDate);
  return days !== null && days > 0 ? days : 0;
}

/** True when both dates parse and `start` precedes `end`. */
export function isChronologicalRange(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): boolean {
  const days = diffInDays(startIso, endIso);
  return days !== null && days > 0;
}

/** Half-open interval overlap test: `startA < endB && endA > startB`. */
export function rangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  const aStart = parseIsoDate(startA);
  const aEnd = parseIsoDate(endA);
  const bStart = parseIsoDate(startB);
  const bEnd = parseIsoDate(endB);
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

function isoFormatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  // `timeZone: "UTC"` keeps date-only values stable regardless of client offset.
  return new Intl.DateTimeFormat(resolveLocale(), { ...options, timeZone: "UTC" });
}

/** `"2026-06-12"` → `"Jun 12"`. */
export function formatDateShort(
  iso: string | null | undefined,
  locale?: string,
): string {
  const date = parseIsoDate(iso);
  if (!date) return "";
  const formatter = locale
    ? new Intl.DateTimeFormat(resolveLocale(locale), {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : isoFormatter({ month: "short", day: "numeric" });
  return formatter.format(date);
}

/** `"2026-06-12"` → `"Jun 12, 2026"`. */
export function formatDateMedium(
  iso: string | null | undefined,
  locale?: string,
): string {
  const date = parseIsoDate(iso);
  if (!date) return "";
  const formatter = locale
    ? new Intl.DateTimeFormat(resolveLocale(locale), {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : isoFormatter({ month: "short", day: "numeric", year: "numeric" });
  return formatter.format(date);
}

/** `"2026-06-12"` → `"Friday, June 12, 2026"`. */
export function formatDateLong(
  iso: string | null | undefined,
  locale?: string,
): string {
  const date = parseIsoDate(iso);
  if (!date) return "";
  const formatter = locale
    ? new Intl.DateTimeFormat(resolveLocale(locale), {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : isoFormatter({
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
  return formatter.format(date);
}

/** `"2026-06-12"` → `"June 2026"`. Used for host tenure labels. */
export function formatMonthYear(
  iso: string | null | undefined,
  locale?: string,
): string {
  const date = parseIsoDate(iso);
  if (!date) return "";
  const formatter = locale
    ? new Intl.DateTimeFormat(resolveLocale(locale), {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : isoFormatter({ month: "long", year: "numeric" });
  return formatter.format(date);
}

/** `"2026-06-12"` + `"2026-06-17"` → `"Jun 12 – Jun 17"`. */
export function formatDateRangeLabel(
  checkInDate: string | null | undefined,
  checkOutDate: string | null | undefined,
  locale?: string,
): string {
  const start = formatDateMedium(checkInDate, locale);
  if (!start) return "";
  const end = formatDateMedium(checkOutDate, locale);
  return end ? `${formatDateShort(checkInDate, locale)} – ${end}` : start;
}

/** ISO date → value accepted by `<input type="date">`. */
export function toDateInputValue(iso: string | null | undefined): string {
  return normalizeIsoDate(iso) ?? "";
}

/* -------------------------------------------------------------------------- */
/* 4. Geodesic helpers                                                        */
/* -------------------------------------------------------------------------- */

/** IUGG mean Earth radius in kilometres. */
export const EARTH_RADIUS_KM = 6371.0088;

const KM_PER_MILE = 1.609344;

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** Great-circle distance in kilometres between two coordinates. */
export function haversineDistanceKm(a: Coordinates, b: Coordinates): number {
  if (
    !Number.isFinite(a.lat) ||
    !Number.isFinite(a.lng) ||
    !Number.isFinite(b.lat) ||
    !Number.isFinite(b.lng)
  ) {
    return 0;
  }

  const latDelta = toRadians(b.lat - a.lat);
  const lngDelta = toRadians(b.lng - a.lng);
  const latA = toRadians(a.lat);
  const latB = toRadians(b.lat);

  const h =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(latA) * Math.cos(latB) * Math.sin(lngDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Kilometres → miles. */
export function kilometersToMiles(km: number): number {
  return Number.isFinite(km) ? km / KM_PER_MILE : 0;
}

/** `12.44` → `"12.4 km"`. */
export function formatDistanceKm(
  km: number,
  locale?: string,
  fractionDigits = 1,
): string {
  const safeKm = Number.isFinite(km) ? Math.max(0, km) : 0;
  return `${formatNumber(safeKm, locale, fractionDigits)} km`;
}

/** `12.44` → `"7.7 mi"`. */
export function formatDistanceMiles(
  km: number,
  locale?: string,
  fractionDigits = 1,
): string {
  const miles = Math.max(0, kilometersToMiles(km));
  return `${formatNumber(miles, locale, fractionDigits)} mi`;
}

/** Point-in-rectangle test with antimeridian wrap handling. */
export function isCoordinateWithinBounds(
  coordinates: Coordinates,
  bounds: GeoBounds,
): boolean {
  const withinLat =
    coordinates.lat <= bounds.north && coordinates.lat >= bounds.south;
  const withinLng =
    bounds.east >= bounds.west
      ? coordinates.lng >= bounds.west && coordinates.lng <= bounds.east
      : coordinates.lng >= bounds.west || coordinates.lng <= bounds.east;
  return withinLat && withinLng;
}

/** Clamps a bounds object into legal latitude/longitude space. */
export function normalizeGeoBounds(bounds: GeoBounds): GeoBounds {
  const north = clamp(
    bounds.north,
    VALIDATION_LIMITS.MIN_COORDINATES.lat,
    VALIDATION_LIMITS.MAX_COORDINATES.lat,
  );
  const south = clamp(
    bounds.south,
    VALIDATION_LIMITS.MIN_COORDINATES.lat,
    VALIDATION_LIMITS.MAX_COORDINATES.lat,
  );
  return {
    north: Math.max(north, south),
    south: Math.min(north, south),
    east: clamp(
      bounds.east,
      VALIDATION_LIMITS.MIN_COORDINATES.lng,
      VALIDATION_LIMITS.MAX_COORDINATES.lng,
    ),
    west: clamp(
      bounds.west,
      VALIDATION_LIMITS.MIN_COORDINATES.lng,
      VALIDATION_LIMITS.MAX_COORDINATES.lng,
    ),
  };
}

export function getBoundsCenter(bounds: GeoBounds): Coordinates {
  const normalized = normalizeGeoBounds(bounds);
  return {
    lat: (normalized.north + normalized.south) / 2,
    lng: (normalized.east + normalized.west) / 2,
  };
}

export function getBoundsSpan(bounds: GeoBounds): {
  latSpan: number;
  lngSpan: number;
} {
  const normalized = normalizeGeoBounds(bounds);
  const lngSpan =
    normalized.east >= normalized.west
      ? normalized.east - normalized.west
      : 360 - (normalized.west - normalized.east);
  return {
    latSpan: normalized.north - normalized.south,
    lngSpan,
  };
}

/** Scales a bounds rectangle outward around its centre. */
export function expandGeoBounds(bounds: GeoBounds, factor = 1.2): GeoBounds {
  const normalized = normalizeGeoBounds(bounds);
  const center = getBoundsCenter(normalized);
  const { latSpan, lngSpan } = getBoundsSpan(normalized);
  const safeFactor = Number.isFinite(factor) ? Math.max(1, factor) : 1;
  const halfLat = (latSpan * safeFactor) / 2;
  const halfLng = (lngSpan * safeFactor) / 2;

  return normalizeGeoBounds({
    north: center.lat + halfLat,
    south: center.lat - halfLat,
    east: center.lng + halfLng,
    west: center.lng - halfLng,
  });
}

/** True when the two rectangles share any area. */
export function boundsIntersect(a: GeoBounds, b: GeoBounds): boolean {
  const first = normalizeGeoBounds(a);
  const second = normalizeGeoBounds(b);
  const latOverlap = first.south <= second.north && first.north >= second.south;
  const lngOverlap = first.west <= second.east && first.east >= second.west;
  return latOverlap && lngOverlap;
}

/** Tightest rectangle containing every supplied coordinate, or `null`. */
export function getCoordinatesBounds(
  coordinates: readonly Coordinates[],
): GeoBounds | null {
  const valid = coordinates.filter(
    (item) => Number.isFinite(item.lat) && Number.isFinite(item.lng),
  );
  if (valid.length === 0) return null;

  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;

  for (const item of valid) {
    north = Math.max(north, item.lat);
    south = Math.min(south, item.lat);
    east = Math.max(east, item.lng);
    west = Math.min(west, item.lng);
  }

  return normalizeGeoBounds({ north, south, east, west });
}

/* -------------------------------------------------------------------------- */
/* 5. Generic helpers                                                         */
/* -------------------------------------------------------------------------- */

type ClassValue = string | false | null | undefined;

/** Joins truthy class names, e.g. `cn("p-2", isActive && "bg-black")`. */
export function cn(...values: ClassValue[]): string {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}

/** `"Architectural Hilltop Sanctuary!"` → `"architectural-hilltop-sanctuary"`. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Deterministic 32-bit FNV-1a hash. Used to derive stable pseudo-random fixture
 * variation (review spreads, calendar blocks) without shipping a PRNG state.
 */
export function stableHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Removes duplicate primitives while preserving first-seen order. */
export function unique<T>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
}

/** Removes duplicates by a derived key while preserving first-seen order. */
export function uniqueBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const itemKey = key(item);
    if (seen.has(itemKey)) continue;
    seen.add(itemKey);
    result.push(item);
  }
  return result;
}

/** Truncates text on a word boundary and appends an ellipsis. */
export function truncateText(text: string, maxLength: number): string {
  const limit = Math.max(0, toInteger(maxLength, 0));
  if (text.length <= limit) return text;
  if (limit <= 1) return text.slice(0, limit);

  const sliced = text.slice(0, limit - 1);
  const lastSpace = sliced.lastIndexOf(" ");
  const body = lastSpace > limit * 0.6 ? sliced.slice(0, lastSpace) : sliced;
  return `${body.trimEnd()}…`;
}

export interface DebouncedFunction<Args extends unknown[]> {
  (...args: Args): void;
  /** Cancels a scheduled invocation, if any. */
  cancel(): void;
  /** True while an invocation is scheduled. */
  isPending(): boolean;
}

/** Trailing-edge debounce with an explicit `cancel` for effect cleanup. */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number,
): DebouncedFunction<Args> {
  const delay = Math.max(0, toInteger(waitMs, 0));
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const debounced = (...args: Args): void => {
    cancel();
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delay);
  };

  return Object.assign(debounced, {
    cancel,
    isPending: (): boolean => timer !== null,
  });
}

/** Collapses runs of whitespace and trims the result. */
export function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

/** Service fee fraction applied to the nightly subtotal. */
export function getServiceFeePercent(): number {
  return APP_CONFIG.serviceFeePercent;
}
