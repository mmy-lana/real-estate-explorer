import { useMemo } from "react";
import type { PriceDistributionBucket, PropertyListing } from "../../types";
import { VALIDATION_LIMITS } from "../../types";
import {
  computePriceBuckets,
  getBucketHeightPercent,
  getHistogramTicks,
  isBucketWithinRange,
} from "../../lib/histogram-calculator";
import { cn, formatCurrencyCompact, formatCurrencyWhole } from "../../lib/utils";
import { SliderDual } from "../primitives/SliderDual";

export interface PriceHistogramProps {
  /** Lower edge of the histogram window (defaults to the domain minimum). */
  minBound?: number;
  /** Upper edge of the histogram window (defaults to the domain maximum). */
  maxBound?: number;
  /** Currently selected price window. */
  range: [number, number];
  onChange: (next: [number, number]) => void;
  onCommit?: (next: [number, number]) => void;
  /** Pre-computed buckets. When omitted they are derived from `listings`. */
  buckets?: PriceDistributionBucket[];
  /** Source dataset used to derive buckets when `buckets` is absent. */
  listings?: readonly PropertyListing[];
  /** Renders 12 wider bars instead of 28. */
  isMobile?: boolean;
  currency?: string;
  disabled?: boolean;
  /** Total listings inside the window, echoed as a caption. */
  matchCount?: number;
  className?: string;
}

/**
 * Price distribution chart wired to the dual-thumb slider. Bars inside the
 * active window are painted in the brand colour; the rest recede to a neutral
 * tone, so dragging a handle repaints the chart in the same frame with only
 * `height`/`background-color` changes on already-laid-out nodes.
 */
export function PriceHistogram({
  minBound = VALIDATION_LIMITS.MIN_PRICE,
  maxBound = VALIDATION_LIMITS.MAX_PRICE,
  range,
  onChange,
  onCommit,
  buckets,
  listings,
  isMobile = false,
  currency,
  disabled = false,
  matchCount,
  className,
}: PriceHistogramProps): React.JSX.Element {
  const resolvedBuckets = useMemo(() => {
    if (buckets && buckets.length > 0) return buckets;
    return computePriceBuckets(listings ?? [], isMobile, minBound, maxBound);
  }, [buckets, isMobile, listings, maxBound, minBound]);

  const maxCount = useMemo(
    () => resolvedBuckets.reduce((highest, bucket) => Math.max(highest, bucket.count), 0),
    [resolvedBuckets],
  );

  const [tickStart, tickMiddle, tickEnd] = getHistogramTicks(minBound, maxBound);
  const rangeLabel = `${formatCurrencyWhole(range[0], currency)} – ${formatCurrencyWhole(range[1], currency)}`;

  return (
    <div className={cn("w-full", className)}>
      <div
        className="relative flex h-24 items-end gap-[2px] sm:gap-px"
        role="img"
        aria-label={`Price distribution from ${formatCurrencyWhole(minBound, currency)} to ${formatCurrencyWhole(maxBound, currency)}`}
      >
        {resolvedBuckets.map((bucket) => {
          const isSelected = isBucketWithinRange(bucket, range);
          const heightPercent = getBucketHeightPercent(bucket.count, maxCount);

          return (
            <span
              key={`${bucket.rangeStart}-${bucket.rangeEnd}`}
              aria-hidden="true"
              title={`${formatCurrencyWhole(bucket.rangeStart, currency)} – ${formatCurrencyWhole(bucket.rangeEnd, currency)}: ${bucket.count} ${
                bucket.count === 1 ? "stay" : "stays"
              }`}
              className={cn(
                "flex-1 rounded-t-sm transition-[height,background-color] duration-200 motion-reduce:transition-none",
                isSelected
                  ? "bg-brand/60"
                  : "bg-line-strong/45",
              )}
              style={{ height: `${heightPercent}%` }}
            />
          );
        })}
      </div>

      <SliderDual
        min={minBound}
        max={maxBound}
        step={10}
        value={range}
        onChange={onChange}
        onCommit={onCommit}
        disabled={disabled}
        minDistance={10}
        formatValue={(value) => formatCurrencyWhole(value, currency)}
        ariaLabelMin="Minimum price"
        ariaLabelMax="Maximum price"
        ariaLabelRange={`Selected price range ${rangeLabel}`}
        className="mt-1"
      />

      <div className="flex items-center justify-between text-[11px] text-ink-muted">
        <span>{formatCurrencyCompact(tickStart, currency)}</span>
        <span>{formatCurrencyCompact(tickMiddle, currency)}</span>
        <span>{formatCurrencyCompact(tickEnd, currency)}</span>
      </div>

      <p className="mt-2 text-sm text-ink-muted" aria-live="polite">
        <span className="font-medium text-ink">{rangeLabel}</span>
        {typeof matchCount === "number"
          ? ` · ${matchCount} ${matchCount === 1 ? "stay" : "stays"} in range`
          : null}
      </p>
    </div>
  );
}

export default PriceHistogram;
