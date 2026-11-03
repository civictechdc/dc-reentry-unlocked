import { aUnit } from "@dc-reentry/shared/testing";
import { describe, expect, test } from "vitest";
import { pinCoordinatesFor, unitsToFeatureCollection } from "./map-config.ts";

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
