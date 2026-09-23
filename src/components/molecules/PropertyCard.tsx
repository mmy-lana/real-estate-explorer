import { useState } from "react";
import { Heart, Star, Zap } from "lucide-react";
import type { PropertyListing } from "../../types";
import { PROPERTY_TYPE_LABELS } from "../../types";
import {
  cn,
  formatCurrency,
  formatCurrencyWhole,
  formatNumber,
  formatPlural,
} from "../../lib/utils";
import { computeStayPriceBreakdown } from "../../lib/pricing";
import { Badge } from "../primitives/Badge";
import { ImageCarousel } from "./ImageCarousel";
import { RatingSummary } from "./RatingSummary";

export interface PropertyCardProps {
  listing: PropertyListing;
  isFavorite: boolean;
  onToggleFavorite: (listingId: string) => void;
  /** Highlighted because it is selected on the map or the detail sheet. */
  isActive?: boolean;
  onSelect: (listingId: string) => void;
  /** Hover/focus synchronisation with the map pins. */
  onHoverChange?: (listingId: string | null) => void;
  /** Night count used for the total-price line. Falls back to the minimum stay. */
  nights?: number;
  /** Above-the-fold cards load their first photo eagerly. */
  priority?: boolean;
  className?: string;
}

/**
 * Airbnb-style listing card: persistent 4/3 media carousel, favourite toggle,
 * badge overlays, capacity line, rating summary, and a price block that shows
 * both the nightly rate and the computed stay total (nightly subtotal plus
 * cleaning and service fees) using the shared pricing module.
 */
export function PropertyCard({
  listing,
  isFavorite,
  onToggleFavorite,
  isActive = false,
  onSelect,
  onHoverChange,
  nights,
  priority = false,
  className,
}: PropertyCardProps): React.JSX.Element {
  const [isHeartBouncing, setIsHeartBouncing] = useState(false);

  const stayNights = Math.max(1, Math.trunc(nights ?? listing.minNights));
  const breakdown = computeStayPriceBreakdown(listing, stayNights);
  const priceLabel = formatCurrencyWhole(listing.pricePerNight, listing.currency);

  const handleToggleFavorite = (): void => {
    setIsHeartBouncing(true);
    onToggleFavorite(listing.id);
  };

  const metaParts = [
    PROPERTY_TYPE_LABELS[listing.propertyType],
    listing.address.neighborhood,
    listing.address.city,
  ].filter((part) => part.trim().length > 0);

  return (
    <article
      onMouseEnter={() => onHoverChange?.(listing.id)}
      onMouseLeave={() => onHoverChange?.(null)}
      className={cn("group relative flex flex-col", className)}
    >
      <ImageCarousel
        images={listing.images}
        alt={listing.title}
        priority={priority}
        isActive={isActive}
        onOpen={() => onSelect(listing.id)}
        topLeftOverlay={
          <>
            {listing.isRareFind ? (
              <Badge variant="rare-find" size="sm">
                Rare find
              </Badge>
            ) : null}
            {listing.isInstantBook ? (
              <Badge
                variant="instant-book"
                size="sm"
                icon={<Zap className="h-3 w-3" aria-hidden="true" />}
              >
                Instant Book
              </Badge>
            ) : null}
          </>
        }
        topRightOverlay={
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleToggleFavorite();
            }}
            aria-pressed={isFavorite}
            aria-label={
              isFavorite
                ? `Remove ${listing.title} from your wishlist`
                : `Save ${listing.title} to your wishlist`
            }
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full",
              "transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
              isHeartBouncing && "animate-scale-in",
            )}
            onAnimationEnd={() => setIsHeartBouncing(false)}
          >
            <Heart
              aria-hidden="true"
              className={cn(
                "h-5 w-5 transition-[fill,color,transform] duration-200",
                isFavorite
                  ? "scale-110 fill-brand text-brand"
                  : "fill-ink/25 text-white hover:scale-110 hover:fill-ink/40",
              )}
            />
          </button>
        }
      />

      <div className="mt-3 flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 text-sm font-medium text-ink">
            <button
              type="button"
              onClick={() => onSelect(listing.id)}
              onFocus={() => onHoverChange?.(listing.id)}
              onBlur={() => onHoverChange?.(null)}
              className="line-clamp-1 text-left hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {metaParts.join(" · ")}
            </button>
          </h3>

          <RatingSummary
            ratingAverage={listing.ratingAverage}
            ratingCount={listing.ratingCount}
            className="shrink-0"
          />
        </div>

        <p className="mt-1 line-clamp-1 text-sm text-ink-muted">
          {listing.title}
        </p>

        <p className="mt-1 text-sm text-ink-muted">
          {formatNumber(listing.capacity.maxGuests)}{" "}
          {formatPlural(listing.capacity.maxGuests, "guest")} ·{" "}
          {formatNumber(listing.capacity.bedrooms)}{" "}
          {formatPlural(listing.capacity.bedrooms, "bedroom")} ·{" "}
          {formatNumber(listing.capacity.beds)}{" "}
          {formatPlural(listing.capacity.beds, "bed")}
        </p>

        {listing.host.isSuperhost ? (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-ink-muted">
            <Star className="h-3 w-3 fill-ink text-ink" aria-hidden="true" />
            Superhost · {listing.host.name}
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-ink-muted">
            Hosted by {listing.host.name}
          </p>
        )}

        <p className="mt-2 text-sm text-ink">
          <span className="font-semibold">{priceLabel}</span>
          <span className="text-ink-muted"> night</span>
          <span className="text-ink-muted">
            {" · "}
            {formatCurrency(breakdown.totalPrice, listing.currency)} for{" "}
            {formatNumber(stayNights)}{" "}
            {formatPlural(stayNights, "night")} before taxes
          </span>
        </p>
      </div>
    </article>
  );
}

export default PropertyCard;
