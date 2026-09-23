import { cn } from "../../lib/utils";

export type SkeletonVariant = "block" | "text" | "circle";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
  /** Any valid CSS width, e.g. `"60%"` or `"12rem"`. */
  width?: string;
  height?: string;
}

/**
 * Layout-stable placeholder. Uses the same base surface as real content so the
 * swap to loaded data does not shift the page (no CLS).
 */
export function Skeleton({
  variant = "block",
  width,
  height,
  className,
  style,
  ...rest
}: SkeletonProps): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse bg-surface-sunken",
        variant === "circle" && "rounded-full",
        variant === "text" && "h-3 rounded",
        variant === "block" && "rounded-card",
        className,
      )}
      style={{ width, height, ...style }}
      {...rest}
    />
  );
}

export interface PropertyCardSkeletonProps {
  /** 1 column on mobile, 2 at tablet, 3 in the desktop split grid. */
  count?: number;
  className?: string;
}

/** Card-shaped skeleton matching `PropertyCard` geometry (4/3 media + copy). */
export function PropertyCardSkeleton({
  count = 1,
  className,
}: PropertyCardSkeletonProps): React.JSX.Element {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <article
          key={index}
          className={cn("flex flex-col", className)}
          aria-hidden="true"
        >
          <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
          <div className="mt-3 flex items-start justify-between gap-3">
            <Skeleton variant="text" className="h-4 w-2/3" />
            <Skeleton variant="text" className="h-4 w-10" />
          </div>
          <Skeleton variant="text" className="mt-2 w-1/2" />
          <Skeleton variant="text" className="mt-1.5 w-1/3" />
          <Skeleton variant="text" className="mt-2 h-4 w-24" />
        </article>
      ))}
    </>
  );
}

/** Skeleton surface used while the projection engine measures its container. */
export function MapSkeleton({
  className,
}: {
  className?: string;
}): React.JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex h-full w-full items-center justify-center bg-surface-alt",
        className,
      )}
    >
      <span className="sr-only">Loading map</span>
      <div className="flex flex-col items-center gap-3">
        <Skeleton variant="circle" className="h-10 w-10" />
        <Skeleton variant="text" className="w-32" />
      </div>
    </div>
  );
}

export default Skeleton;
