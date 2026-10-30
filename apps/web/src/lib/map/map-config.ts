import type { StyleSpecification } from "maplibre-gl";
import type { UnitCard } from "@dc-reentry/shared";
import { wardAnchor } from "./ward-anchors.ts";

/**
 * Map configuration shared by the MapLibre wrapper and the mocked component
 * tests: OpenStreetMap raster tiles WITH the required attribution, a GeoJSON
 * pin source, circle layers only (no per-pin DOM markers), and a visually
 * distinct style for approximate-location units placed at their ward anchor.
 */

/** OSM raster tile URL (attribution control carries the © notice). */
export const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/**
 * Required attribution for the OSM tiles. MapLibre renders it through the
 * attribution control from the tile source's `attribution` property.
 */
export const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function createMapStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: [OSM_TILE_URL],
        tileSize: 256,
        attribution: OSM_ATTRIBUTION,
      },
    },
    layers: [{ id: "osm-base", type: "raster", source: "osm" }],
  };
}

/** Washington DC center for the initial map view (ward 1–8 boundary focus). */
export const DC_MAP_CENTER = { lat: 38.9072, lng: -77.0369 };
export const DC_MAP_ZOOM = 12.5;

export const PIN_SOURCE = "units-pins";

export interface PinFeatureProperties {
  id: string;
  approximate: boolean;
  selected: boolean;
  ward: number;
}

/**
 * GeoJSON features for the current result set. Approximate-location units
 * (null coordinates) are placed at their ward's anchor point and marked
 * `approximate` so the layer style can render them distinctly.
 */
export function unitsToFeatureCollection(
  units: readonly UnitCard[],
  selectedUnitId: string | null = null,
): {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    id: string;
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: PinFeatureProperties;
  }>;
} {
  return {
    type: "FeatureCollection",
    features: units.map((unit) => ({
      type: "Feature",
      id: unit.id,
      geometry: {
        type: "Point",
        coordinates: [
          unit.coordinates?.longitude ?? wardAnchor(unit.ward).longitude,
          unit.coordinates?.latitude ?? wardAnchor(unit.ward).latitude,
        ] as [number, number],
      },
      properties: {
        id: unit.id,
        approximate: unit.locationPrecision === "approximate",
        selected: unit.id === selectedUnitId,
        ward: unit.ward,
      },
    })),
  };
}

/** The MapLibre paint properties for the base pin circle layer. */
export function basePinLayerPaint(): Record<string, unknown> {
  return {
    "circle-color": ["case", ["==", ["get", "approximate"], true], "#b45309", "#0b5fab"],
    "circle-radius": ["case", ["==", ["get", "approximate"], true], 4.5, 6],
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 1.5,
  };
}

/** Highlight layer paint (selected/hovered unit's pin). */
export function highlightPinLayerPaint(): Record<string, unknown> {
  return {
    "circle-color": "#d9340f",
    "circle-radius": 9,
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 2,
  };
}

/** GeoJSON source definition for the pin layer (empty until the first result set lands). */
export function pinSourceDefinition(): {
  type: "geojson";
  data: {
    type: "FeatureCollection";
    features: never[];
  };
} {
  return {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  };
}

/** Filter expression of the highlight layer: the pin of one unit only. */
export function highlightLayerFilter(unitId: string | null): unknown[] {
  return ["==", ["get", "id"], unitId ?? ""];
}
