import type { Amenity } from "../../types";
import { AMENITY_LABELS } from "../../types";
import { AMENITY_ICONS } from "../../lib/icon-registry";
import { cn } from "../../lib/utils";

export interface AmenityPillProps {
  amenity: Amenity;
  /** `toggle` renders a button with `aria-pressed`; `static` renders a chip. */
  variant?: "static" | "toggle";
  selected?: boolean;
  onToggle?: (amenity: Amenity) => void;
  /** Hides the text label, keeping the accessible name via `aria-label`. */
  iconOnly?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const SIZE_CLASSES: Record<"sm" | "md", string> = {
  sm: "gap-2 px-3 py-1.5 text-xs",
  md: "gap-2.5 px-4 py-2.5 text-sm",
};

/**
 * Amenity chip driven by the exhaustive `AMENITY_ICONS` registry: every one of
 * the 18 domain amenities has a dedicated SVG icon, so no icon fallback exists.
 * Toggle mode keeps a 44px minimum touch target (plan §3.4).
 */
export function AmenityPill({
  amenity,
  variant = "static",
  selected = false,
  onToggle,
  iconOnly = false,
  size = "sm",
  className,
}: AmenityPillProps): React.JSX.Element {
  const Icon = AMENITY_ICONS[amenity];
  const label = AMENITY_LABELS[amenity];
  const iconClassName = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  if (variant === "static") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-xl bg-surface-alt text-ink",
          SIZE_CLASSES[size],
          className,
        )}
      >
        <Icon aria-hidden="true" className={cn(iconClassName, "shrink-0")} />
        {iconOnly ? <span className="sr-only">{label}</span> : label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onToggle?.(amenity)}
      aria-pressed={selected}
      aria-label={iconOnly ? label : undefined}
      title={label}
      className={cn(
        "inline-flex min-h-11 items-center rounded-xl border transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        selected
          ? "border-ink bg-surface-alt font-medium text-ink"
          : "border-line text-ink hover:border-ink",
        SIZE_CLASSES[size],
        className,
      )}
    >
      <Icon aria-hidden="true" className={cn(iconClassName, "shrink-0")} />
      {iconOnly ? null : label}
    </button>
  );
}

export { AMENITY_ICONS };
export default AmenityPill;
