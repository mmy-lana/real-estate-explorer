import { Heart, Menu, SlidersHorizontal } from "lucide-react";
import { cn, formatPlural } from "../../lib/utils";
import type { MobileTab } from "./MobileNavigationHeader";

export interface MainNavigationBarProps {
  /** Search surface rendered in the centre of the bar. */
  children?: React.ReactNode;
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  favoriteCount: number;
  activeFilterCount: number;
  onOpenFilters: () => void;
  className?: string;
}

/**
 * Desktop and tablet top navigation.
 *
 * Brand mark, the compound search surface, and the primary destinations
 * (Explore / Wishlists) plus the filter trigger. Every interactive element is
 * keyboard reachable and keeps a 44px minimum target; the bar stays sticky so
 * the search criteria remain visible while the listing column scrolls.
 */
export function MainNavigationBar({
  children,
  activeTab,
  onTabChange,
  favoriteCount,
  activeFilterCount,
  onOpenFilters,
  className,
}: MainNavigationBarProps): React.JSX.Element {
  const hasFilters = activeFilterCount > 0;

  return (
    <div
      className={cn(
        "hidden border-b border-line bg-surface px-6 py-3 md:block",
        className,
      )}
    >
      <div className="mx-auto flex max-w-[1600px] items-center gap-6">
        <a
          href="#results"
          className="flex shrink-0 items-center gap-2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-white"
          >
            R
          </span>
          <span className="text-lg font-bold tracking-tight text-brand">
            stayexplorer
          </span>
        </a>

        <div className="min-w-0 flex-1">{children}</div>

        <div className="flex shrink-0 items-center gap-2">
          <nav aria-label="Views" className="flex items-center gap-1">
            <TabLink
              label="Explore"
              isActive={activeTab === "explore"}
              onClick={() => onTabChange("explore")}
            />
            <TabLink
              label="Wishlists"
              isActive={activeTab === "wishlists"}
              badgeCount={favoriteCount}
              onClick={() => onTabChange("wishlists")}
            />
          </nav>

          <button
            type="button"
            onClick={onOpenFilters}
            aria-label={
              hasFilters
                ? `Filters, ${activeFilterCount} ${formatPlural(activeFilterCount, "filter")} applied`
                : "Filters"
            }
            className={cn(
              "relative flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors duration-150",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
              hasFilters
                ? "border-ink bg-surface-alt text-ink"
                : "border-line text-ink hover:border-ink",
            )}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filters
            {hasFilters ? (
              <span
                aria-hidden="true"
                className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-semibold text-white"
              >
                {activeFilterCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => onTabChange("wishlists")}
            aria-label={`Saved stays: ${favoriteCount}`}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink hover:border-ink"
          >
            <Heart
              aria-hidden="true"
              className={cn(
                "h-4 w-4",
                favoriteCount > 0 ? "fill-brand text-brand" : "text-ink",
              )}
            />
          </button>

          <span
            aria-hidden="true"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink-muted"
            title="Menu"
          >
            <Menu className="h-4 w-4" />
          </span>
        </div>
      </div>
    </div>
  );
}

interface TabLinkProps {
  label: string;
  isActive: boolean;
  badgeCount?: number;
  onClick: () => void;
}

function TabLink({
  label,
  isActive,
  badgeCount = 0,
  onClick,
}: TabLinkProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors duration-150",
        isActive
          ? "bg-surface-alt text-ink"
          : "text-ink-muted hover:bg-surface-alt hover:text-ink",
      )}
    >
      {label}
      {badgeCount > 0 ? (
        <span className="text-xs text-ink-muted tabular-nums">
          ({badgeCount})
        </span>
      ) : null}
    </button>
  );
}

export default MainNavigationBar;
