import { useElementSize } from "../../hooks/useElementSize";
import { cn } from "../../lib/utils";

export interface ExplorerLayoutProps {
  /** Sticky page header (navigation bar or mobile header). */
  header: React.ReactNode;
  children: React.ReactNode;
  /** Mobile bottom tab bar. */
  bottomNav?: React.ReactNode;
  /** Full-screen overlays (modals, sheets, mobile map) rendered last. */
  overlays?: React.ReactNode;
  /** Status strip announced directly beneath the header. */
  statusRegion?: React.ReactNode;
  className?: string;
}

/**
 * Page chrome for the explorer.
 *
 * The header and status strip share one measured, sticky wrapper. Its height is
 * published as the `--app-header-height` custom property on the layout root, so
 * the desktop split view can size its scroll column and map exactly against the
 * real header instead of a hard-coded offset — which keeps the map pinned to the
 * viewport bottom at every breakpoint and zoom level.
 */
export function ExplorerLayout({
  header,
  children,
  bottomNav,
  overlays,
  statusRegion,
  className,
}: ExplorerLayoutProps): React.JSX.Element {
  const [headerRef, headerSize] = useElementSize<HTMLDivElement>();

  const layoutStyle = {
    "--app-header-height": `${Math.round(headerSize.height)}px`,
  } as React.CSSProperties;

  return (
    <div
      style={layoutStyle}
      className={cn(
        "flex min-h-dvh flex-col bg-surface text-ink antialiased",
        className,
      )}
    >
      <a
        href="#results"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to results
      </a>

      <div ref={headerRef} className="sticky top-0 z-30 bg-surface">
        {header}

        {statusRegion ? (
          <div
            role="status"
            className="border-b border-line bg-surface-alt px-4 py-2 text-xs text-ink-muted lg:px-6"
          >
            {statusRegion}
          </div>
        ) : null}
      </div>

      <main id="results" className="flex-1">
        {children}
      </main>

      {bottomNav}

      {overlays}
    </div>
  );
}

export default ExplorerLayout;
