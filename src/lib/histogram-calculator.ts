import type { PriceDistributionBucket, PropertyListing } from "../types";
import { VALIDATION_LIMITS } from "../types";
import { APP_CONFIG } from "./config";
import { clamp, roundTo } from "./utils";

/**
 * Price distribution maths backing the dual-thumb histogram.
 *
 * Mobile renders 12 wider bars so each bar stays wider than a sub-pixel; desktop
 * renders 28 bars for a finer distribution read (plan §3.2).
 */

export function getBucketCount(isMobile: boolean): number {
  return isMobile
    ? APP_CONFIG.histogram.mobileBucketCount
    : APP_CONFIG.histogram.desktopBucketCount;
}

export interface PriceBucketSummary {
  buckets: PriceDistributionBucket[];
  /** Highest bucket count, used to normalise bar heights. */
  maxCount: number;
  /** Listings that fall inside the histogram window. */
  totalCount: number;
}

/**
 * Distributes listing prices across fixed buckets spanning `[minBound, maxBound]`.
 *
 * Bucket edges are rounded to whole currency units and then forced to be
 * strictly increasing, so every bucket's `rangeEnd` equals the next bucket's
 * `rangeStart` exactly. Rounding drift can therefore never open a one-unit gap
 * (or overlap) between neighbouring bars, which would otherwise show a listing
 * as belonging to no bucket at all.
 *
 * Prices outside the window are excluded rather than clamped into the edge
 * buckets, so the histogram never overstates availability at the extremes.
 */
export function computePriceBuckets(
  listings: readonly PropertyListing[],
  isMobile = false,
  minBound: number = VALIDATION_LIMITS.MIN_PRICE,
  maxBound: number = VALIDATION_LIMITS.MAX_PRICE,
): PriceDistributionBucket[] {
  const bucketCount = getBucketCount(isMobile);
  const min = Math.min(minBound, maxBound);
  const max = Math.max(minBound, maxBound);
  const step = (max - min) / bucketCount;

  const boundaries: number[] = [];
  for (let index = 0; index <= bucketCount; index += 1) {
    const raw = Math.round(min + index * step);
    const previous = index === 0 ? null : boundaries[index - 1];
    boundaries.push(previous === null ? raw : Math.max(raw, previous + 1));
  }

  const buckets: PriceDistributionBucket[] = Array.from(
    { length: bucketCount },
    (_, index) => ({
      rangeStart: boundaries[index],
      rangeEnd: boundaries[index + 1],
      count: 0,
    }),
  );

  if (!Number.isFinite(step) || step <= 0) return buckets;

  const lastIndex = bucketCount - 1;

  for (const listing of listings) {
    const price = listing.pricePerNight;
    if (!Number.isFinite(price) || price < min || price > max) continue;

    const bucketIndex = buckets.findIndex(
      (bucket, index) =>
        price >= bucket.rangeStart &&
        (price < bucket.rangeEnd ||
          (index === lastIndex && price <= bucket.rangeEnd)),
    );

    if (bucketIndex >= 0) buckets[bucketIndex].count += 1;
  }

  return buckets;
}

/** Buckets plus the normalisation figures the chart needs, in one pass. */
export function summarizePriceBuckets(
  listings: readonly PropertyListing[],
  isMobile = false,
  minBound: number = VALIDATION_LIMITS.MIN_PRICE,
  maxBound: number = VALIDATION_LIMITS.MAX_PRICE,
): PriceBucketSummary {
  const buckets = computePriceBuckets(listings, isMobile, minBound, maxBound);
  let maxCount = 0;
  let totalCount = 0;

  for (const bucket of buckets) {
    maxCount = Math.max(maxCount, bucket.count);
    totalCount += bucket.count;
  }

  return { buckets, maxCount, totalCount };
}

/** True when a bucket overlaps the selected `[min, max]` price window. */
export function isBucketWithinRange(
  bucket: PriceDistributionBucket,
  range: readonly [number, number],
): boolean {
  const [rangeMin, rangeMax] = range;
  return bucket.rangeEnd > rangeMin && bucket.rangeStart < rangeMax;
}

/** Percentage height for a bar; a non-zero bucket always keeps a visible sliver. */
export function getBucketHeightPercent(
  count: number,
  maxCount: number,
  minVisiblePercent = 3,
): number {
  if (count <= 0 || maxCount <= 0) return 0;
  const ratio = clamp(count / maxCount, 0, 1);
  return roundTo(Math.max(minVisiblePercent, ratio * 100), 2);
}

/** Counts listings inside the selected price window. */
export function countListingsInPriceRange(
  listings: readonly PropertyListing[],
  range: readonly [number, number],
): number {
  const [min, max] = range;
  return listings.filter(
    (listing) => listing.pricePerNight >= min && listing.pricePerNight <= max,
  ).length;
}

/** Axis ticks for the histogram baseline (start, middle, end). */
export function getHistogramTicks(
  minBound: number,
  maxBound: number,
): [number, number, number] {
  const middle = Math.round((minBound + maxBound) / 2);
  return [minBound, middle, maxBound];
}
