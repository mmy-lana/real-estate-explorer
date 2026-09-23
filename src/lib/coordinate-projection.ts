import type { Coordinates, GeoBounds } from "../types";
import { clamp, normalizeGeoBounds } from "./utils";

/**
 * Pure Mercator bounding-box projection engine.
 *
 * Converts GPS coordinates into normalised container space `[0, 1]` or pixel
 * offsets without any external map runtime. The engine is immutable in spirit:
 * every interaction (zoom, pan) returns a new viewport bounds object, and
 * `isReady()` gates marker rendering until the container has a real measurement
 * so no projection ever divides by zero.
 */

export const WORLD_FALLBACK_BOUNDS: GeoBounds = {
  north: 85.0511,
  south: -85.0511,
  east: 180,
  west: -180,
};

/** Smallest viewport span (in degrees) the engine will zoom down to. */
export const MIN_LAT_SPAN = 0.005;
export const MIN_LNG_SPAN = 0.005;
export const MAX_LAT_SPAN = 170;

export interface ProjectedPoint {
  x: number;
  y: number;
  isVisible: boolean;
}

export class CoordinateProjectionEngine {
  private bounds: GeoBounds;
  private readonly width: number;
  private readonly height: number;

  constructor(bounds: GeoBounds | null, width: number, height: number) {
    this.bounds = normalizeGeoBounds(bounds ?? WORLD_FALLBACK_BOUNDS);
    this.width = Math.max(0, width);
    this.height = Math.max(0, height);
  }

  /** True once the container has a measurable box. */
  public isReady(): boolean {
    return this.width > 0 && this.height > 0;
  }

  public getBounds(): GeoBounds {
    return { ...this.bounds };
  }

  public getSize(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  /** Projects a coordinate into container pixels. */
  public project(coords: Coordinates): ProjectedPoint {
    if (!this.isReady()) {
      return { x: 0, y: 0, isVisible: false };
    }

    const { north, south, east, west } = this.bounds;
    const latSpan = north - south;
    const lngSpan = east >= west ? east - west : 360 - (west - east);

    if (latSpan <= 0 || lngSpan <= 0) {
      return { x: -100, y: -100, isVisible: false };
    }

    const normY = (north - coords.lat) / latSpan;
    let normX: number;

    if (east >= west) {
      normX = (coords.lng - west) / lngSpan;
    } else {
      normX =
        coords.lng >= west
          ? (coords.lng - west) / lngSpan
          : (coords.lng + 360 - west) / lngSpan;
    }

    const isVisible = normX >= 0 && normX <= 1 && normY >= 0 && normY <= 1;

    return {
      x: Math.round(normX * this.width),
      y: Math.round(normY * this.height),
      isVisible,
    };
  }

  /** Projects without clamping or rounding — used for smooth animations. */
  public projectNormalized(coords: Coordinates): { x: number; y: number } {
    if (!this.isReady()) return { x: 0, y: 0 };

    const { north, south, east, west } = this.bounds;
    const latSpan = Math.max(Number.EPSILON, north - south);
    const lngSpan = Math.max(
      Number.EPSILON,
      east >= west ? east - west : 360 - (west - east),
    );

    const normY = (north - coords.lat) / latSpan;
    const normX =
      east >= west
        ? (coords.lng - west) / lngSpan
        : coords.lng >= west
          ? (coords.lng - west) / lngSpan
          : (coords.lng + 360 - west) / lngSpan;

    return { x: normX, y: normY };
  }

  /** Converts a container pixel back into a coordinate. */
  public unproject(x: number, y: number): Coordinates {
    if (!this.isReady()) {
      return { lat: this.bounds.north, lng: this.bounds.west };
    }

    const normX = clamp(x / this.width, 0, 1);
    const normY = clamp(y / this.height, 0, 1);

    const { north, south, east, west } = this.bounds;
    const latSpan = north - south;
    const lngSpan = east >= west ? east - west : 360 - (west - east);

    const lat = north - normY * latSpan;
    let lng: number;

    if (east >= west) {
      lng = west + normX * lngSpan;
    } else {
      lng = west + normX * lngSpan;
      if (lng > 180) lng -= 360;
    }

    return { lat, lng };
  }

  /**
   * Returns new viewport bounds zoomed by `factor` (`>1` zooms in) while keeping
   * the coordinate under `(anchorX, anchorY)` pinned to that same pixel.
   */
  public zoomTo(factor: number, anchorX: number, anchorY: number): GeoBounds {
    const anchor = this.unproject(anchorX, anchorY);
    const current = this.bounds;
    const next = zoomBounds(current, factor, anchor);
    return next;
  }

  /** Returns new viewport bounds panned by a pixel delta. */
  public panBy(deltaX: number, deltaY: number): GeoBounds {
    if (!this.isReady()) return { ...this.bounds };

    const { latSpan, lngSpan } = getBoundsSpanSafe(this.bounds);
    const latDelta = (deltaY / this.height) * latSpan;
    const lngDelta = (deltaX / this.width) * lngSpan;

    return normalizeGeoBounds({
      north: this.bounds.north + latDelta,
      south: this.bounds.south + latDelta,
      east: this.bounds.east + lngDelta,
      west: this.bounds.west + lngDelta,
    });
  }

  /** Bounds centred on a coordinate at the current span (pin focus). */
  public centerOn(coords: Coordinates, zoomFactor = 1): GeoBounds {
    const { latSpan, lngSpan } = getBoundsSpanSafe(this.bounds);
    const nextLatSpan = clamp(latSpan / zoomFactor, MIN_LAT_SPAN, MAX_LAT_SPAN);
    const nextLngSpan = clamp(lngSpan / zoomFactor, MIN_LNG_SPAN, 360);

    return normalizeGeoBounds({
      north: coords.lat + nextLatSpan / 2,
      south: coords.lat - nextLatSpan / 2,
      east: coords.lng + nextLngSpan / 2,
      west: coords.lng - nextLngSpan / 2,
    });
  }
}

function getBoundsSpanSafe(bounds: GeoBounds): {
  latSpan: number;
  lngSpan: number;
} {
  const lngSpan =
    bounds.east >= bounds.west
      ? bounds.east - bounds.west
      : 360 - (bounds.west - bounds.east);
  return {
    latSpan: Math.max(MIN_LAT_SPAN, bounds.north - bounds.south),
    lngSpan: Math.max(MIN_LNG_SPAN, lngSpan),
  };
}

/** Scales bounds around an anchor coordinate, clamped to legal spans. */
export function zoomBounds(
  bounds: GeoBounds,
  factor: number,
  anchor: Coordinates,
): GeoBounds {
  const safeFactor = Number.isFinite(factor) && factor > 0 ? factor : 1;
  const { latSpan, lngSpan } = getBoundsSpanSafe(bounds);

  const nextLatSpan = clamp(latSpan / safeFactor, MIN_LAT_SPAN, MAX_LAT_SPAN);
  const nextLngSpan = clamp(lngSpan / safeFactor, MIN_LNG_SPAN, 360);

  // Keep the anchor at the same relative position inside the viewport.
  const anchorRatioX = clamp((anchor.lng - bounds.west) / lngSpan, 0, 1);
  const anchorRatioY = clamp((bounds.north - anchor.lat) / latSpan, 0, 1);

  const north = anchor.lat + nextLatSpan * anchorRatioY;
  const south = north - nextLatSpan;
  const west = anchor.lng - nextLngSpan * anchorRatioX;
  const east = west + nextLngSpan;

  return normalizeGeoBounds({ north, south, east, west });
}

/** Viewport bounds that fit every coordinate with a fractional padding. */
export function fitBoundsToCoordinates(
  coordinates: readonly Coordinates[],
  padding = 0.12,
  fallback: GeoBounds = WORLD_FALLBACK_BOUNDS,
): GeoBounds {
  const valid = coordinates.filter(
    (item) => Number.isFinite(item.lat) && Number.isFinite(item.lng),
  );
  if (valid.length === 0) return { ...fallback };

  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;

  for (const item of valid) {
    north = Math.max(north, item.lat);
    south = Math.min(south, item.lat);
    east = Math.max(east, item.lng);
    west = Math.min(west, item.lng);
  }

  // A single point (or a degenerate axis) still needs a usable span.
  const latSpan = Math.max(MIN_LAT_SPAN, north - south);
  const lngSpan = Math.max(MIN_LNG_SPAN, east - west);
  const latPad = latSpan * padding;
  const lngPad = lngSpan * padding;

  return normalizeGeoBounds({
    north: north + latPad,
    south: south - latPad,
    east: east + lngPad,
    west: west - lngPad,
  });
}
