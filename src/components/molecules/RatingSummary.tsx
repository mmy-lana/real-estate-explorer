import { Star } from "lucide-react";
import type { ReviewBreakdown } from "../../types";
import { cn, formatNumber, formatRating } from "../../lib/utils";

export interface RatingSummaryProps {
  ratingAverage: number;
  ratingCount: number;
  /** Enables the six-axis breakdown in the `detailed` variant. */
  reviewBreakdown?: ReviewBreakdown;
  variant?: "inline" | "detailed";
  className?: string;
}

const BREAKDOWN_AXES: readonly { key: keyof ReviewBreakdown; label: string }[] = [
  { key: "cleanliness", label: "Cleanliness" },
  { key: "accuracy", label: "Accuracy" },
  { key: "communication", label: "Communication" },
  { key: "location", label: "Location" },
  { key: "checkIn", label: "Check-in" },
  { key: "value", label: "Value" },
];

/** Renders five stars with half-star precision for the supplied score. */
function StarRating({
  score,
  className,
}: {
  score: number;
  className?: string;
}): React.JSX.Element {
  const clamped = Math.max(0, Math.min(5, score));

  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${formatRating(clamped)} out of 5 stars`}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const fillRatio = Math.max(0, Math.min(1, clamped - index));

        return (
          <span key={index} className="relative inline-block h-3.5 w-3.5">
            <Star
              aria-hidden="true"
              className="absolute inset-0 h-3.5 w-3.5 text-line-strong"
              strokeWidth={1.5}
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fillRatio * 100}%` }}
            >
              <Star
                className="h-3.5 w-3.5 fill-ink text-ink"
                strokeWidth={1.5}
              />
            </span>
          </span>
        );
      })}
    </span>
  );
}

/**
 * Rating display in two densities: `inline` for listing cards and `detailed`
 * for the listing detail sheet, where the six review axes are broken out.
 */
export function RatingSummary({
  ratingAverage,
  ratingCount,
  reviewBreakdown,
  variant = "inline",
  className,
}: RatingSummaryProps): React.JSX.Element {
  const hasReviews = ratingCount > 0;

  if (variant === "inline") {
    return (
      <span className={cn("inline-flex items-center gap-1 text-sm text-ink", className)}>
        <Star className="h-3.5 w-3.5 fill-ink text-ink" aria-hidden="true" />
        <span className="font-medium tabular-nums">
          {hasReviews ? formatRating(ratingAverage) : "New"}
        </span>
        {hasReviews ? (
          <span className="text-ink-muted">
            ({formatNumber(ratingCount)})
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <section className={cn("space-y-5", className)} aria-label="Guest reviews">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <p className="text-5xl leading-none font-semibold text-ink tabular-nums">
          {hasReviews ? formatRating(ratingAverage) : "New"}
        </p>
        <div className="space-y-1">
          <StarRating score={hasReviews ? ratingAverage : 0} />
          <p className="text-sm text-ink-muted">
            {hasReviews
              ? `${formatNumber(ratingCount)} reviews`
              : "No reviews yet — be the first to stay"}
          </p>
        </div>
      </div>

      {reviewBreakdown && hasReviews ? (
        <ul className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {BREAKDOWN_AXES.map((axis) => {
            const score = reviewBreakdown[axis.key];
            const percent = Math.max(0, Math.min(100, (score / 5) * 100));

            return (
              <li key={axis.key} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-sm text-ink">{axis.label}</span>
                <span
                  className="h-1 flex-1 overflow-hidden rounded-full bg-line"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={5}
                  aria-valuenow={score}
                  aria-label={`${axis.label} rating`}
                >
                  <span
                    aria-hidden="true"
                    className="block h-full rounded-full bg-ink"
                    style={{ width: `${percent}%` }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right text-xs text-ink-muted tabular-nums">
                  {formatRating(score)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

export { StarRating };
export default RatingSummary;
