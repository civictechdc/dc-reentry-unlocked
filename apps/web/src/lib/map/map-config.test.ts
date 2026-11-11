import { aUnit } from "@dc-reentry/shared/testing";
import { describe, expect, test } from "vitest";
import type { CameraMap } from "./map-config.ts";
import { PIN_LABEL_BG, PIN_LABEL_INK, rgbChannels } from "./map-colors.ts";
import {
  LOCALE_MAP_CENTER,
  LOCALE_MAP_ZOOM,
  PIN_LABEL_BUBBLE_IMAGE_ID,
  PIN_SOURCE,
  pinCoordinatesFor,
  pinLabelBubbleImage,
  pinLabelBubbleImageMetadata,
  pinLabelText,
  pinLabelLayerDefinition,
  pinLabelLayerFilter,
  recenterOnLocale,
  unitsToFeatureCollection,
  ZOOM_STEP,
  zoomIn,
  zoomOut,
} from "./map-config.ts";

type BubbleImage = ReturnType<typeof pinLabelBubbleImage>;

function pixelAt(image: BubbleImage, x: number, y: number): [number, number, number, number] {
  const i = (y * image.width + x) * 4;
  return [image.data[i]!, image.data[i + 1]!, image.data[i + 2]!, image.data[i + 3]!];
}

const unitInWard7 = aUnit()
  .withId("unit-exact")
  .inWard(7)
  .withCoordinates(38.9254, -77.0314)
  .build();
const unitInWard3 = aUnit()
  .withId("unit-ward3")
  .inWard(3)
  .withCoordinates(38.9364, -77.079)
  .build();

/** A tiny camera mock: records every camera call and tracks the zoom readout. */
function mockCameraMap(initialZoom: number) {
  const map = {
    currentZoom: initialZoom,
    zoomToLog: [] as number[],
    flyToLog: [] as Array<Record<string, unknown>>,
    getZoom(): number {
      return map.currentZoom;
    },
    zoomTo(zoom: number): void {
      map.currentZoom = zoom;
      map.zoomToLog.push(zoom);
    },
    flyTo(options: Record<string, unknown>): void {
      map.flyToLog.push(options);
    },
  };
  // The mock records on its raw shape; the cast carries only the camera
  // surface the operations consume (MapLibre's chainable signatures make
  // the real map structurally wider than this mock).
  return map as typeof map & CameraMap;
}

describe("camera operations", () => {
  test("zooming in steps the camera one step up from its current zoom", () => {
    const map = mockCameraMap(11);

    zoomIn(map);

    expect(map.zoomToLog).toEqual([11 + ZOOM_STEP]);
  });

  test("zooming out steps the camera one step down from its current zoom", () => {
    const map = mockCameraMap(14.5);

    zoomOut(map);

    expect(map.zoomToLog).toEqual([14.5 - ZOOM_STEP]);
  });

  test("recentering flies the camera back to the locale center at the locale zoom", () => {
    const map = mockCameraMap(18);

    recenterOnLocale(map);

    expect(map.flyToLog).toEqual([
      { center: [LOCALE_MAP_CENTER.lng, LOCALE_MAP_CENTER.lat], zoom: LOCALE_MAP_ZOOM },
    ]);
  });
});

describe("unit pin placement", () => {
  test("pinCoordinatesFor returns the unit's exact longitude and latitude in MapLibre order", () => {
    const coordinates = pinCoordinatesFor(unitInWard7);

    expect(coordinates).toEqual([
      unitInWard7.coordinates.longitude,
      unitInWard7.coordinates.latitude,
    ]);
  });

  test("every pin feature sits exactly where pinCoordinatesFor places its unit (one placement source)", () => {
    const collection = unitsToFeatureCollection([unitInWard7, unitInWard3]);

    const featureById = new Map(
      collection.features.map((feature) => [feature.properties.id, feature]),
    );
    for (const unit of [unitInWard7, unitInWard3]) {
      expect(featureById.get(unit.id)?.geometry.coordinates).toEqual(pinCoordinatesFor(unit));
    }
  });
});

describe("pin address labels", () => {
  test("every pin feature carries its unit's address as a property", () => {
    const unitWithAddress = aUnit()
      .withId("unit-labeled")
      .withExactAddress("1440 Test Street NW")
      .build();
    const otherUnit = aUnit()
      .withId("unit-neighbor")
      .withExactAddress("900 Neighbor Avenue SE")
      .build();

    const collection = unitsToFeatureCollection([unitWithAddress, otherUnit]);

    const addressById = new Map(
      collection.features.map((feature) => [feature.properties.id, feature.properties.address]),
    );
    expect(addressById.get("unit-labeled")).toBe("1440 Test Street NW");
    expect(addressById.get("unit-neighbor")).toBe("900 Neighbor Avenue SE");
  });

  test("the label layer is a text-on-bubble symbol layer on the pin source that never hides a label", () => {
    const idleFilter = pinLabelLayerFilter(null);

    const layer = pinLabelLayerDefinition(idleFilter);

    expect(layer.type).toBe("symbol");
    expect(layer.source).toBe(PIN_SOURCE);
    expect(layer.filter).toBe(idleFilter);
    const layout = layer.layout as Record<string, unknown>;
    expect(layout["icon-image"]).toBe(PIN_LABEL_BUBBLE_IMAGE_ID);
    expect(layout["icon-text-fit"]).toBe("both");
    expect(layout["icon-text-fit-padding"]).toEqual([12, 12, 12, 12]);
    expect(layout["text-size"]).toBe(16);
    expect(layout["text-field"]).toEqual(["get", "addressLabel"]);
    const textOffset = layout["text-offset"] as [number, number];
    // tuned so the rendered tail tip lands on the pin circle's center
    // (16px per em of text-offset; -1.8 measured -1px, +1/16 em corrects it)
    expect(textOffset).toEqual([0, -1.7375]);
    expect(layout["text-allow-overlap"]).toBe(true);
    expect(layout["icon-allow-overlap"]).toBe(true);
    // the fitted bubble travels with the text; the overlap siblings fight
    // the allow-overlap flags and are never set
    expect(layout).not.toHaveProperty("text-overlap");
    expect(layout).not.toHaveProperty("icon-overlap");
    const paint = layer.paint as Record<string, unknown>;
    // the opaque bubble replaces the halo pair
    expect(paint).not.toHaveProperty("text-halo-color");
    expect(paint).not.toHaveProperty("text-halo-width");
    expect(paint["text-color"]).toBe(PIN_LABEL_INK);

    const customized = pinLabelLayerDefinition(idleFilter, {
      textSize: 18,
      padding: [16, 12, 16, 12],
    });
    const customizedLayout = customized.layout as Record<string, unknown>;
    expect(customizedLayout["text-size"], "an explicit textSize override reaches the layer").toBe(
      18,
    );
    expect(
      customizedLayout["icon-text-fit-padding"],
      "an explicit padding override reaches the layer",
    ).toEqual([16, 12, 16, 12]);
  });

  test("the label filter matches exactly one unit while a unit is active and matches nothing while idle", () => {
    const activeFilter = pinLabelLayerFilter("unit-exact");

    expect(activeFilter).toEqual(["==", ["get", "id"], "unit-exact"]);

    const idleFilter = pinLabelLayerFilter(null);

    expect(Array.isArray(idleFilter)).toBe(true);
    expect(idleFilter).toEqual(["==", ["get", "id"], ""]);
  });
});

describe("the pin label text trims the city from a `<street>, <city>, <state> <zip>` address", () => {
  test.each([
    {
      address: "1440 Test Street NW, Washington, DC 20001",
      label: "1440 Test Street NW, 20001",
      because: "the canonical DC shape keeps the street and drops the city",
    },
    {
      address: "742 Evergreen Terrace, Springfield, IL 62704",
      label: "742 Evergreen Terrace, 62704",
      because: "a future non-DC city trims with no code change",
    },
    {
      address: "9 Elm Street, Boston, MA 02110-1234",
      label: "9 Elm Street, 02110-1234",
      because: "a ZIP+4 suffix survives intact",
    },
    {
      address: "500 A Street SE, Apt 3, Washington, DC 20003",
      label: "500 A Street SE, Apt 3, 20003",
      because:
        "a street containing commas keeps every segment (street = all but the last two segments)",
    },
    {
      address: "1440 Test Street NW",
      label: "1440 Test Street NW",
      because: "a single-segment address passes through unchanged",
    },
    {
      address: "1440 Test Street NW, Washington, DC",
      label: "1440 Test Street NW, Washington, DC",
      because: "a trailing segment without a ZIP passes through unchanged",
    },
    {
      address: "1440 Test Street NW, Washington, dc 20001",
      label: "1440 Test Street NW, Washington, dc 20001",
      because:
        "a lowercase state code is not trusted as a state and the address passes through unchanged",
    },
    {
      address: "1440 Test Street NW, Washington, DC 2001",
      label: "1440 Test Street NW, Washington, DC 2001",
      because: "a four-digit ZIP is not a ZIP shape and the address passes through unchanged",
    },
    {
      address: ", Washington, DC 20001",
      label: ", Washington, DC 20001",
      because: "an empty street segment keeps the address unchanged (never a blank label)",
    },
  ])("$because", ({ address, label }) => {
    expect(pinLabelText(address)).toBe(label);
  });

  test("every pin feature carries the trimmed label beside the untouched full address", () => {
    const unit = aUnit()
      .withId("unit-labeled")
      .withExactAddress("1440 Test Street NW, Washington, DC 20001")
      .build();

    const collection = unitsToFeatureCollection([unit]);

    expect(collection.features[0]!.properties.addressLabel).toBe("1440 Test Street NW, 20001");
    expect(collection.features[0]!.properties.address).toBe(
      "1440 Test Street NW, Washington, DC 20001",
    );
  });
});

describe("the pin label bubble bitmap", () => {
  const image = pinLabelBubbleImage();
  const metadata = pinLabelBubbleImageMetadata();
  const leftBand = metadata.stretchX[0]!;
  const rightBand = metadata.stretchX[1]!;

  test("the horizontal stretch bands flank a fixed center column and stay inside the bitmap", () => {
    expect(image.width % 2).toBe(0);
    expect(image.height % 2).toBe(0);
    expect(leftBand[0]).toBeGreaterThan(0);
    expect(leftBand[1]).toBeLessThan(rightBand[0]);
    expect(rightBand[1]).toBeLessThan(image.width - 1);
    // everything left of the left band, between the bands, and right of the
    // right band keeps its width when the bubble stretches
  });

  test("the tail rows keep their pixels inside the fixed center column so stretching can never smear them", () => {
    // walk up from the bottom row: the tail is the contiguous bottom block
    // of rows whose opaque pixels never reach past the left stretch band —
    // the first row that does is body, not tail
    let tailMinX = image.width;
    let tailMaxX = -1;
    let tailRows = 0;
    for (let y = image.height - 1; y >= 0; y--) {
      let rowMinX = image.width;
      let rowMaxX = -1;
      for (let x = 0; x < image.width; x++) {
        if (pixelAt(image, x, y)[3] > 0) {
          rowMinX = Math.min(rowMinX, x);
          rowMaxX = Math.max(rowMaxX, x);
        }
      }
      if (rowMaxX < 0 || rowMinX < leftBand[1]) break;
      tailRows += 1;
      tailMinX = Math.min(tailMinX, rowMinX);
      tailMaxX = Math.max(tailMaxX, rowMaxX);
    }
    expect(tailRows).toBeGreaterThan(0);
    expect(tailMinX).toBeGreaterThanOrEqual(leftBand[1]);
    expect(tailMaxX).toBeLessThanOrEqual(rightBand[0]);
  });

  test("the vertical stretch band sits inside the body above the tail rows so only the height can stretch", () => {
    const [stretchTop, stretchBottom] = metadata.stretchY[0]!;
    expect(stretchTop).toBeGreaterThan(0);
    expect(stretchBottom).toBeLessThan(image.height - 1);
    // rows below the band stay fixed: the lip above the tail cannot stretch
    let opaqueBelowBand = 0;
    for (let y = stretchBottom + 1; y < image.height; y++) {
      if (pixelAt(image, Math.floor(image.width / 2), y)[3] > 0) opaqueBelowBand += 1;
    }
    expect(opaqueBelowBand, "the fixed rows below the band carry the tail").toBeGreaterThan(0);
  });

  test("the content box sits inside the bitmap and spans the stretchable interior", () => {
    const [x0, y0, x1, y1] = metadata.content;
    expect(x0).toBeGreaterThan(0);
    expect(y0).toBeGreaterThan(0);
    expect(x1).toBeLessThan(image.width);
    expect(y1).toBeLessThan(image.height);
    expect(x0).toBeLessThanOrEqual(leftBand[0]);
    expect(x1).toBeGreaterThanOrEqual(rightBand[1]);
  });

  test("the bitmap paints distinct pixel families: transparent corners, gray border and arcs, white body, and a tail tip", () => {
    expect(pixelAt(image, 1, 1), "the rounded corner is transparent").toEqual([0, 0, 0, 0]);
    expect(pixelAt(image, 1, image.height - 1), "off-tail bottom corners are transparent").toEqual([
      0, 0, 0, 0,
    ]);
    const bodyCenter = pixelAt(image, Math.floor(image.width / 2), 16);
    expect(bodyCenter[3], "the body interior is opaque white").toBe(255);
    expect([bodyCenter[0], bodyCenter[1], bodyCenter[2]]).toEqual([...rgbChannels(PIN_LABEL_BG)]);
    const border = pixelAt(image, Math.floor(image.width / 2), 1);
    expect(border[3], "the body border is opaque").toBe(255);
    expect(border[0]).toBeLessThan(255);
    const arcPixel = pixelAt(image, 3, 3);
    expect(arcPixel[3], "the rounded-corner arc carries the gray border too").toBe(255);
    expect(arcPixel[0]).toBeLessThan(255);
    const innerCorner = pixelAt(image, 4, 4);
    expect(innerCorner[3]).toBe(255);
    expect([innerCorner[0], innerCorner[1], innerCorner[2]]).toEqual([
      ...rgbChannels(PIN_LABEL_BG),
    ]);
  });

  test("the tail renders as one piece with the body: white fill across the junction, outline flowing around the tail edges", () => {
    const bodyBottom = 31;
    // inside the silhouette at the body/tail junction: white fill, no border
    // line crossing where the two shapes meet
    expect(
      pixelAt(image, Math.floor(image.width / 2), bodyBottom),
      "no border across the junction",
    ).toEqual([...rgbChannels(PIN_LABEL_BG), 255]);
    expect(
      pixelAt(image, Math.floor(image.width / 2), bodyBottom + 2),
      "white fill continues through the junction into the tail",
    ).toEqual([...rgbChannels(PIN_LABEL_BG), 255]);
    // the body's bottom edge outside the tail span keeps its gray border
    const bottomEdge = pixelAt(image, 10, bodyBottom);
    expect(bottomEdge[3]).toBe(255);
    expect(bottomEdge[0]).toBeLessThan(255);
    // the tail's slanted edge carries the outline
    const slantedEdge = pixelAt(image, 33, bodyBottom + 2);
    expect(slantedEdge[3]).toBe(255);
    expect(slantedEdge[0]).toBeLessThan(255);
    // the outline converges on the tip: opaque, inside the fixed center gap
    const tailTip = pixelAt(image, Math.floor(image.width / 2), image.height - 1);
    expect(tailTip[3], "the tail paints a tip on the bitmap's bottom row").toBe(255);
  });

  test("the registration metadata companion carries pixel ratio two, non-SDF, and the stretch bands", () => {
    expect(metadata.pixelRatio).toBe(2);
    expect(metadata.sdf).toBe(false);
    expect(metadata.stretchX).toEqual([
      [10, 29],
      [58, 77],
    ]);
    expect(metadata.stretchY).toEqual([[2, 30]]);
    expect(metadata.content).toEqual([10, 2, 78, 30]);
    expect(image.data).toBeInstanceOf(Uint8Array);
    expect(image.data.length).toBe(image.width * image.height * 4);
  });
});
