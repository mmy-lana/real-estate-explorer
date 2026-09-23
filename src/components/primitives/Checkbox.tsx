import { useId } from "react";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

export interface CheckboxProps {
  checked: boolean;
  /** Receives the next boolean state, so callers never toggle stale values. */
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  /** Merged with a generated id when omitted. */
  id?: string;
  className?: string;
  /** Renders the label trail (e.g. a price) right-aligned. */
  trailing?: React.ReactNode;
}

/**
 * Accessible checkbox built on a real (visually hidden) `input[type=checkbox]`,
 * so browser semantics, form reset, and screen readers all work. The visible box
 * is a 20px square, while the label row keeps a 44px minimum touch target.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  id,
  className,
  trailing,
}: CheckboxProps): React.JSX.Element {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = description ? `${inputId}-description` : undefined;

  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-describedby={descriptionId}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />

      <label
        htmlFor={inputId}
        className={cn(
          "flex min-h-11 w-full cursor-pointer select-none items-center gap-3 rounded-lg py-1",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-150",
            "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink",
            checked ? "border-ink bg-ink text-white" : "border-line-strong bg-surface",
          )}
        >
          {checked ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-sm text-ink">{label}</span>
          {description ? (
            <span id={descriptionId} className="mt-0.5 block text-xs text-ink-muted">
              {description}
            </span>
          ) : null}
        </span>

        {trailing ? (
          <span className="shrink-0 text-sm text-ink-muted">{trailing}</span>
        ) : null}
      </label>
    </div>
  );
}

export default Checkbox;
