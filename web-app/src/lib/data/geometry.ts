/**
 * Pure geometric helpers for the D.C. sample data.
 *
 * All functions are side-effect free and take coordinates as decimal degrees
 * (WGS 84). Polygon coordinates follow the GeoJSON `[longitude, latitude]`
 * order.
 */

/** Inclusive bounding rectangle used for candidate generation. */
export const DC_RECTANGLE = {
  latMin: 38.8,
  latMax: 38.95,
  lonMin: -77.05,
  lonMax: -76.9,
} as const

/** One polygon ring: an ordered list of `[longitude, latitude]` positions. */
export type Ring = readonly (readonly number[])[]

/** Simplified DC boundary — a 4-corner "diamond" around the District. */
export const DC_BOUNDARY: Ring = [
  [-77.027, 38.9955], // N
  [-76.909, 38.927], // E
  [-77.036, 38.7916], // S
  [-77.1197, 38.883], // W
]

/**
 * Whether `(lat, lon)` lies inside the inclusive D.C. sampling rectangle.
 *
 * Note: the rectangle does NOT cover the whole D.C. polygon — it clips off
 * western and northwestern D.C. Generated houses must satisfy BOTH
 * constraints: inside this rectangle AND inside the boundary polygon
 * (`pointInPolygon`).
 */
export function inDCRectangle(lat: number, lon: number): boolean {
  return (
    lat >= DC_RECTANGLE.latMin &&
    lat <= DC_RECTANGLE.latMax &&
    lon >= DC_RECTANGLE.lonMin &&
    lon <= DC_RECTANGLE.lonMax
  )
}

/** Ray-casting point-in-polygon test for a single `[lon, lat]` ring. */
export function pointInPolygon(lat: number, lon: number, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}
