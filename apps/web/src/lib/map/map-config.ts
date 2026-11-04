import type { StyleSpecification } from "maplibre-gl";
import type { UnitCard } from "@dc-reentry/shared";

/**
 * Map configuration shared by the MapLibre wrapper and the mocked component
 * tests: OpenStreetMap raster tiles WITH the required attribution, a GeoJSON
 * pin source, and circle layers only (no per-pin DOM markers).
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

/**
 * Street-level focus zoom for card selection: selecting a unit flies the map
 * to that unit's pin at this zoom. Chosen from an in-app comparison of
 * 14.5–16.5 across two wards: 16 keeps the selected building's footprint and
 * house numbers legible while neighboring streets still give orientation —
 * 16.5 loses the area context and 14.5–15 leave the building ambiguous. The
 * value is deliberately a single constant so tuning it is a one-line change.
 */
export const CARD_FOCUS_ZOOM = 16;

export const PIN_SOURCE = "units-pins";

export interface PinFeatureProperties {
  id: string;
  address: string;
  selected: boolean;
  ward: number;
}

/**
 * The single placement source for a unit's pin: `[longitude, latitude]` in
 * the order MapLibre expects. Pin features and camera focus both derive
 * from it, so a pin and the camera that flies to it can never disagree.
 */
export function pinCoordinatesFor(unit: UnitCard): [number, number] {
  return [unit.coordinates.longitude, unit.coordinates.latitude];
}

/**
 * GeoJSON features for the current result set: every pin sits at its unit's
 * own exact coordinates.
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
        coordinates: pinCoordinatesFor(unit),
      },
      properties: {
        id: unit.id,
        address: unit.address,
        selected: unit.id === selectedUnitId,
        ward: unit.ward,
      },
    })),
  };
}

/** The MapLibre paint properties for the base pin circle layer. */
export function basePinLayerPaint(): Record<string, unknown> {
  return {
    "circle-color": "#0b5fab",
    "circle-radius": 6,
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

/**
 * Text-only symbol layer that labels each pin with its unit's address. The
 * label lives above the pin (positive y offsets push text down in MapLibre,
 * so a negative y places it over the pin's top), and `text-allow-overlap`
 * keeps collision detection from ever suppressing a label. Only the halo
 * pair (`text-halo-color` + `text-halo-width`) separates the text from the
 * tiles underneath — `text-overlap` is intentionally never set, because the
 * two overlap options fight each other. The caller supplies the initial
 * filter (an explicit no-match filter when idle) so the layer can be added
 * to the style without immediately labeling anything.
 */
export function pinLabelLayerDefinition(initialFilter: unknown[]): Record<string, unknown> {
  return {
    id: "units-pins-label",
    type: "symbol",
    source: PIN_SOURCE,
    layout: {
      "text-field": ["get", "address"],
      "text-offset": [0, -1.1],
      "text-allow-overlap": true,
    },
    paint: {
      "text-color": "#1f2937",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.8,
    },
    filter: initialFilter,
  };
}

/**
 * Filter expression of the label layer: the label of one unit only while a
 * unit is active, and an explicit no-match expression when idle. An empty
 * id is used for "matches nothing" instead of handing MapLibre a null
 * filter — clearing the filter would label every pin on the map.
 */
export function pinLabelLayerFilter(unitId: string | null): unknown[] {
  return ["==", ["get", "id"], unitId ?? ""];
}
