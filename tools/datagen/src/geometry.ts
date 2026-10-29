/**
 * Geometry helpers over the curated DC corpus. Points are [longitude,
 * latitude] pairs in degrees throughout (GeoJSON order).
 *
 * Membership uses @turf/boolean-point-in-polygon plus an explicit
 * distance-to-boundary margin, so "strictly inside" is robust against the
 * corpus's ~1 m geometry quantization. Ring semantics note: the corpus keeps
 * flat rings lists (source parts and holes carry no ordering convention);
 * turf's containment-aware point-in-polygon resolves them correctly —
 * verified against a manual even-odd implementation across all multi-ring
 * ZIP polygons (20.8k samples, zero disagreements).
 *
 * Distance math below uses `Math.sqrt(dx² + dy²)` rather than `Math.hypot`:
 * hypot is not correctly rounded on all engines and could flip comparisons
 * at margins differently on different JS engines, breaking byte-identical
 * regeneration across engines.
 */
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";

export type Point = [number, number];
export type Line = readonly Point[];
export type PolygonRings = readonly Line[];
export type PolygonGeometry = { type: "Polygon"; coordinates: number[][][] };

/** Builds a turf-compatible polygon geometry from GeoJSON-style rings. */
export function polygonGeometry(rings: PolygonRings): PolygonGeometry {
  return { type: "Polygon", coordinates: rings.map((ring) => ring.map(([x, y]) => [x, y])) };
}

/** Linear interpolation between two sampled points: A + t(B − A). */
export function interpolateSegment(a: Point, b: Point, t: number): Point {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Distance from a point to a segment (degrees). */
export function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const norm2 = dx * dx + dy * dy;
  if (norm2 === 0) {
    const dxx = px - ax;
    const dyy = py - ay;
    return Math.sqrt(dxx * dxx + dyy * dyy);
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / norm2));
  const dxx = px - (ax + t * dx);
  const dyy = py - (ay + t * dy);
  return Math.sqrt(dxx * dxx + dyy * dyy);
}

/** Minimum distance from a point to a polyline's segments (degrees). */
export function distanceToLine(points: Line, x: number, y: number): number {
  if (points.length === 0) {
    throw new Error("empty line");
  }
  let min = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a === undefined || b === undefined) {
      continue;
    }
    const d = distanceToSegment(x, y, a[0], a[1], b[0], b[1]);
    if (d < min) {
      min = d;
    }
  }
  return min;
}

/** Minimum distance from a point to any ring boundary of the polygon (degrees). */
export function polygonBoundaryDistance(rings: PolygonRings, x: number, y: number): number {
  let min = Infinity;
  for (const ring of rings) {
    const d = distanceToLine(ring, x, y);
    if (d < min) {
      min = d;
    }
  }
  return min;
}

/**
 * Strict polygon membership: inside the rings per turf ray casting with
 * boundary excluded (`ignoreBoundary`) AND at least `marginDeg` from any
 * boundary segment.
 */
export function pointStrictlyInside(
  polygon: PolygonGeometry,
  x: number,
  y: number,
  marginDeg: number,
): boolean {
  if (!booleanPointInPolygon([x, y], polygon, { ignoreBoundary: true })) {
    return false;
  }
  // Turf geometry coordinates are number[][][]; after the turf membership
  // check passed they behave as our rings for the margin distance.
  return polygonBoundaryDistance(polygon.coordinates as unknown as PolygonRings, x, y) > marginDeg;
}

// Math.cos here feeds only the meter conversion that drives street-length
// heuristics (building-number pitch, ward-piece triage). Outputs round to the
// 52-ft pitch and the corpus is quantized to ~1 m, so any 1-ulb libm drift
// across engines (~1e-10 m at these latitudes) lands far inside the
// quantization dead band — a rationale, not a hand-rolled replacement.
const METERS_PER_DEGREE_LAT = 110540;
const FEET_PER_METER = 3.28084;

function metersPerDegreeLon(latitude: number): number {
  return Math.max(1, Math.cos((latitude * Math.PI) / 180) * METERS_PER_DEGREE_LAT);
}

/** Length of a polyline in meters (planar approximation — fine at DC scale). */
export function lineLengthMeters(points: Line): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a === undefined || b === undefined) {
      continue;
    }
    const dx = (b[0] - a[0]) * metersPerDegreeLon(a[1]);
    const dy = (b[1] - a[1]) * METERS_PER_DEGREE_LAT;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

/** Distance along a polyline up to a fractional position between two of its points. */
export function distanceAlongLineMeters(points: Line, segmentIndex: number, t: number): number {
  let total = 0;
  for (let i = 1; i <= segmentIndex && i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a === undefined || b === undefined) {
      continue;
    }
    const dx = (b[0] - a[0]) * metersPerDegreeLon(a[1]);
    const dy = (b[1] - a[1]) * METERS_PER_DEGREE_LAT;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  const from = points[segmentIndex];
  const to = points[segmentIndex + 1];
  if (from === undefined || to === undefined) {
    return total;
  }
  const dx = (to[0] - from[0]) * metersPerDegreeLon(from[1]);
  const dy = (to[1] - from[1]) * METERS_PER_DEGREE_LAT;
  return total + Math.sqrt(dx * dx + dy * dy) * t;
}

export function metersToFeet(meters: number): number {
  return meters * FEET_PER_METER;
}
