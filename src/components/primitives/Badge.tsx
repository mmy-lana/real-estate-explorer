import { cn } from "../../lib/utils";

export type BadgeVariant =
  | "neutral"
  | "brand"
  | "superhost"
  | "rare-find"
  | "instant-book"
  | "success"
  | "outline";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  /** Renders before the label, hidden from assistive tech. */
  icon?: React.ReactNode;
  size?: "sm" | "md";
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: "bg-surface-alt text-ink",
  brand: "bg-brand-soft text-brand",
  superhost: "bg-surface-alt text-ink",
  "rare-find": "bg-ink text-white",
  "instant-book": "bg-brand-soft text-brand",
  success: "bg-success-soft text-success",
  outline: "border border-line bg-surface text-ink",
};

const SIZE_CLASSES: Record<"sm" | "md", string> = {
  sm: "px-2 py-0.5 text-[11px] gap-1",
  md: "px-2.5 py-1 text-xs gap-1.5",
};

export function Badge({
  variant = "neutral",
  icon,
  size = "sm",
  className,
  children,
  ...rest
}: BadgeProps): React.JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold whitespace-nowrap",
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        className,
      )}
      {...rest}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex shrink-0">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}

export default Badge;
