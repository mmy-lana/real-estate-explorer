import { Compass, Heart, Map, Search, SlidersHorizontal } from "lucide-react";
import { cn, formatPlural } from "../../lib/utils";

export interface MobileNavigationHeaderProps {
  /** Summary shown inside the compact search trigger. */
  searchSummary: string;
  activeFilterCount: number;
  onOpenSearch: () => void;
  onOpenFilters: () => void;
}

/**
 * Compact mobile header: brand mark, single search trigger that carries the
 * active criteria summary, and an icon-only filter button with a count badge.
 * Sticky so the criteria stay reachable while the listing column scrolls.
 */
export function MobileNavigationHeader({
  searchSummary,
  activeFilterCount,
  onOpenSearch,
  onOpenFilters,
}: MobileNavigationHeaderProps): React.JSX.Element {
  const hasFilters = activeFilterCount > 0;

  return (
    <div className="border-b border-line bg-surface px-4 py-3 md:hidden">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white"
        >
          R
        </span>

        <button
          type="button"
          onClick={onOpenSearch}
          className={cn(
            "flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-full border border-line bg-surface px-4 text-left shadow-card",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
          )}
        >
          <Search className="h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">
              {searchSummary || "Where to?"}
            </span>
            <span className="block truncate text-xs text-ink-muted">
              Search stays, cities, or hosts
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenFilters}
          aria-label={
            hasFilters
              ? `Filters, ${activeFilterCount} ${formatPlural(activeFilterCount, "filter")} applied`
              : "Filters"
          }
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line bg-surface shadow-card"
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
    </div>
  );
}

export type MobileTab = "explore" | "wishlists";

export interface MobileBottomNavigationProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  favoriteCount: number;
  isMapOpen: boolean;
  onToggleMap: (open: boolean) => void;
  onOpenFilters: () => void;
  activeFilterCount: number;
}

/**
 * Bottom tab bar for the mobile layout, including the map toggle that swaps the
 * grid for the full-screen projection map. Every target keeps a 44px minimum
 * hit area and reserves space for the iOS home indicator.
 */
export function MobileBottomNavigation({
  activeTab,
  onTabChange,
  favoriteCount,
  isMapOpen,
  onToggleMap,
  onOpenFilters,
  activeFilterCount,
}: MobileBottomNavigationProps): React.JSX.Element {
  return (
    <nav
      aria-label="Primary"
      className="sticky bottom-0 z-30 border-t border-line bg-surface pt-2 pb-safe md:hidden"
    >
      <ul className="flex items-stretch justify-around">
        <li className="flex-1">
          <TabButton
            label="Explore"
            icon={<Compass className="h-5 w-5" aria-hidden="true" />}
            isActive={activeTab === "explore" && !isMapOpen}
            onClick={() => {
              onToggleMap(false);
              onTabChange("explore");
            }}
          />
        </li>
        <li className="flex-1">
          <TabButton
            label="Wishlists"
            icon={<Heart className="h-5 w-5" aria-hidden="true" />}
            badgeCount={favoriteCount}
            isActive={activeTab === "wishlists" && !isMapOpen}
            onClick={() => {
              onToggleMap(false);
              onTabChange("wishlists");
            }}
          />
        </li>
        <li className="flex-1">
          <TabButton
            label="Map"
            icon={<Map className="h-5 w-5" aria-hidden="true" />}
            isActive={isMapOpen}
            onClick={() => onToggleMap(!isMapOpen)}
          />
        </li>
        <li className="flex-1">
          <TabButton
            label="Filters"
            icon={<SlidersHorizontal className="h-5 w-5" aria-hidden="true" />}
            badgeCount={activeFilterCount}
            isActive={false}
            onClick={onOpenFilters}
          />
        </li>
      </ul>
    </nav>
  );
}

interface TabButtonProps {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  badgeCount?: number;
  onClick: () => void;
}

function TabButton({
  label,
  icon,
  isActive,
  badgeCount = 0,
  onClick,
}: TabButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "relative flex min-h-12 w-full flex-col items-center justify-center gap-0.5 py-1 text-[11px] font-medium transition-colors duration-150",
        isActive ? "text-brand" : "text-ink-muted hover:text-ink",
      )}
    >
      {icon}
      <span>{label}</span>
      {badgeCount > 0 ? (
        <span
          aria-hidden="true"
          className="absolute top-0.5 right-1/2 flex h-4 min-w-4 translate-x-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white"
        >
          {badgeCount}
        </span>
      ) : null}
    </button>
  );
}

export default MobileNavigationHeader;
