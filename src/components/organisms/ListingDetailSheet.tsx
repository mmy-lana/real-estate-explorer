import { useEffect, useState } from "react";
import {
  Bath,
  Bed,
  CalendarDays,
  Clock,
  Heart,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import type { Amenity, PropertyListing } from "../../types";
import { AMENITY_LABELS, PROPERTY_TYPE_LABELS } from "../../types";
import { AMENITY_GROUPS, AMENITY_ICONS } from "../../lib/icon-registry";
import { useIsMobileLayout } from "../../hooks/useMediaQuery";
import { isListingAvailable } from "../../lib/filter-engine";
import { computeStayFromDates } from "../../lib/pricing";
import {
  cn,
  formatCurrency,
  formatCurrencyWhole,
  formatDateMedium,
  formatNumber,
  formatPlural,
  formatResponseTime,
  nightsBetween,
  todayIsoDate,
} from "../../lib/utils";
import { Badge } from "../primitives/Badge";
import { Button } from "../primitives/Button";
import { Counter } from "../primitives/Counter";
import { Modal } from "../primitives/Modal";
import { Sheet } from "../primitives/Sheet";
import { ImageCarousel } from "../molecules/ImageCarousel";
import { RatingSummary } from "../molecules/RatingSummary";
import { AmenityPill } from "../molecules/AmenityPill";

export interface ListingDetailSheetProps {
  /** Listing to inspect; `null` renders nothing. */
  listing: PropertyListing | null;
  isOpen: boolean;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: (listingId: string) => void;
  checkInDate: string | null;
  checkOutDate: string | null;
  onSetStayWindow: (checkInDate: string | null, checkOutDate: string | null) => void;
  guestCount: number;
  onGuestCountChange: (guestCount: number) => void;
}

/**
 * Deep inspection overlay for a single listing.
 *
 * Renders as a bottom sheet on phones and a centred dialog from the tablet
 * breakpoint up, using the same content tree in both cases. Content covers the
 * full specification (gallery, capacity, description, amenities, host
 * credentials, review breakdown), the availability picture derived from the
 * listing's blocked ranges, and a reservation matrix computed by the shared
 * pricing module.
 */
export function ListingDetailSheet({
  listing,
  isOpen,
  onClose,
  isFavorite,
  onToggleFavorite,
  checkInDate,
  checkOutDate,
  onSetStayWindow,
  guestCount,
  onGuestCountChange,
}: ListingDetailSheetProps): React.JSX.Element | null {
  const isMobileLayout = useIsMobileLayout();
  const [requestSummary, setRequestSummary] = useState<string | null>(null);

  // Clear stale booking confirmation if the user modifies stay parameters or switches listings.
  useEffect(() => {
    setRequestSummary(null);
  }, [listing?.id, checkInDate, checkOutDate, guestCount]);

  if (!listing) return null;

  const today = todayIsoDate();
  const stay = computeStayFromDates(listing, checkInDate, checkOutDate);
  const requestedNights = nightsBetween(checkInDate, checkOutDate);
  const hasStayWindow = requestedNights > 0;
  const isBelowMinimum = stay.isBelowMinimumStay;
  const isDateAvailable = isListingAvailable(listing, checkInDate, checkOutDate);
  const canReserve = hasStayWindow && !isBelowMinimum && isDateAvailable;
  // `isListingAvailable` also rejects a below-minimum window, so the blackout
  // copy is scoped to the case where a valid-length window really does collide
  // with a host block — otherwise a short window would blame the calendar.
  const isBlockedByHost = hasStayWindow && !isBelowMinimum && !isDateAvailable;

  const galleryImages =
    listing.images.length > 0 ? listing.images : [];

  const nextAvailable = listing.blockedRanges
    .filter((range) => range.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 3);

  const presentAmenities = AMENITY_GROUPS.map((group) => ({
    ...group,
    members: group.members.filter((amenity) =>
      listing.amenities.includes(amenity),
    ),
  })).filter((group) => group.members.length > 0);

  const missingAmenities = (Object.keys(AMENITY_LABELS) as Amenity[]).filter(
    (amenity) => !listing.amenities.includes(amenity),
  );

  const content = (
    <div className="space-y-8">
      <ImageCarousel
        images={galleryImages}
        alt={listing.title}
        showCounterOnActiveImage
        priority
        topRightOverlay={
          <button
            type="button"
            onClick={() => onToggleFavorite(listing.id)}
            aria-pressed={isFavorite}
            aria-label={
              isFavorite ? "Remove from your wishlist" : "Save to your wishlist"
            }
            className="flex h-11 w-11 items-center justify-center rounded-full"
          >
            <Heart
              aria-hidden="true"
              className={cn(
                "h-5 w-5",
                isFavorite ? "fill-brand text-brand" : "fill-ink/25 text-white",
              )}
            />
          </button>
        }
      />

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {listing.isRareFind ? <Badge variant="rare-find">Rare find</Badge> : null}
          {listing.isInstantBook ? (
            <Badge variant="instant-book" icon={<Zap className="h-3 w-3" />}>
              Instant Book
            </Badge>
          ) : null}
          {listing.host.isSuperhost ? (
            <Badge variant="superhost" icon={<Star className="h-3 w-3" />}>
              Superhost
            </Badge>
          ) : null}
        </div>

        <h2 className="text-xl font-semibold text-ink">{listing.title}</h2>
        <p className="text-sm text-ink-muted">
          {PROPERTY_TYPE_LABELS[listing.propertyType]} in{" "}
          {listing.address.neighborhood}, {listing.address.city},{" "}
          {listing.address.state} · {listing.address.country}
        </p>
        <p className="text-xs text-ink-subtle">{listing.address.street}</p>
      </header>

      <section aria-labelledby="detail-specs">
        <h3 id="detail-specs" className="sr-only">
          Property specification
        </h3>
        <ul className="grid grid-cols-2 gap-3 text-sm text-ink">
          <SpecRow
            icon={<Users className="h-4 w-4" aria-hidden="true" />}
            label={`${formatNumber(listing.capacity.maxGuests)} ${formatPlural(listing.capacity.maxGuests, "guest")}`}
          />
          <SpecRow
            icon={<Bed className="h-4 w-4" aria-hidden="true" />}
            label={`${formatNumber(listing.capacity.bedrooms)} ${formatPlural(listing.capacity.bedrooms, "bedroom")} · ${formatNumber(listing.capacity.beds)} ${formatPlural(listing.capacity.beds, "bed")}`}
          />
          <SpecRow
            icon={<Bath className="h-4 w-4" aria-hidden="true" />}
            label={`${formatNumber(listing.capacity.bathrooms, undefined, 1)} ${formatPlural(Math.ceil(listing.capacity.bathrooms), "bathroom")}`}
          />
          <SpecRow
            icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
            label={`${listing.minNights} ${formatPlural(listing.minNights, "night")} minimum`}
          />
        </ul>
      </section>

      <section aria-labelledby="detail-description" className="space-y-2">
        <h3 id="detail-description" className="text-sm font-semibold text-ink">
          About this stay
        </h3>
        <p className="text-sm leading-relaxed text-ink-muted">
          {listing.description}
        </p>
      </section>

      <section aria-labelledby="detail-availability" className="space-y-3">
        <h3 id="detail-availability" className="text-sm font-semibold text-ink">
          Availability
        </h3>
        {nextAvailable.length > 0 ? (
          <ul className="space-y-1.5 text-sm text-ink-muted">
            {nextAvailable.map((range) => (
              <li key={`${range.startDate}-${range.endDate}`}>
                Unavailable {formatDateMedium(range.startDate)} –{" "}
                {formatDateMedium(range.endDate)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">
            No blocked dates on the calendar for the next twelve months.
          </p>
        )}
        <p className="text-xs text-ink-subtle">
          Stays must be at least {listing.minNights}{" "}
          {formatPlural(listing.minNights, "night")}
          {listing.isInstantBook
            ? " and can be booked instantly."
            : " and are confirmed by the host within 24 hours."}
        </p>
      </section>

      <section aria-labelledby="detail-amenities" className="space-y-4">
        <h3 id="detail-amenities" className="text-sm font-semibold text-ink">
          What this place offers
        </h3>
        {presentAmenities.length > 0 ? (
          presentAmenities.map((group) => (
            <div key={group.id}>
              <h4 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
                {group.title}
              </h4>
              <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.members.map((amenity) => (
                  <li key={amenity}>
                    <AmenityPill amenity={amenity} size="md" />
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p className="text-sm text-ink-muted">
            This host has not listed any amenities yet.
          </p>
        )}

        {missingAmenities.length > 0 ? (
          <details className="rounded-xl border border-line px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-ink-muted">
              Not included ({missingAmenities.length})
            </summary>
            <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {missingAmenities.map((amenity) => {
                const Icon = AMENITY_ICONS[amenity];
                return (
                  <li
                    key={amenity}
                    className="flex items-center gap-2 text-sm text-ink-subtle"
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span className="line-through">{AMENITY_LABELS[amenity]}</span>
                  </li>
                );
              })}
            </ul>
          </details>
        ) : null}
      </section>

      <section aria-labelledby="detail-host" className="space-y-3">
        <h3 id="detail-host" className="text-sm font-semibold text-ink">
          Hosted by {listing.host.name}
        </h3>
        <div className="flex items-start gap-4 rounded-panel border border-line p-4">
          <img
            src={listing.host.avatarUrl}
            alt=""
            width={56}
            height={56}
            loading="lazy"
            decoding="async"
            className="h-14 w-14 shrink-0 rounded-full object-cover"
          />
          <div className="min-w-0 space-y-1 text-sm text-ink-muted">
            <p className="font-medium text-ink">
              {listing.host.isSuperhost ? "Superhost · " : ""}
              {listing.host.name}
            </p>
            <p>Joined {listing.host.joinedDate}</p>
            <p className="flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              {listing.host.responseRatePercent}% response rate
            </p>
            <p className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Responds {formatResponseTime(listing.host.responseTimeMinutes)}
            </p>
            {listing.host.isSuperhost ? (
              <p className="flex items-center gap-1.5 text-ink">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Identity verified, highly rated host
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section aria-labelledby="detail-reviews" className="space-y-3">
        <h3 id="detail-reviews" className="text-sm font-semibold text-ink">
          Guest reviews
        </h3>
        <RatingSummary
          ratingAverage={listing.ratingAverage}
          ratingCount={listing.ratingCount}
          reviewBreakdown={listing.reviewBreakdown}
          variant="detailed"
        />
      </section>

      <section
        aria-labelledby="detail-reservation"
        className="space-y-4 rounded-panel border border-line p-4"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="detail-reservation" className="text-sm font-semibold text-ink">
            Reserve
          </h3>
          <p className="text-sm text-ink">
            <span className="font-semibold">
              {formatCurrencyWhole(listing.pricePerNight, listing.currency)}
            </span>
            <span className="text-ink-muted"> night</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink">
              Check-in
            </span>
            <input
              type="date"
              value={checkInDate ?? ""}
              min={today}
              onChange={(event) =>
                onSetStayWindow(event.target.value || null, checkOutDate)
              }
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-ink"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink">
              Check-out
            </span>
            <input
              type="date"
              value={checkOutDate ?? ""}
              min={checkInDate ?? today}
              onChange={(event) =>
                onSetStayWindow(checkInDate, event.target.value || null)
              }
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-ink"
            />
          </label>
        </div>

        <Counter
          label="Guests"
          description={`Maximum ${listing.capacity.maxGuests} guests`}
          value={Math.min(guestCount, listing.capacity.maxGuests)}
          min={1}
          max={listing.capacity.maxGuests}
          onChange={onGuestCountChange}
        />

        <dl className="space-y-2 border-t border-line pt-3 text-sm">
          <PriceRow
            label={`${formatCurrencyWhole(listing.pricePerNight, listing.currency)} × ${stay.nightsCount} ${formatPlural(stay.nightsCount, "night")}`}
            value={formatCurrency(stay.basePriceTotal, listing.currency)}
          />
          <PriceRow
            label="Cleaning fee"
            value={formatCurrency(stay.cleaningFee, listing.currency)}
          />
          <PriceRow
            label={`Service fee (${Math.round(stay.serviceFeePercent * 100)}%)`}
            value={formatCurrency(stay.serviceFee, listing.currency)}
          />
          <div className="flex items-center justify-between border-t border-line pt-2 text-base font-semibold text-ink">
            <dt>Total before taxes</dt>
            <dd>{formatCurrency(stay.totalPrice, listing.currency)}</dd>
          </div>
        </dl>

        {isBelowMinimum ? (
          <p className="rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning">
            This stay requires a minimum of {listing.minNights}{" "}
            {formatPlural(listing.minNights, "night")}. Extend your window by{" "}
            {listing.minNights - requestedNights}{" "}
            {formatPlural(listing.minNights - requestedNights, "night")} to book.
          </p>
        ) : null}

        {isBlockedByHost ? (
          <p className="rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning">
            The selected dates overlap with days blocked by the host. Please choose alternate dates.
          </p>
        ) : null}

        {!hasStayWindow ? (
          <p className="rounded-xl bg-surface-alt px-3 py-2 text-xs text-ink-muted">
            Choose check-in and check-out dates to see the exact total. The figure
            above is a one-night preview.
          </p>
        ) : null}

        <Button
          isFullWidth
          size="lg"
          disabled={!canReserve}
          onClick={() => {
            setRequestSummary(
              `${stay.nightsCount} ${formatPlural(stay.nightsCount, "night")} from ${formatDateMedium(checkInDate)} for ${Math.min(guestCount, listing.capacity.maxGuests)} ${formatPlural(Math.min(guestCount, listing.capacity.maxGuests), "guest")}`,
            );
          }}
        >
          {listing.isInstantBook ? "Reserve" : "Request to book"}
        </Button>

        {requestSummary ? (
          <div
            role="status"
            className="rounded-xl border border-success bg-success-soft px-3 py-2 text-xs text-ink"
          >
            <p className="font-semibold text-success">
              {listing.isInstantBook
                ? "Booking confirmed for this session"
                : "Request prepared for the host"}
            </p>
            <p className="mt-1">
              {requestSummary} · {formatCurrency(stay.totalPrice, listing.currency)}{" "}
              total before taxes.
            </p>
            <p className="mt-1 text-ink-muted">
              This explorer runs entirely in your browser, so no payment is
              processed and nothing is sent to a server.
            </p>
          </div>
        ) : null}

        <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
          <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
          {listing.ratingCount > 0
            ? `${formatNumber(listing.ratingCount)} guests have rated this stay ${listing.ratingAverage.toFixed(2)}`
            : "Be the first guest to review this stay"}
        </p>
      </section>

      <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        Listing updated {formatDateMedium(listing.updatedAt.slice(0, 10))}
      </p>
    </div>
  );

  if (isMobileLayout) {
    return (
      <Sheet isOpen={isOpen} onClose={onClose} title={listing.address.city} initialSnap={1}>
        {content}
      </Sheet>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" title={listing.title}>
      {content}
    </Modal>
  );
}

function SpecRow({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}): React.JSX.Element {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden="true" className="text-ink-muted">
        {icon}
      </span>
      {label}
    </li>
  );
}

function PriceRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 text-ink-muted">
      <dt className="underline decoration-line underline-offset-2">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

export default ListingDetailSheet;
