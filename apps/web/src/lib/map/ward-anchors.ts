/**
 * Ward centroid anchors derived from the committed geography corpus
 * (`data/geography/wards.json`) by an area-weighted polygon centroid of each
 * ward boundary.
 *
 * Datum provenance (license CC BY 4.0):
 * "Wards from 2022 (Washington DC GIS Open Data)" — Office of Planning,
 * Government of the District of Columbia; publisher OCTO;
 * https://opendata.dc.gov/api/download/v1/items/c5cd8b40fb784548a6680aead5f919ed/geojson?layers=53
 * (geometry filtered and simplified in the corpus).
 */
export interface WardAnchor {
  ward: number;
  latitude: number;
  longitude: number;
}

export const WARD_ANCHORS: WardAnchor[] = [
  { ward: 1, latitude: 38.925518, longitude: -77.031413 },
  { ward: 2, latitude: 38.900042, longitude: -77.046357 },
  { ward: 3, latitude: 38.936374, longitude: -77.078987 },
  { ward: 4, latitude: 38.963836, longitude: -77.034147 },
  { ward: 5, latitude: 38.925422, longitude: -76.985496 },
  { ward: 6, latitude: 38.881881, longitude: -77.010804 },
  { ward: 7, latitude: 38.887189, longitude: -76.949425 },
  { ward: 8, latitude: 38.841672, longitude: -77.006313 },
];

export function wardAnchor(ward: number): WardAnchor {
  return WARD_ANCHORS.find((anchor) => anchor.ward === ward) ?? WARD_ANCHORS[0]!;
}
