import { aUnit } from "@dc-reentry/shared/testing";
import { describe, expect, test } from "vitest";
import {
  PIN_SOURCE,
  pinCoordinatesFor,
  pinLabelLayerDefinition,
  pinLabelLayerFilter,
  unitsToFeatureCollection,
} from "./map-config.ts";

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

  test("the label layer is a text-only symbol layer on the pin source that labels each address above its pin and never hides a label", () => {
    const idleFilter = pinLabelLayerFilter(null);

    const layer = pinLabelLayerDefinition(idleFilter);

    expect(layer.type).toBe("symbol");
    expect(layer.source).toBe(PIN_SOURCE);
    expect(layer.filter).toBe(idleFilter);
    const layout = layer.layout as Record<string, unknown>;
    expect(layout["text-field"]).toEqual(["get", "address"]);
    const textOffset = layout["text-offset"] as [number, number];
    expect(textOffset[1]).toBeLessThan(0);
    expect(layout["text-allow-overlap"]).toBe(true);
    expect(layout).not.toHaveProperty("text-overlap");
    const paint = layer.paint as Record<string, unknown>;
    expect(paint["text-halo-color"]).toBe("#ffffff");
    expect(paint["text-halo-width"]).toBeGreaterThan(0);
    expect(paint["text-color"]).toBe("#1f2937");
  });

  test("the label filter matches exactly one unit while a unit is active and matches nothing while idle", () => {
    const activeFilter = pinLabelLayerFilter("unit-exact");

    expect(activeFilter).toEqual(["==", ["get", "id"], "unit-exact"]);

    const idleFilter = pinLabelLayerFilter(null);

    expect(Array.isArray(idleFilter)).toBe(true);
    expect(idleFilter).toEqual(["==", ["get", "id"], ""]);
  });
});
