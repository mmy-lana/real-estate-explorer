import { forwardRef } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "../../lib/utils";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "link"
  | "circle";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Replaces the label with a spinner and blocks interaction. */
  isLoading?: boolean;
  isFullWidth?: boolean;
  /** Renders before the label (ignored by `circle`). */
  leadingIcon?: React.ReactNode;
  /** Renders after the label (ignored by `circle`). */
  trailingIcon?: React.ReactNode;
  /** Sets `aria-pressed` for toggle buttons. */
  pressed?: boolean;
  /** Required for icon-only buttons so the control has an accessible name. */
  label?: string;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-hover active:bg-brand-active shadow-card",
  secondary:
    "bg-surface-alt text-ink hover:bg-surface-sunken active:bg-line",
  outline:
    "bg-surface text-ink border border-line hover:border-ink active:bg-surface-alt",
  ghost: "bg-transparent text-ink hover:bg-surface-alt active:bg-surface-sunken",
  link: "bg-transparent text-ink underline underline-offset-2 hover:text-brand px-0",
  circle:
    "bg-surface text-ink border border-line rounded-full hover:shadow-card active:bg-surface-alt",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm gap-1.5",
  md: "min-h-11 px-4 text-sm gap-2",
  lg: "min-h-12 px-6 text-base gap-2",
};

/** 44x44px minimum touch targets for the circle variant (plan §3.4). */
const CIRCLE_SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-11 w-11",
  md: "h-11 w-11",
  lg: "h-12 w-12",
};

const SPINNER_SIZES: Record<ButtonSize, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-4 w-4",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      isFullWidth = false,
      leadingIcon,
      trailingIcon,
      pressed,
      label,
      className,
      children,
      disabled,
      type = "button",
      ...rest
    },
    ref,
  ): React.JSX.Element {
    const isDisabled = disabled === true || isLoading;
    const isCircle = variant === "circle";

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-label={label}
        aria-busy={isLoading || undefined}
        aria-pressed={pressed}
        className={cn(
          "relative inline-flex select-none items-center justify-center font-semibold",
          "transition-[background-color,border-color,box-shadow,transform] duration-150 motion-reduce:transition-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
          isCircle ? "rounded-full" : "rounded-xl",
          isCircle ? CIRCLE_SIZE_CLASSES[size] : SIZE_CLASSES[size],
          isFullWidth && "w-full",
          VARIANT_CLASSES[variant],
          className,
        )}
        {...rest}
      >
        {isLoading ? (
          <LoaderCircle
            aria-hidden="true"
            className={cn("animate-spin", SPINNER_SIZES[size])}
          />
        ) : (
          leadingIcon
        )}
        {!isCircle && children ? (
          <span className={cn(isLoading && "opacity-0")}>{children}</span>
        ) : null}
        {isLoading && !isCircle && children ? (
          <span className="sr-only">{String(children)}</span>
        ) : null}
        {!isLoading && !isCircle ? trailingIcon : null}
        {isCircle && !isLoading ? (
          <span className="sr-only">{label ?? String(children ?? "")}</span>
        ) : null}
      </button>
    );
  },
);

export default Button;
