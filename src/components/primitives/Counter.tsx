import { Minus, Plus } from "lucide-react";
import { cn } from "../../lib/utils";

export interface CounterProps {
  value: number;
  onChange: (next: number) => void;
  /** Inclusive lower bound. Defaults to 0. */
  min?: number;
  /** Inclusive upper bound. Defaults to 16 (VALIDATION_LIMITS.MAX_CAPACITY). */
  max?: number;
  step?: number;
  label: React.ReactNode;
  /** Secondary copy such as an age or capacity hint. */
  description?: React.ReactNode;
  /** Overrides the numeric readout (e.g. `"Any"` when the value is 0). */
  formatValue?: (value: number) => string;
  disabled?: boolean;
  className?: string;
}

/**
 * Airbnb-style numeric stepper. Both controls are 44x44px touch targets, the
 * decrement control disables at `min`, and the readout is announced politely.
 */
export function Counter({
  value,
  onChange,
  min = 0,
  max = 16,
  step = 1,
  label,
  description,
  formatValue,
  disabled = false,
  className,
}: CounterProps): React.JSX.Element {
  const safeStep = Math.max(1, Math.trunc(step));
  const isAtMin = value <= min;
  const isAtMax = value >= max;
  const canDecrement = !disabled && !isAtMin;
  const canIncrement = !disabled && !isAtMax;

  const emit = (direction: 1 | -1): void => {
    const next = Math.min(max, Math.max(min, value + direction * safeStep));
    if (next !== value) onChange(next);
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-3",
        disabled && "opacity-50",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {description ? (
          <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => emit(-1)}
          disabled={!canDecrement}
          aria-label={`Decrease ${typeof label === "string" ? label : "value"}`}
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full border transition-colors duration-150",
            canDecrement
              ? "border-line-strong text-ink-muted hover:border-ink hover:text-ink active:bg-surface-alt"
              : "cursor-not-allowed border-line text-line",
          )}
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>

        <output
          aria-live="polite"
          aria-atomic="true"
          className="min-w-8 text-center text-sm font-medium tabular-nums text-ink"
        >
          {formatValue ? formatValue(value) : value}
        </output>

        <button
          type="button"
          onClick={() => emit(1)}
          disabled={!canIncrement}
          aria-label={`Increase ${typeof label === "string" ? label : "value"}`}
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full border transition-colors duration-150",
            canIncrement
              ? "border-line-strong text-ink-muted hover:border-ink hover:text-ink active:bg-surface-alt"
              : "cursor-not-allowed border-line text-line",
          )}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default Counter;
