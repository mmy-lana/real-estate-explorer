import { Funnel, Search, SlidersHorizontal } from "lucide-react";
import { PROPERTY_TYPE_LABELS } from "../../types";
import { cn, formatPlural } from "../../lib/utils";

/** Anchor section a filter control should scroll to when the dialog opens. */
export type FilterSection =
  | "location"
  | "dates"
  | "rooms"
  | "price"
  | "type"
  | "amenities"
  | "all"
  | null;

export interface SearchBarCompactProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  /** Summary of the selected dates, e.g. `"Jun 12 – Jun 17"`. */
  dateLabel: string;
  /** Summary of the guest/bedroom window, e.g. `"4 guests"`. */
  guestLabel: string;
  /** Summary of the active price window, e.g. `"$120 – $480"`. */
  priceLabel: string;
  propertyTypeLabel: string;
  activeFilterCount: number;
  /** Total results for the active criteria, announced when searching. */
  resultCount: number;
  onOpenFilters: (section?: FilterSection) => void;
  className?: string;
}

/**
 * Compound search bar.
 *
 * From the `sm` breakpoint upwards it renders the full three-segment pill (where
 * / when / who) plus a secondary row of filter chips. Below `sm` it collapses to
 * a single tap target plus a filter button, which is the pattern the mobile
 * breakpoint matrix calls for. The component is presentational: every action is
 * delegated to the shell through `onOpenFilters` and `onSearchQueryChange`.
 */
export function SearchBarCompact({
  searchQuery,
  onSearchQueryChange,
  dateLabel,
  guestLabel,
  priceLabel,
  propertyTypeLabel,
  activeFilterCount,
  resultCount,
  onOpenFilters,
  className,
}: SearchBarCompactProps): React.JSX.Element {
  const hasFilters = activeFilterCount > 0;

  return (
    <div className={cn("w-full", className)}>
      {/* Mobile: single compact trigger plus icon-only filter button. */}
      <div className="flex items-center gap-2 sm:hidden">
        <button
          type="button"
          onClick={() => onOpenFilters("location")}
          className={cn(
            "flex min-h-12 flex-1 items-center gap-3 rounded-full border border-line bg-surface px-4 text-left shadow-card",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
          )}
        >
          <Search className="h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">
              {searchQuery.trim().length > 0 ? searchQuery : "Where to?"}
            </span>
            <span className="block truncate text-xs text-ink-muted">
              {dateLabel} · {guestLabel}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => onOpenFilters("all")}
          aria-label={
            hasFilters
              ? `Filters, ${activeFilterCount} ${formatPlural(activeFilterCount, "filter")} applied`
              : "Filters"
          }
          className={cn(
            "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line bg-surface shadow-card",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
          )}
        >
          <SlidersHorizontal className="h-4 w-4 text-ink" aria-hidden="true" />
          {hasFilters ? (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-semibold text-white"
            >
              {activeFilterCount}
            </span>
          ) : null}
        </button>
      </div>

      {/* Tablet and desktop: three-segment pill. */}
      <div className="hidden sm:block">
        <div className="flex items-center rounded-full border border-line bg-surface shadow-card">
          <label className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-full px-5 focus-within:bg-surface-alt">
            <Search className="h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold text-ink">
                Where
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                placeholder="Search destinations"
                aria-label="Search destinations, cities or property types"
                className="w-full border-0 bg-transparent p-0 text-sm text-ink outline-none placeholder:text-ink-muted"
              />
            </span>
          </label>

          <span aria-hidden="true" className="h-6 w-px bg-line" />

          <button
            type="button"
            onClick={() => onOpenFilters("dates")}
            className="flex min-h-12 min-w-37 flex-col items-start justify-center px-5 text-left"
          >
            <span className="text-[11px] font-semibold text-ink">When</span>
            <span className={cn("text-sm", dateLabel ? "text-ink" : "text-ink-muted")}>
              {dateLabel || "Add dates"}
            </span>
          </button>

          <span aria-hidden="true" className="h-6 w-px bg-line" />

          <button
            type="button"
            onClick={() => onOpenFilters("rooms")}
            className="flex min-h-12 min-w-32 flex-col items-start justify-center px-5 text-left"
          >
            <span className="text-[11px] font-semibold text-ink">Who</span>
            <span className={cn("text-sm", guestLabel ? "text-ink" : "text-ink-muted")}>
              {guestLabel || "Add guests"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenFilters("all")}
            aria-label={`Search ${resultCount} ${formatPlural(resultCount, "stay")}`}
            className={cn(
              "mr-2 ml-1 flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white",
              "transition-colors duration-150 hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
            )}
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="hidden lg:inline">Search</span>
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <FilterChip
            label="Price"
            value={priceLabel}
            onClick={() => onOpenFilters("price")}
            isActive={priceLabel.length > 0}
          />
          <FilterChip
            label="Property type"
            value={
              propertyTypeLabel ||
              `${PROPERTY_TYPE_LABELS.apartment} · ${PROPERTY_TYPE_LABELS.house}`
            }
            onClick={() => onOpenFilters("type")}
            isActive={propertyTypeLabel.length > 0}
          />
          <FilterChip
            label="Amenities"
            value="Wifi, pool, parking"
            onClick={() => onOpenFilters("amenities")}
            isActive={false}
          />
          <FilterChip
            label="Filters"
            value={
              hasFilters
                ? `${activeFilterCount} active`
                : "None applied"
            }
            onClick={() => onOpenFilters("all")}
            isActive={hasFilters}
            icon={<Funnel className="h-3.5 w-3.5" aria-hidden="true" />}
          />
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {resultCount} {formatPlural(resultCount, "stay")} match your search
      </p>
    </div>
  );
}

interface FilterChipProps {
  label: string;
  value: string;
  onClick: () => void;
  isActive: boolean;
  icon?: React.ReactNode;
}

function FilterChip({
  label,
  value,
  onClick,
  isActive,
  icon,
}: FilterChipProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-left transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        isActive
          ? "border-ink bg-surface-alt"
          : "border-line bg-surface hover:border-ink",
      )}
    >
      {icon}
      <span className="whitespace-nowrap text-xs font-semibold text-ink">
        {label}
      </span>
      <span className="max-w-40 truncate whitespace-nowrap text-xs text-ink-muted">
        {value}
      </span>
    </button>
  );
}

export default SearchBarCompact;
