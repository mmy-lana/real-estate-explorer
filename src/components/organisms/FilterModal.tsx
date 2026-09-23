import { useEffect, useMemo, useRef } from "react";
import { CalendarDays, Star, Zap } from "lucide-react";
import type {
  Amenity,
  FilterState,
  PriceDistributionBucket,
  PropertyListing,
  PropertyType,
} from "../../types";
import {
  AMENITY_LABELS,
  PROPERTY_TYPE_LABELS,
  RATING_OPTIONS,
  SORT_OPTIONS,
  SORT_OPTION_LABELS,
  VALIDATION_LIMITS,
} from "../../types";
import { PROPERTY_TYPE_ICONS, AMENITY_GROUPS } from "../../lib/icon-registry";
import { cn, formatDateRangeLabel, formatPlural, todayIsoDate } from "../../lib/utils";
import { Button } from "../primitives/Button";
import { Checkbox } from "../primitives/Checkbox";
import { Counter } from "../primitives/Counter";
import { Modal } from "../primitives/Modal";
import { PriceHistogram } from "../molecules/PriceHistogram";
import { AmenityPill } from "../molecules/AmenityPill";
import type { FilterSection } from "../molecules/SearchBarCompact";

export interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Immediate filter state (uncommitted edits are applied live). */
  filters: FilterState;
  onUpdateFilters: (patch: Partial<FilterState>) => void;
  onTogglePropertyType: (propertyType: PropertyType) => void;
  onToggleAmenity: (amenity: Amenity) => void;
  onSetCapacity: (
    patch: Partial<Pick<FilterState, "minBeds" | "minBedrooms" | "minBathrooms">>,
  ) => void;
  onSetStayWindow: (checkInDate: string | null, checkOutDate: string | null) => void;
  onResetSection: (section: "price" | "dates" | "rooms" | "type" | "amenities" | "booking") => void;
  onResetAll: () => void;
  /** Results matching the current criteria, echoed on the apply button. */
  resultCount: number;
  /** Repository used to derive the histogram when buckets are not supplied. */
  listings: readonly PropertyListing[];
  buckets: PriceDistributionBucket[];
  isMobileHistogram: boolean;
  /** Section to scroll into view when the dialog opens. */
  initialSection?: FilterSection;
}

const SECTION_IDS = {
  location: "filters-location",
  dates: "filters-dates",
  rooms: "filters-rooms",
  price: "filters-price",
  type: "filters-type",
  amenities: "filters-amenities",
  booking: "filters-booking",
} as const;

/**
 * Compound filter dialog.
 *
 * Houses every criterion in one scrollable surface — destination search, date
 * window, guest/room counters, the live price histogram with its dual-thumb
 * slider, property-type toggles, the 18-amenity grid, and booking preferences —
 * with a sticky reset/apply action bar. Each section exposes its own reset, and
 * the dialog can open scrolled to a specific section when launched from a search
 * pill.
 */
export function FilterModal({
  isOpen,
  onClose,
  filters,
  onUpdateFilters,
  onTogglePropertyType,
  onToggleAmenity,
  onSetCapacity,
  onSetStayWindow,
  onResetSection,
  onResetAll,
  resultCount,
  listings,
  buckets,
  isMobileHistogram,
  initialSection,
}: FilterModalProps): React.JSX.Element {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const today = todayIsoDate();

  useEffect(() => {
    if (!isOpen) return;
    const sectionKey =
      initialSection && initialSection !== "all" ? initialSection : null;
    if (!sectionKey) return;

    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(SECTION_IDS[sectionKey]);
      target?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [initialSection, isOpen]);

  const selectedTypeCount = filters.propertyTypes.length;
  const selectedAmenityCount = filters.amenities.length;
  const dateLabel = formatDateRangeLabel(filters.checkInDate, filters.checkOutDate);

  const availableAmenities = useMemo(
    () =>
      AMENITY_GROUPS.map((group) => ({
        ...group,
        members: group.members.filter((amenity) => AMENITY_LABELS[amenity]),
      })),
    [],
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="Filters"
      description="Refine stays by price, dates, space, and amenities."
      footer={
        <div className="flex items-center justify-between gap-3">
          <Button variant="link" onClick={onResetAll}>
            Clear all
          </Button>
          <Button onClick={onClose} size="md">
            Show {resultCount} {formatPlural(resultCount, "stay")}
          </Button>
        </div>
      }
    >
      <div ref={bodyRef} className="space-y-8">
        {/* Location ------------------------------------------------------- */}
        <section id={SECTION_IDS.location} aria-labelledby="filters-location-title">
          <SectionHeader
            id="filters-location-title"
            title="Where"
            onReset={() => onUpdateFilters({ searchQuery: "", bounds: null })}
            showReset={filters.searchQuery.length > 0 || filters.bounds !== null}
          />
          <label className="mt-3 block">
            <span className="sr-only">Search destination</span>
            <input
              type="search"
              value={filters.searchQuery}
              onChange={(event) => onUpdateFilters({ searchQuery: event.target.value })}
              placeholder="City, neighborhood, or property type"
              className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-ink"
            />
          </label>
          {filters.bounds ? (
            <p className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-surface-alt px-3 py-2 text-xs text-ink-muted">
              <span>Filtering by the current map area.</span>
              <button
                type="button"
                onClick={() => onUpdateFilters({ bounds: null })}
                className="font-semibold text-ink underline"
              >
                Clear area
              </button>
            </p>
          ) : null}
        </section>

        {/* Dates ---------------------------------------------------------- */}
        <section id={SECTION_IDS.dates} aria-labelledby="filters-dates-title">
          <SectionHeader
            id="filters-dates-title"
            title="When"
            onReset={() => onResetSection("dates")}
            showReset={filters.checkInDate !== null || filters.checkOutDate !== null}
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-ink">
                Check-in
              </span>
              <input
                type="date"
                value={filters.checkInDate ?? ""}
                min={today}
                onChange={(event) =>
                  onSetStayWindow(event.target.value || null, filters.checkOutDate)
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
                value={filters.checkOutDate ?? ""}
                min={filters.checkInDate ?? today}
                onChange={(event) =>
                  onSetStayWindow(filters.checkInDate, event.target.value || null)
                }
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-ink"
              />
            </label>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {dateLabel || "Any week — listings shorter than their minimum stay are hidden"}
          </p>
        </section>

        {/* Price ---------------------------------------------------------- */}
        <section id={SECTION_IDS.price} aria-labelledby="filters-price-title">
          <SectionHeader
            id="filters-price-title"
            title="Price range"
            onReset={() => onResetSection("price")}
            showReset={
              filters.priceRange[0] > VALIDATION_LIMITS.MIN_PRICE ||
              filters.priceRange[1] < VALIDATION_LIMITS.MAX_PRICE
            }
          />
          <div className="mt-4">
            <PriceHistogram
              minBound={VALIDATION_LIMITS.MIN_PRICE}
              maxBound={VALIDATION_LIMITS.MAX_PRICE}
              range={filters.priceRange}
              onChange={(range) => onUpdateFilters({ priceRange: range })}
              buckets={buckets}
              listings={listings}
              isMobile={isMobileHistogram}
              matchCount={resultCount}
            />
          </div>
        </section>

        {/* Rooms ---------------------------------------------------------- */}
        <section id={SECTION_IDS.rooms} aria-labelledby="filters-rooms-title">
          <SectionHeader
            id="filters-rooms-title"
            title="Rooms and guests"
            onReset={() => onResetSection("rooms")}
            showReset={
              filters.minBeds > 0 ||
              filters.minBedrooms > 0 ||
              filters.minBathrooms > 0
            }
          />
          <div className="mt-2 divide-y divide-line">
            <Counter
              label="Bedrooms"
              description="Minimum bedrooms"
              value={filters.minBedrooms}
              max={VALIDATION_LIMITS.MAX_CAPACITY}
              formatValue={(value) => (value === 0 ? "Any" : String(value))}
              onChange={(value) => onSetCapacity({ minBedrooms: value })}
            />
            <Counter
              label="Beds"
              description="Minimum beds"
              value={filters.minBeds}
              max={VALIDATION_LIMITS.MAX_CAPACITY}
              formatValue={(value) => (value === 0 ? "Any" : String(value))}
              onChange={(value) => onSetCapacity({ minBeds: value })}
            />
            <Counter
              label="Bathrooms"
              description="Minimum bathrooms"
              value={filters.minBathrooms}
              max={VALIDATION_LIMITS.MAX_CAPACITY}
              formatValue={(value) => (value === 0 ? "Any" : String(value))}
              onChange={(value) => onSetCapacity({ minBathrooms: value })}
            />
          </div>
        </section>

        {/* Property type -------------------------------------------------- */}
        <section id={SECTION_IDS.type} aria-labelledby="filters-type-title">
          <SectionHeader
            id="filters-type-title"
            title="Property type"
            onReset={() => onResetSection("type")}
            showReset={selectedTypeCount > 0}
          />
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(PROPERTY_TYPE_LABELS) as PropertyType[]).map((type) => {
              const Icon = PROPERTY_TYPE_ICONS[type];
              const isSelected = filters.propertyTypes.includes(type);

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onTogglePropertyType(type)}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex min-h-20 flex-col items-start justify-between gap-2 rounded-xl border p-3 text-left transition-colors duration-150",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                    isSelected
                      ? "border-ink bg-surface-alt"
                      : "border-line hover:border-ink",
                  )}
                >
                  <Icon className="h-5 w-5 text-ink" aria-hidden="true" />
                  <span className="text-xs font-medium text-ink">
                    {PROPERTY_TYPE_LABELS[type]}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Amenities ------------------------------------------------------ */}
        <section id={SECTION_IDS.amenities} aria-labelledby="filters-amenities-title">
          <SectionHeader
            id="filters-amenities-title"
            title="Amenities"
            onReset={() => onResetSection("amenities")}
            showReset={selectedAmenityCount > 0}
          />
          <div className="mt-3 space-y-5">
            {availableAmenities.map((group) => (
              <div key={group.id}>
                <h4 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
                  {group.title}
                </h4>
                <div className="mt-2 flex flex-wrap gap-2">
                  {group.members.map((amenity) => (
                    <AmenityPill
                      key={amenity}
                      amenity={amenity}
                      variant="toggle"
                      selected={filters.amenities.includes(amenity)}
                      onToggle={onToggleAmenity}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Booking preferences ------------------------------------------- */}
        <section id={SECTION_IDS.booking} aria-labelledby="filters-booking-title">
          <SectionHeader
            id="filters-booking-title"
            title="Booking options"
            onReset={() => onResetSection("booking")}
            showReset={
              filters.instantBookOnly ||
              filters.superhostOnly ||
              filters.minRating > 0
            }
          />

          <div className="mt-3 space-y-1">
            <Checkbox
              checked={filters.instantBookOnly}
              onChange={(checked) => onUpdateFilters({ instantBookOnly: checked })}
              label={
                <span className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                  Instant Book
                </span>
              }
              description="Stays you can book without waiting for host approval"
            />
            <Checkbox
              checked={filters.superhostOnly}
              onChange={(checked) => onUpdateFilters({ superhostOnly: checked })}
              label={
                <span className="flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5" aria-hidden="true" />
                  Superhost
                </span>
              }
              description="Experienced hosts with top ratings and response times"
            />
          </div>

          <fieldset className="mt-4">
            <legend className="text-xs font-semibold text-ink">Minimum rating</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {RATING_OPTIONS.map((rating) => {
                const isSelected = filters.minRating === rating;
                return (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => onUpdateFilters({ minRating: rating })}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex min-h-11 items-center gap-1 rounded-xl border px-3 text-xs font-medium transition-colors duration-150",
                      isSelected
                        ? "border-ink bg-surface-alt text-ink"
                        : "border-line text-ink hover:border-ink",
                    )}
                  >
                    {rating === 0 ? (
                      "Any"
                    ) : (
                      <>
                        <Star className="h-3 w-3 fill-ink text-ink" aria-hidden="true" />
                        {rating.toFixed(1)}+
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="mt-5 block">
            <span className="mb-1.5 block text-xs font-semibold text-ink">
              Sort results by
            </span>
            <select
              value={filters.sortBy}
              onChange={(event) =>
                onUpdateFilters({
                  sortBy: event.target.value as FilterState["sortBy"],
                })
              }
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-ink"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {SORT_OPTION_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
        </section>
      </div>
    </Modal>
  );
}

interface SectionHeaderProps {
  id: string;
  title: string;
  onReset: () => void;
  showReset: boolean;
}

function SectionHeader({
  id,
  title,
  onReset,
  showReset,
}: SectionHeaderProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line pb-2">
      <h3 id={id} className="text-sm font-semibold text-ink">
        {title}
      </h3>
      {showReset ? (
        <button
          type="button"
          onClick={onReset}
          className="text-xs font-semibold text-ink-muted underline hover:text-ink"
        >
          Reset
        </button>
      ) : null}
    </div>
  );
}

export default FilterModal;
