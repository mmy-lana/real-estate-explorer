import type { PropertyListing } from "../../types";
import { cn, formatCurrencyWhole } from "../../lib/utils";

export interface MapPinProps {
  listing: PropertyListing;
  /** Projected pixel position inside the map container. */
  x: number;
  y: number;
  isActive: boolean;
  isHovered: boolean;
  onSelect: (listingId: string) => void;
  onHoverChange?: (listingId: string | null) => void;
  /** `price-pill` shows the nightly rate; `dot` marks dense/clustered areas. */
  mode?: "price-pill" | "dot";
  className?: string;
}

/**
 * Interactive map marker anchored at its projected coordinate (the transform
 * places the bottom tip of the pin exactly on `x`/`y`). The interactive element
 * is always at least 44x44px, while the painted pill stays compact, and hover
 * lift plus the active highlight are pure `transform`/`opacity` animations.
 */
export function MapPin({
  listing,
  x,
  y,
  isActive,
  isHovered,
  onSelect,
  onHoverChange,
  mode = "price-pill",
  className,
}: MapPinProps): React.JSX.Element {
  const priceLabel = formatCurrencyWhole(
    listing.pricePerNight,
    listing.currency,
  );
  const isEmphasised = isActive || isHovered;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onSelect(listing.id);
      }}
      onMouseEnter={() => onHoverChange?.(listing.id)}
      onMouseLeave={() => onHoverChange?.(null)}
      onFocus={() => onHoverChange?.(listing.id)}
      onBlur={() => onHoverChange?.(null)}
      aria-label={`${listing.title} — ${priceLabel} per night${
        isActive ? " (selected)" : ""
      }`}
      aria-pressed={isActive}
      style={{ left: `${x}px`, top: `${y}px` }}
      className={cn(
        "absolute flex h-11 -translate-x-1/2 -translate-y-full items-end justify-center",
        "touch-manipulation focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        isActive ? "z-30" : isHovered ? "z-20" : "z-10",
        className,
      )}
    >
      {mode === "dot" ? (
        <span
          aria-hidden="true"
          className={cn(
            "mb-1.5 block h-3.5 w-3.5 rounded-full border-2 border-white shadow-pin transition-transform duration-150",
            isEmphasised ? "scale-150 bg-ink" : "bg-brand",
          )}
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "mb-0.5 flex items-center justify-center rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
            "shadow-pin transition-transform duration-150 will-change-transform",
            isEmphasised
              ? "scale-110 border-ink bg-ink text-white shadow-pin-active"
              : "border-line bg-surface text-ink hover:scale-105",
          )}
        >
          {priceLabel}
        </span>
      )}
    </button>
  );
}

export default MapPin;
