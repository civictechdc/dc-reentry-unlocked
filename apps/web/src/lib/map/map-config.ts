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

/**
 * How long the pointer must rest on a pin before its address label lights:
 * short enough to feel immediate, long enough that sweeping the pointer
 * across several pins does not flicker a label on each one. Tens of
 * milliseconds; deliberately a single named constant so tuning the feel is
 * a one-line change (user-accepted 30 ms in the 2026-11-04 interactive
 * demo).
 */
export const PIN_HOVER_INTENT_DELAY_MS = 30;

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
 * Bubble geometry knobs (all bitmap rows/pixels at 2x resolution; defaults
 * produce today's 88×46 bitmap: 32-row body, 14-row tail, 8px radius, 2px
 * border). The preview harness varies these; the production default is the
 * plain zero-argument call. Values must be integers, and `tailHeight` must
 * stay ≥ 2: the tail-width formula divides by `tailHeight - 1` and the
 * border pass samples neighbors, so zero/negative/fractional values break
 * the tail shape (no runtime clamp — the knob set is internal).
 */
export interface PinLabelBubbleOptions {
  bodyHeight?: number;
  tailHeight?: number;
  radius?: number;
  border?: number;
}

/** Resolved bubble geometry shared by the bitmap and metadata builders. */
function bubbleGeometry(opts: PinLabelBubbleOptions = {}): {
  width: number;
  bodyHeight: number;
  height: number;
  radius: number;
  border: number;
  tailHalfTop: number;
} {
  const bodyHeight = opts.bodyHeight ?? 32;
  const tailHeight = opts.tailHeight ?? 14;
  return {
    width: 88,
    bodyHeight,
    height: bodyHeight + tailHeight,
    radius: opts.radius ?? 8,
    border: opts.border ?? 2,
    tailHalfTop: 12,
  };
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
export function pinLabelBubbleImage(opts: PinLabelBubbleOptions = {}): {
  width: number;
  height: number;
  data: Uint8Array;
} {
  const { width, bodyHeight, height, radius, border, tailHalfTop } = bubbleGeometry(opts);
  // Tail: centered on the image, tapering from a 24px-wide top to a tip.
  const tailTop = bodyHeight;
  const center = (width - 1) / 2;

  // The silhouette is the UNION of the rounded-rect body and the tail
  // triangle — one shape, so the border can be derived from the union's
  // boundary instead of stroking body and tail separately (a separate tail
  // stroke left the body's bottom border line running across the
  // body/tail junction, reading as two pieces).
  const inside = (x: number, y: number): boolean => {
    if (y < bodyHeight) {
      const dx = Math.max(radius - x, x - (width - 1 - radius), 0);
      const dy = Math.max(radius - y, y - (bodyHeight - 1 - radius), 0);
      return dx * dx + dy * dy <= radius * radius;
    }
    const remaining = height - 1 - y;
    const half = Math.max((tailHalfTop * remaining) / (height - 1 - tailTop), 0.6);
    return Math.abs(x - center) <= half;
  };

  const silhouette = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (inside(x, y)) silhouette[y * width + x] = 1;
    }
  }

  // Border = inside pixels within `border` of the silhouette's outside
  // (out-of-bounds counts as outside, so bitmap edges get their stroke).
  // Euclidean neighborhood: the outline keeps constant thickness around
  // corners and flows continuously around the tail's slanted edges — there
  // is no border line across the body/tail junction because those pixels
  // have only inside neighbors nearby.
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (!silhouette[y * width + x]) continue;
      let onBorder = false;
      for (let dy = -border; dy <= border && !onBorder; dy++) {
        for (let dx = -border; dx <= border && !onBorder; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (dx * dx + dy * dy > border * border) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || !silhouette[ny * width + nx]) {
            onBorder = true;
          }
        }
      }
      data[i + 3] = 255;
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
 * tail can never smear horizontally); `stretchY` and `content` share the
 * SAME vertical span — the body interior inside the border — so the text
 * box is vertically symmetric inside the body (equal bitmap-row gaps to the
 * body's top and bottom edges) and the fitted growth lands entirely in the
 * band; the tail rows below stay fixed. Unit note (style spec): padding is
 * in PIXELS, ordered [top, right, bottom, left]; `icon-text-fit: "both"`
 * fits the content rect to `text ± padding`, growing only the bands.
 */
export function pinLabelBubbleImageMetadata(opts: PinLabelBubbleOptions = {}): {
  pixelRatio: number;
  sdf: false;
  stretchX: Array<[number, number]>;
  stretchY: Array<[number, number]>;
  content: [number, number, number, number];
} {
  const { width, bodyHeight, border } = bubbleGeometry(opts);
  return {
    pixelRatio: 2,
    sdf: false,
    // Two horizontal bands flank the fixed center column (columns 30..57)
    // that contains the tail's full span.
    stretchX: [
      [10, 29],
      [58, 77],
    ],
    // One vertical band covering the body interior inside the border — the
    // same span as the content box below — so the height stretches with
    // wrapped text. The band includes the corner-arc rows, so vertical
    // growth stretches the arcs while the STRAIGHT border edges and the
    // tail stay fixed — the accepted tradeoff for the symmetric content box.
    stretchY: [[border, bodyHeight - border]],
    // The interior text box: symmetric vertically inside the body (equal
    // gaps to the top and bottom border edges), spanning the stretchable
    // interior horizontally.
    content: [10, border, width - 10, bodyHeight - border],
  };
}

/**
 * Layer knobs for the label (defaults = the user-chosen design: the
 * centering-fixed bubble, 12px vertical padding, 16px text). `textSize` is
 * the style-spec `text-size` in px; `padding` is the
 * `icon-text-fit-padding` in px, [top, right, bottom, left]; the lift is
 * the `text-offset` in em that raises the fitted composite above the pin —
 * tuned so the tail tip lands at the pin circle's CENTER (the highlight
 * radius is 9px, the base radius 6px). The value is falsifiably derived:
 * one em of text-offset moves the composite 16px, the measured text line
 * box is 17.6px (1.1 × text-size — MapLibre's nominal 1.2-em default would
 * drift 0.8px), so offset = −(lineBox/2 + padBottom + tailHeight/2) / 16 =
 * −(8.8 + 12 + 7) / 16 = −1.7375.
 */
export interface PinLabelLayerOptions {
  textSize?: number;
  padding?: [number, number, number, number];
  textOffset?: [number, number];
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
 * composite is lifted by `text-offset` instead, with the default tuned so
 * the tail tip lands on the pin circle's center. The caller supplies the
 * initial filter (an explicit no-match filter when idle) so the layer can
 * be added to the style without labeling anything.
 */
export function pinLabelLayerDefinition(
  initialFilter: unknown[],
  opts: PinLabelLayerOptions = {},
): Record<string, unknown> {
  return {
    id: "units-pins-label",
    type: "symbol",
    source: PIN_SOURCE,
    layout: {
      "icon-image": PIN_LABEL_BUBBLE_IMAGE_ID,
      "icon-text-fit": "both",
      "icon-text-fit-padding": opts.padding ?? [12, 12, 12, 12],
      "text-field": ["get", "addressLabel"],
      "text-offset": opts.textOffset ?? [0, -1.7375],
      "text-size": opts.textSize ?? 16,
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
