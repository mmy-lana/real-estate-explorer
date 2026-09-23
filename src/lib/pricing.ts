import type { BookingDraft, PropertyListing } from "../types";
import { APP_CONFIG } from "./config";
import { clamp, nightsBetween, roundTo } from "./utils";

/**
 * Booking and stay pricing maths, shared by `PropertyCard` (nightly rate plus
 * stay total) and `ListingDetailSheet` (full reservation breakdown) so a single
 * implementation defines every price the user sees.
 *
 * Money is rounded to cents at each step and the service fee is charged on the
 * nightly subtotal only — never on the cleaning fee.
 */

export interface StayPriceBreakdown {
  listingId: string;
  currency: string;
  /** Clamped to the listing's `minNights` when a date range is supplied. */
  nightsCount: number;
  nightlyRate: number;
  basePriceTotal: number;
  cleaningFee: number;
  serviceFee: number;
  serviceFeePercent: number;
  totalPrice: number;
  checkInDate: string | null;
  checkOutDate: string | null;
  /** True when the supplied window is shorter than the listing minimum. */
  isBelowMinimumStay: boolean;
}

function money(value: number): number {
  return roundTo(Number.isFinite(value) ? value : 0, 2);
}

/** Prices a stay of `nightsCount` nights at a listing's published rates. */
export function computeStayPriceBreakdown(
  listing: PropertyListing,
  nightsCount: number,
): StayPriceBreakdown {
  const nights = Math.max(1, Math.trunc(nightsCount));
  const nightlyRate = money(listing.pricePerNight);
  const basePriceTotal = money(nightlyRate * nights);
  const cleaningFee = money(listing.cleaningFee);
  const serviceFeePercent = clamp(
    Number.isFinite(listing.serviceFeePercent)
      ? listing.serviceFeePercent
      : APP_CONFIG.serviceFeePercent,
    0,
    1,
  );
  const serviceFee = money(basePriceTotal * serviceFeePercent);

  return {
    listingId: listing.id,
    currency: listing.currency,
    nightsCount: nights,
    nightlyRate,
    basePriceTotal,
    cleaningFee,
    serviceFee,
    serviceFeePercent,
    totalPrice: money(basePriceTotal + cleaningFee + serviceFee),
    checkInDate: null,
    checkOutDate: null,
    isBelowMinimumStay: false,
  };
}

/**
 * Builds the `BookingDraft` consumed by the detail sheet. When no dates are
 * selected the draft reflects a one-night preview so the breakdown always shows
 * real numbers instead of blanks.
 */
export function computeBookingDraft(
  listing: PropertyListing,
  checkInDate: string | null,
  checkOutDate: string | null,
  guestCount: number,
): BookingDraft {
  const requestedNights = nightsBetween(checkInDate, checkOutDate);
  const hasStayWindow = requestedNights > 0;
  const nightsCount = hasStayWindow ? requestedNights : 1;
  const breakdown = computeStayPriceBreakdown(listing, nightsCount);

  return {
    listingId: listing.id,
    checkInDate,
    checkOutDate,
    guestCount: clamp(Math.trunc(guestCount), 1, Math.max(1, listing.capacity.maxGuests)),
    nightsCount,
    basePriceTotal: breakdown.basePriceTotal,
    cleaningFee: breakdown.cleaningFee,
    serviceFee: breakdown.serviceFee,
    totalPrice: breakdown.totalPrice,
  };
}

/** Full breakdown for a concrete date window, including minimum-stay status. */
export function computeStayFromDates(
  listing: PropertyListing,
  checkInDate: string | null,
  checkOutDate: string | null,
): StayPriceBreakdown {
  const requestedNights = nightsBetween(checkInDate, checkOutDate);
  const nightsCount = requestedNights > 0 ? requestedNights : 1;
  const breakdown = computeStayPriceBreakdown(listing, nightsCount);

  return {
    ...breakdown,
    checkInDate,
    checkOutDate,
    isBelowMinimumStay:
      requestedNights > 0 && requestedNights < listing.minNights,
  };
}

/** Cheapest possible paid stay, used for "from" labels and card fallbacks. */
export function getMinimumStayTotal(listing: PropertyListing): number {
  return computeStayPriceBreakdown(listing, listing.minNights).totalPrice;
}

/** `"$245 for 2 nights"` style summary used on listing cards. */
export function describeNightlyRate(
  listing: PropertyListing,
  formatCurrency: (amount: number) => string,
): string {
  return `${formatCurrency(listing.pricePerNight)} night`;
}
