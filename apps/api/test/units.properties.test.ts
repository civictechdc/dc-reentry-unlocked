import {
  UNIT_FILTERS,
  CoordinatesSchema,
  Value,
  UnitsResponseSchema,
  type FilterDefinition,
  type UnitCard,
} from "@dc-reentry/shared";
import { fc, test as fcTest } from "@fast-check/vitest";
import { afterAll, expect, test } from "vitest";
import { createMemoryHousingUnitsSource, type FilterSelection } from "../src/datasource";
import { buildApp } from "../src/app";
import { fixtureDataset } from "./fixtures";

/** Values a filter accepts: yes/no for booleans, pinned option values otherwise. */
function acceptedValues(definition: FilterDefinition): readonly string[] {
  if (definition.control === "boolean") return ["yes", "no"];
  return (definition.options ?? []).map((option) => option.value);
}

const pairsByFilter = UNIT_FILTERS.map((definition) => ({
  definition,
  values: acceptedValues(definition),
}));

const allPairs = pairsByFilter.flatMap(({ definition, values }) =>
  values.map((value) => [definition.id, value] as const),
);

/** Value pairs INSIDE one filter (the same filter id twice), no filtering waste. */
const sameFilterPairs: ReadonlyArray<readonly [string, string, string]> = pairsByFilter.flatMap(
  ({ definition, values }) =>
    values.flatMap((first) => values.map((second) => [definition.id, first, second] as const)),
);

function selectionArbitrary(): fc.Arbitrary<FilterSelection> {
  const perFilter = Object.fromEntries(
    pairsByFilter.map(({ definition, values }) => [
      definition.id,
      fc.option(fc.array(fc.constantFrom(...values), { maxLength: 3 }), { nil: undefined }),
    ]),
  );
  return fc.record(perFilter) as fc.Arbitrary<FilterSelection>;
}

const applySelection = (
  selection: FilterSelection,
  filterId: string,
  values: readonly string[] | undefined,
): FilterSelection => {
  const clone: Record<string, readonly string[] | undefined> = { ...selection };
  if (values === undefined) {
    delete clone[filterId];
  } else {
    clone[filterId] = values;
  }
  return clone as FilterSelection;
};

const source = createMemoryHousingUnitsSource(fixtureDataset);

fcTest.prop({ first: selectionArbitrary() }, { numRuns: 80 })(
  "running the same filter selection twice returns exactly the same units",
  ({ first }) => {
    const once = source.listUnits(first);
    const twice = source.listUnits(first);
    expect(twice).toEqual(once);
  },
);

fcTest.prop(
  {
    base: selectionArbitrary(),
    extra: fc.constantFrom(...allPairs),
  },
  { numRuns: 120 },
)("adding a filter for another dimension narrows or keeps the listing", ({ base, extra }) => {
  const [filterId, value] = extra;
  const without = applySelection(base, filterId, undefined);
  const withExtra = applySelection(base, filterId, [value]);

  const before = source.listUnits(without).map((unit) => unit.id);
  const after = source.listUnits(withExtra).map((unit) => unit.id);

  expect(after.every((id) => before.includes(id))).toBe(true);
});

/** Deterministic full sweep of every within-filter value pair (no sampled skips). */
test("adding a value to a filter widens or keeps that filter's own listing for every value pair", () => {
  for (const [filterId, first, second] of sameFilterPairs) {
    const base = applySelection({}, filterId, undefined);
    const single = applySelection(base, filterId, [first]);
    const both = applySelection(base, filterId, [first, second]);

    const narrow = new Set(source.listUnits(single).map((unit) => unit.id));
    const wider = new Set(source.listUnits(both).map((unit) => unit.id));

    expect(
      [...narrow].every((id) => wider.has(id)),
      `${filterId}: ${first} then +${second} must never lose a unit`,
    ).toBe(true);
  }
});

fcTest.prop(
  {
    base: selectionArbitrary(),
    pair: fc.constantFrom(...sameFilterPairs),
  },
  { numRuns: 80 },
)(
  "adding a value to a filter widens or keeps the listing on random bases too",
  ({ base, pair }) => {
    const [filterId, first, second] = pair;
    const single = applySelection(applySelection(base, filterId, undefined), filterId, [first]);
    const both = applySelection(base, filterId, [first, second]);

    const narrow = new Set(source.listUnits(single).map((unit) => unit.id));
    const wider = new Set(source.listUnits(both).map((unit) => unit.id));

    expect([...narrow].every((id) => wider.has(id))).toBe(true);
  },
);

const appPromise = buildApp({
  unitSource: source,
  logLevel: "error",
  rateLimit: { max: 10_000, timeWindowMs: 60_000 },
});

/** Unknown-at-source coverage per filter, straight from the fixture: [filterId, unknown card id]. */
const unknownUnits: ReadonlyArray<[string, string]> = [
  ["referral-required", "referral-unknown"],
  ["sobriety", "sobriety-unknown"],
  ["background-check", "background-check-unknown"],
  ["sex-offense-restrictions", "sex-offense-unknown"],
  ["treatment", "treatment-unknown"],
  ["housing-vouchers", "voucher-unknown"],
  ["housing-type", "housing-type-unknown"],
  ["length-of-stay", "stay-unknown"],
  ["population", "population-unknown"],
  ["gender", "gender-unknown"],
];

const unknownIdsFor = new Map(unknownUnits);

test("an unknown-at-source policy always matches every no and enum selection, never a yes", async () => {
  const app = await appPromise;

  for (const { definition, values } of pairsByFilter) {
    const unknownCardId = unknownIdsFor.get(definition.id);
    if (unknownCardId === undefined) {
      // Ward is never unknown — nothing to prove for it here.
      expect(definition.control).toBe("multi-select");
      continue;
    }

    for (const value of values) {
      const ids = await app
        .inject(`/units?${definition.id}=${value}`)
        .then((response) => response.json().units.map((unit: UnitCard) => unit.id));

      if (definition.control === "boolean") {
        if (value === "no") {
          expect(ids, `${definition.id}=no must include the unknown policy card`).toContain(
            unknownCardId,
          );
        } else {
          expect(ids, `${definition.id}=yes must never invent a yes for unknown`).not.toContain(
            unknownCardId,
          );
        }
      } else {
        expect(ids, `${definition.id}=${value} includes the unknown-policy card`).toContain(
          unknownCardId,
        );
      }
    }
  }
});

fcTest.prop({ selection: selectionArbitrary() }, { numRuns: 30 })(
  "served envelopes always conform to the units contract with only available units",
  async ({ selection }) => {
    const app = await appPromise;

    const query = Object.entries(selection)
      .filter(
        (entry): entry is [string, readonly string[]] =>
          entry[1] !== undefined && entry[1].length > 0,
      )
      .flatMap(([id, values]) => values.map((value) => `${id}=${value}`))
      .join("&");

    const response = await app.inject(`/units${query ? `?${query}` : ""}`);
    const payload = response.json();

    expect(response.statusCode).toBe(200);
    expect(Value.Check(UnitsResponseSchema, payload)).toBe(true);
    expect(payload.units.every((unit: UnitCard) => unit.availabilityState === "available")).toBe(
      true,
    );
    // Every served card carries exact coordinates — the shared coordinate
    // contract is the oracle, never the response-shaping code under test —
    // and the withdrawn approximate-location marker never comes back.
    for (const unit of payload.units as UnitCard[]) {
      expect(
        Value.Check(CoordinatesSchema, unit.coordinates),
        `${unit.id} carries exact coordinates`,
      ).toBe(true);
      expect(unit, `${unit.id} carries no removed location-precision marker`).not.toHaveProperty(
        "locationPrecision",
      );
    }
  },
);

afterAll(async () => {
  (await appPromise).close();
});
