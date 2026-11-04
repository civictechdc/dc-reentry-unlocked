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

/** Id the label bubble image is registered under on the GL map. */
export const PIN_LABEL_BUBBLE_IMAGE_ID = "pin-label-bubble";

export interface PinFeatureProperties {
  id: string;
  address: string;
  addressLabel: string;
  selected: boolean;
  ward: number;
}

/**
 * Structurally trimmed pin-label text: a `<street>, <city>, <SS> <ZIP>` shape
 * (uppercase two-letter state code, five-digit ZIP, optional +4) collapses to
 * `<street>, <ZIP>` — the city name is noise at pin-label size. Anything else
 * passes through UNCHANGED, never blank: a lowercase state code is not
 * trusted as a state (USPS abbreviations are uppercase), and an address
 * without a trailing `<state> <ZIP>` segment is already as short as the rule
 * could make it. Future cities therefore need no code change, and the card
 * list, detail, and screen-reader pins keep the full address regardless.
 */
export function pinLabelText(address: string): string {
  const segments = address.split(",").map((segment) => segment.trim());
  if (segments.length < 3) return address;
  const zip = /^([A-Z]{2}) (\d{5}(?:-\d{4})?)$/.exec(segments.at(-1)!)?.[2];
  if (!zip) return address;
  const street = segments.slice(0, -2).join(", ");
  if (street.length === 0) return address;
  return `${street}, ${zip}`;
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
        addressLabel: pinLabelText(unit.address),
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
 * The label speech bubble bitmap, procedurally drawn at 2x resolution
 * (pixelRatio 2, crisp on retina) as pure typed-array math — no canvas, no
 * DOM, so it also runs in jsdom. White body, subtle gray border on the
 * straight edges AND the rounded-corner arcs, and a small tail pointing
 * DOWN toward the pin. Register it together with
 * {@link pinLabelBubbleImageMetadata}. Data must be Uint8Array:
 * texImage2D rejects Uint8ClampedArray in some browsers.
 */
export function pinLabelBubbleImage(): {
  width: number;
  height: number;
  data: Uint8Array;
} {
  // All constants are 2x pixel units (pixelRatio 2). At 1x: 44×23 bubble,
  // 16px body, 7px tail, 4px corner radius, 1px border.
  const width = 88;
  const bodyHeight = 32;
  const height = 46;
  const radius = 8;
  const border = 2;
  // Tail: centered on the image, tapering from a 24px-wide top to a tip.
  const tailTop = bodyHeight;
  const tailHalfTop = 12;
  const center = (width - 1) / 2;

  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let alpha = 0;
      if (y < bodyHeight) {
        // Rounded-rect body: corner mask keeps the four corners transparent.
        const dx = Math.max(radius - x, x - (width - 1 - radius), 0);
        const dy = Math.max(radius - y, y - (bodyHeight - 1 - radius), 0);
        if (dx * dx + dy * dy <= radius * radius) {
          // Border on the straight edges and on the rounded-corner arc ring
          // (pixels just inside the arc edge), so corners get the same
          // subtle gray frame the straight edges get.
          const onBorder =
            x < border ||
            x >= width - border ||
            y < border ||
            y >= bodyHeight - border ||
            dx * dx + dy * dy > (radius - border) * (radius - border);
          alpha = 255;
          if (onBorder) {
            // Subtle gray border.
            data[i] = 204;
            data[i + 1] = 204;
            data[i + 2] = 204;
          } else {
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
          }
        }
      } else {
        // Tail: triangle narrowing downward, kept strictly inside the fixed
        // center column so horizontal stretching can never smear it.
        const remaining = height - 1 - y;
        const half = Math.max((tailHalfTop * remaining) / (height - 1 - tailTop), 0.6);
        if (Math.abs(x - center) <= half) {
          alpha = 255;
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
        }
      }
      data[i + 3] = alpha;
    }
  }

  return { width, height, data };
}

/**
 * The stretch/content registration metadata for the bubble bitmap, passed
 * through the options argument of the PUBLIC `Map.addImage(id, image,
 * options)`: the runtime takes only `{width, height, data}` from the image
 * object and reads `pixelRatio`/`sdf`/`stretchX`/`stretchY`/`content` from
 * the options — metadata placed inside the image object would silently
 * never reach the renderer (the bubble would stretch wholesale: smeared
 * tail, elliptical corners, growing border, pixelRatio 1). `stretchX` holds
 * TWO bands flanking a fixed center column that contains the tail (the
 * tail can never smear horizontally), `stretchY` holds ONE band in the body
 * above the tail rows (the height stretches for wrapped text; the tail
 * rows can never stretch), and `content` marks the interior text box.
 */
export function pinLabelBubbleImageMetadata(): {
  pixelRatio: number;
  sdf: false;
  stretchX: Array<[number, number]>;
  stretchY: Array<[number, number]>;
  content: [number, number, number, number];
} {
  return {
    pixelRatio: 2,
    sdf: false,
    // Two horizontal bands flank the fixed center column (columns 30..57)
    // that contains the tail's full span.
    stretchX: [
      [10, 29],
      [58, 77],
    ],
    // One vertical band in the body above the tail rows: the height
    // stretches with wrapped text; the 7 bitmap rows above the tail
    // (rows 25..31, i.e. 3.5px at 1x with pixelRatio 2) and the tail
    // itself stay fixed.
    stretchY: [[8, 24]],
    // The interior text box spans the stretchable interior across the center.
    content: [10, 8, 78, 28],
  };
}

/**
 * Text-on-bubble symbol layer: the procedurally drawn speech bubble is
 * stretched behind the address text on the SAME layer (`icon-text-fit`
 * "both"), so the opaque bubble separates the text from the tiles and the
 * halo paint is gone. Both allow-overlap flags stay on so collision
 * detection can never suppress the cue; the sibling `*-overlap` options are
 * intentionally never set because the two overlap mechanisms fight each
 * other. Placement is empirical (the fitted composite's anchor semantics
 * are not style-spec-guaranteed): measured in the real browser, the fitted
 * bubble centers on the anchor point and `icon-anchor`/`icon-offset` proved
 * inert under the fit — the bubble simply covered the pin — so the
 * composite is lifted by `text-offset` instead, putting the ink above the
 * ring with the tail reaching into the pin's top. The caller supplies the
 * initial filter (an explicit no-match filter when idle) so the layer can
 * be added to the style without labeling anything.
 */
export function pinLabelLayerDefinition(initialFilter: unknown[]): Record<string, unknown> {
  return {
    id: "units-pins-label",
    type: "symbol",
    source: PIN_SOURCE,
    layout: {
      "icon-image": PIN_LABEL_BUBBLE_IMAGE_ID,
      "icon-text-fit": "both",
      "icon-text-fit-padding": [8, 12, 8, 12],
      "text-field": ["get", "addressLabel"],
      "text-offset": [0, -1.4],
      "text-max-width": 18,
      "icon-allow-overlap": true,
      "text-allow-overlap": true,
    },
    paint: {
      "text-color": "#1f2937",
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
