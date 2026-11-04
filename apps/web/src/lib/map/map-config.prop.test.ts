/**
 * Property-based pass (RED phase) over the map-config pin-label helpers.
 * The 8 properties encode the CONTRACT, not the implementation: trimming is
 * structural and idempotent, non-canonical shapes pass through untouched,
 * nothing ever trims blank, and the bubble bitmap's stretch/content geometry
 * invariants hold on every call. Arbitraries build domain shape constraints
 * in (canonical `<street>, <city>, <STATE> <ZIP>` composites and guaranteed
 * non-matching shapes), so no post-hoc filters decide what gets tested.
 */
import { fc, test as fcTest } from "@fast-check/vitest";
import { describe, expect, test } from "vitest";
import { aUnit } from "@dc-reentry/shared/testing";
import {
  pinLabelBubbleImage,
  pinLabelBubbleImageMetadata,
  pinLabelText,
  unitsToFeatureCollection,
} from "./map-config.ts";

const letterArb = fc.integer({ min: 0, max: 25 }).map((n) => String.fromCharCode(97 + n));
const wordArb = fc.array(letterArb, { minLength: 1, maxLength: 10 }).map((chars) => chars.join(""));
const streetArb = fc.array(wordArb, { minLength: 1, maxLength: 3 }).map((words) => words.join(" "));
const upperPairArb = fc
  .tuple(letterArb, letterArb)
  .map(([a, b]) => a.toUpperCase() + b.toUpperCase());
const lowerPairArb = fc.tuple(letterArb, letterArb).map(([a, b]) => a + b);
const zipCoreArb = fc.nat(99999).map((n) => String(n).padStart(5, "0"));
const plusFourArb = fc.nat(9999).map((n) => String(n).padStart(4, "0"));
const zipArb = fc.oneof(
  zipCoreArb,
  fc.tuple(zipCoreArb, plusFourArb).map(([c, p]) => `${c}-${p}`),
);

/** A canonical `<street>, <city>, <STATE> <ZIP>` address (street keeps commas out). */
const canonicalAddressArb = fc
  .tuple(streetArb, wordArb, upperPairArb, zipArb)
  .map(([street, city, state, zip]) => `${street}, ${city}, ${state} ${zip}`);

/** Addresses structurally GUARANTEED to lack the canonical tail shape. */
const nonMatchingAddressArb = fc.oneof(
  // single segment: never three comma-separated parts
  wordArb,
  // two segments: below the three-segment floor
  fc.tuple(streetArb, wordArb).map(([street, city]) => `${street}, ${city}`),
  // trailing state code with no ZIP
  fc
    .tuple(streetArb, wordArb, upperPairArb)
    .map(([street, city, state]) => `${street}, ${city}, ${state}`),
  // lowercase state code: not a trusted USPS abbreviation
  fc
    .tuple(streetArb, wordArb, lowerPairArb, zipArb)
    .map(([street, city, state, zip]) => `${street}, ${city}, ${state} ${zip}`),
);

const anyAddressArb = fc.oneof(
  fc.string({ maxLength: 30 }),
  canonicalAddressArb,
  nonMatchingAddressArb,
);
const nonEmptyAddressArb = fc.oneof(
  fc.string({ minLength: 1, maxLength: 30 }),
  canonicalAddressArb,
  nonMatchingAddressArb,
);

describe("pinLabelText properties", () => {
  fcTest.prop({ address: anyAddressArb }, { numRuns: 150 })(
    "trimming is idempotent: trimming an already-trimmed label changes nothing",
    ({ address }) => {
      const once = pinLabelText(address);

      expect(pinLabelText(once)).toBe(once);
    },
  );

  fcTest.prop({ address: nonMatchingAddressArb }, { numRuns: 150 })(
    "addresses outside the canonical tail shape pass through unchanged",
    ({ address }) => {
      expect(pinLabelText(address)).toBe(address);
    },
  );

  fcTest.prop(
    {
      street: streetArb,
      city: wordArb,
      state: upperPairArb,
      zip: zipArb,
    },
    { numRuns: 150 },
  )(
    "canonical addresses keep the street segments and ZIP verbatim and drop the state segment",
    ({ street, city, state, zip }) => {
      const address = `${street}, ${city}, ${state} ${zip}`;

      const label = pinLabelText(address);

      expect(label).toBe(`${street}, ${zip}`);
      expect(label.startsWith(`${street}, `)).toBe(true);
      expect(label.endsWith(`, ${zip}`)).toBe(true);
      expect(label).not.toContain(`${state} ${zip}`);
    },
  );

  fcTest.prop({ city: wordArb, street: streetArb, zip: zipArb }, { numRuns: 150 })(
    "the city name trims identically whichever city it is, DC included",
    ({ city, street, zip }) => {
      const address = `${street}, ${city}, DC ${zip}`;

      // the same structural trim must fire for a generated city…
      expect(pinLabelText(address)).toBe(`${street}, ${zip}`);
      // …and for the canonical DC example itself
      expect(pinLabelText("1440 Test Street NW, Washington, DC 20001")).toBe(
        "1440 Test Street NW, 20001",
      );
    },
  );

  fcTest.prop({ address: nonEmptyAddressArb }, { numRuns: 150 })(
    "no address ever trims to a blank label",
    ({ address }) => {
      const label = pinLabelText(address);

      expect(label.length).toBeGreaterThan(0);
    },
  );
});

describe("pinLabelBubbleImage properties", () => {
  test("the bubble bitmap is deterministic: repeated calls produce identical structure and bytes", () => {
    const first = pinLabelBubbleImage();
    const firstMetadata = pinLabelBubbleImageMetadata();

    const second = pinLabelBubbleImage();
    const secondMetadata = pinLabelBubbleImageMetadata();

    expect(second).toEqual(first);
    expect(secondMetadata).toEqual(firstMetadata);
  });

  test("the bubble bitmap always satisfies its stretch and content geometry invariants", () => {
    const image = pinLabelBubbleImage();
    const metadata = pinLabelBubbleImageMetadata();

    // byte-buffer shape
    expect(image.data.length).toBe(image.width * image.height * 4);
    // band bounds, ordering, non-overlap
    for (const [start, end] of metadata.stretchX) {
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeLessThanOrEqual(image.width);
      expect(start).toBeLessThan(end);
    }
    for (const [start, end] of metadata.stretchY) {
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeLessThanOrEqual(image.height);
      expect(start).toBeLessThan(end);
    }
    const leftBand = metadata.stretchX[0]!;
    const rightBand = metadata.stretchX[1]!;
    expect(leftBand[1], "the two stretchX bands stay ordered and apart").toBeLessThan(rightBand[0]);
    // content box inside the image
    const [contentX0, contentY0, contentX1, contentY1] = metadata.content;
    expect(contentX0).toBeGreaterThan(0);
    expect(contentY0).toBeGreaterThan(0);
    expect(contentX1).toBeLessThan(image.width);
    expect(contentY1).toBeLessThan(image.height);
    // alpha is fully opaque or fully transparent — no half-covered pixels
    for (let i = 3; i < image.data.length; i += 4) {
      expect(image.data[i]).toBeOneOf([0, 255]);
    }

    // the tail: the contiguous bottom-up block of rows whose opaque pixels
    // never reach past the left stretch band — it must live strictly
    // inside the fixed center gap between the two bands, and the vertical
    // stretch band must sit entirely above it (the tail can never stretch)
    const channel = (x: number, y: number): number => image.data[(y * image.width + x) * 4 + 3]!;
    let tailTopRow = image.height;
    let tailMinX = image.width;
    let tailMaxX = -1;
    for (let y = image.height - 1; y >= 0; y--) {
      let rowMinX = image.width;
      let rowMaxX = -1;
      for (let x = 0; x < image.width; x++) {
        if (channel(x, y) > 0) {
          rowMinX = Math.min(rowMinX, x);
          rowMaxX = Math.max(rowMaxX, x);
        }
      }
      if (rowMaxX < 0 || rowMinX < leftBand[1]) break;
      tailTopRow = y;
      tailMinX = Math.min(tailMinX, rowMinX);
      tailMaxX = Math.max(tailMaxX, rowMaxX);
    }
    expect(tailMaxX, "the tail exists").toBeGreaterThanOrEqual(0);
    expect(tailMinX).toBeGreaterThanOrEqual(leftBand[1]);
    expect(tailMaxX).toBeLessThanOrEqual(rightBand[0]);
    const [, stretchYBottom] = metadata.stretchY[0]!;
    expect(stretchYBottom, "the vertical band lies above the tail rows").toBeLessThan(tailTopRow);
  });
});

describe("unitsToFeatureCollection properties", () => {
  const unitFieldsArb = fc.record({
    id: fc.string({ minLength: 1, maxLength: 8 }),
    address: fc.string({ minLength: 1, maxLength: 60 }),
    ward: fc.integer({ min: 1, max: 8 }),
  });

  // list with index-suffixed ids (unique by construction) plus a selection
  // drawn from those ids or nothing
  const scenarioArb = fc
    .array(unitFieldsArb, { maxLength: 5 })
    .map((units) => units.map((unit, index) => ({ ...unit, id: `u${index}-${unit.id}` })))
    .chain((units) => {
      const selectionArb =
        units.length > 0
          ? fc.option(fc.constantFrom(...units.map((unit) => unit.id)), { nil: null })
          : fc.constant(null);
      return selectionArb.map((selectedUnitId) => ({ units, selectedUnitId }));
    });

  fcTest.prop({ scenario: scenarioArb }, { numRuns: 80 })(
    "pin features mirror the unit list: same count and order, same address fields, exact selected unit",
    ({ scenario }) => {
      const { units, selectedUnitId } = scenario;
      const cards = units.map((unit) =>
        aUnit()
          .withId(unit.id)
          .inWard(unit.ward)
          .withExactAddress(unit.address)
          .withCoordinates(38.9, -77.03)
          .build(),
      );

      const collection = unitsToFeatureCollection(cards, selectedUnitId);

      expect(collection.features).toHaveLength(cards.length);
      for (let index = 0; index < cards.length; index++) {
        const feature = collection.features[index]!;
        expect(feature.properties.id).toBe(cards[index]!.id);
        expect(feature.properties.address).toBe(cards[index]!.address);
        expect(feature.properties.selected).toBe(cards[index]!.id === selectedUnitId);
      }
    },
  );

  test("the feature label carries the exact trimmed string for a canonical-shaped unit", () => {
    const unit = aUnit()
      .withId("unit-canonical")
      .inWard(7)
      .withExactAddress("1440 Test Street NW, Washington, DC 20001")
      .withCoordinates(38.9254, -77.0314)
      .build();

    const collection = unitsToFeatureCollection([unit], unit.id);

    expect(collection.features[0]!.properties.addressLabel).toBe("1440 Test Street NW, 20001");
    expect(collection.features[0]!.properties.selected).toBe(true);
  });
});
