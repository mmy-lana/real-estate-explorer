import { useCallback, useEffect, useMemo, useRef } from "react";
import { clamp, cn, roundTo } from "../../lib/utils";

export interface SliderDualProps {
  min: number;
  max: number;
  /** Quantisation of both thumbs. Defaults to 1. */
  step?: number;
  value: [number, number];
  /** Fires continuously while dragging or on each key press. */
  onChange: (next: [number, number]) => void;
  /** Fires once when a drag gesture or key adjustment settles. */
  onCommit?: (next: [number, number]) => void;
  /** Smallest allowed gap between the thumbs. Defaults to one step. */
  minDistance?: number;
  disabled?: boolean;
  /** Renders `aria-valuetext` and is echoed beside the readout. */
  formatValue?: (value: number) => string;
  ariaLabelMin?: string;
  ariaLabelMax?: string;
  /** Announced summary of the selected window, e.g. "$120 to $480". */
  ariaLabelRange?: string;
  className?: string;
}

type ActiveThumb = "min" | "max" | null;

function decimalsForStep(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 0;
  const text = step.toString();
  const dotIndex = text.indexOf(".");
  return dotIndex === -1 ? 0 : Math.min(6, text.length - dotIndex - 1);
}

/**
 * Dual-thumb continuous range slider.
 *
 * Built on raw pointer events rather than two overlapping `input[type=range]`
 * elements, which removes the classic thumb-collision and z-index bugs while
 * giving both handles full keyboard control (Arrow keys, PageUp/PageDown,
 * Home/End). Each handle keeps a 44x44px gesture area; only the 20px knob is
 * painted. Thumbs clamp against each other and can never cross.
 */
export function SliderDual({
  min,
  max,
  step = 1,
  value,
  onChange,
  onCommit,
  minDistance,
  disabled = false,
  formatValue,
  ariaLabelMin = "Minimum value",
  ariaLabelMax = "Maximum value",
  ariaLabelRange,
  className,
}: SliderDualProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeThumbRef = useRef<ActiveThumb>(null);
  const valueRef = useRef<[number, number]>(value);

  const safeStep = Number.isFinite(step) && step > 0 ? step : 1;
  const span = Math.max(Number.EPSILON, max - min);
  const gap = minDistance ?? safeStep;
  const decimals = useMemo(() => decimalsForStep(safeStep), [safeStep]);

  const [minValue, maxValue] = value;

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const quantize = useCallback(
    (raw: number): number => {
      const steps = Math.round((raw - min) / safeStep);
      return clamp(roundTo(min + steps * safeStep, decimals), min, max);
    },
    [decimals, max, min, safeStep],
  );

  const valueFromClientX = useCallback(
    (clientX: number): number => {
      const track = containerRef.current;
      if (!track) return min;
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return min;
      const ratio = (clientX - rect.left) / rect.width;
      return quantize(min + ratio * span);
    },
    [min, quantize, span],
  );

  const emit = useCallback(
    (nextMin: number, nextMax: number): [number, number] => {
      const boundedMin = clamp(nextMin, min, max);
      const boundedMax = clamp(nextMax, min, max);
      const pair: [number, number] = [
        Math.min(boundedMin, boundedMax),
        Math.max(boundedMin, boundedMax),
      ];
      valueRef.current = pair;
      onChange(pair);
      return pair;
    },
    [max, min, onChange],
  );

  const commit = useCallback(() => {
    onCommit?.(valueRef.current);
  }, [onCommit]);

  const moveThumb = useCallback(
    (thumb: Exclude<ActiveThumb, null>, raw: number): void => {
      const next = quantize(raw);
      if (thumb === "min") {
        emit(Math.min(next, maxValue - gap), maxValue);
      } else {
        emit(minValue, Math.max(next, minValue + gap));
      }
    },
    [emit, gap, maxValue, minValue, quantize],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;

      const pointerValue = valueFromClientX(event.clientX);
      const distanceToMin = Math.abs(pointerValue - minValue);
      const distanceToMax = Math.abs(pointerValue - maxValue);
      const thumb: Exclude<ActiveThumb, null> =
        pointerValue <= minValue
          ? "min"
          : pointerValue >= maxValue
            ? "max"
            : distanceToMin <= distanceToMax
              ? "min"
              : "max";

      activeThumbRef.current = thumb;
      moveThumb(thumb, pointerValue);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [disabled, maxValue, minValue, moveThumb, valueFromClientX],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const thumb = activeThumbRef.current;
      if (!thumb || disabled) return;
      moveThumb(thumb, valueFromClientX(event.clientX));
    },
    [disabled, moveThumb, valueFromClientX],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!activeThumbRef.current) return;
      activeThumbRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      commit();
    },
    [commit],
  );

  const handleThumbKeyDown = useCallback(
    (thumb: Exclude<ActiveThumb, null>, event: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;

      const current = thumb === "min" ? minValue : maxValue;
      const bigStep = safeStep * 10;
      let next: number | null = null;

      switch (event.key) {
        case "ArrowLeft":
        case "ArrowDown":
          next = current - safeStep;
          break;
        case "ArrowRight":
        case "ArrowUp":
          next = current + safeStep;
          break;
        case "PageDown":
          next = current - bigStep;
          break;
        case "PageUp":
          next = current + bigStep;
          break;
        case "Home":
          next = thumb === "min" ? min : minValue + gap;
          break;
        case "End":
          next = thumb === "min" ? maxValue - gap : max;
          break;
        default:
          return;
      }

      event.preventDefault();
      moveThumb(thumb, next);
      commit();
    },
    [commit, disabled, gap, max, maxValue, min, minValue, moveThumb, safeStep],
  );

  const minPercent = ((minValue - min) / span) * 100;
  const maxPercent = ((maxValue - min) / span) * 100;

  const renderThumb = (
    thumb: Exclude<ActiveThumb, null>,
    percent: number,
    currentValue: number,
    ariaLabel: string,
  ): React.JSX.Element => (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={currentValue}
      aria-valuetext={formatValue ? formatValue(currentValue) : String(currentValue)}
      aria-disabled={disabled || undefined}
      onKeyDown={(event) => handleThumbKeyDown(thumb, event)}
      onPointerDown={(event) => {
        // Grabbing a handle directly always claims that handle.
        if (disabled) return;
        activeThumbRef.current = thumb;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ left: `${percent}%` }}
      className={cn(
        "absolute top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center",
        disabled ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-5 w-5 rounded-full border bg-surface shadow-card transition-transform duration-150",
          "peer-focus-visible:outline-2",
          disabled ? "border-line" : "border-line-strong hover:scale-110",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        )}
      />
    </div>
  );

  return (
    <div className={cn("w-full", disabled && "opacity-60", className)}>
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative h-11 w-full touch-none select-none"
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-line"
        />
        <div
          aria-hidden="true"
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-brand"
          style={{ left: `${minPercent}%`, width: `${Math.max(0, maxPercent - minPercent)}%` }}
        />

        {renderThumb("min", minPercent, minValue, ariaLabelMin)}
        {renderThumb("max", maxPercent, maxValue, ariaLabelMax)}
      </div>

      {ariaLabelRange ? <span className="sr-only">{ariaLabelRange}</span> : null}
    </div>
  );
}

export default SliderDual;
