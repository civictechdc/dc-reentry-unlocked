import { expect, test } from "vitest";
import { Value } from "typebox/value";
import {
  FILTER_CONTROLS,
  FILTER_TARGETS,
  FilterDefinitionSchema,
  GENDERS,
  HOUSING_TYPES,
  LENGTHS_OF_STAY,
  POPULATIONS,
  UNIT_FILTERS,
  wardOptions,
} from "./index";

const singleSelect = UNIT_FILTERS.filter((f) => f.control === "single-select");
const multiSelect = UNIT_FILTERS.filter((f) => f.control === "multi-select");
const boolean = UNIT_FILTERS.filter((f) => f.control === "boolean");

test("the schema offers exactly boolean, single-select, and multi-select controls", () => {
  expect(FILTER_CONTROLS).toEqual(["boolean", "single-select", "multi-select"]);
});

test("all three control types are exercised by the published filters", () => {
  expect(singleSelect.length).toBeGreaterThan(0);
  expect(multiSelect.length).toBeGreaterThan(0);
  expect(boolean.length).toBeGreaterThan(0);
});

test("the pinned 11-filter set is complete with no duplicates", () => {
  const ids = UNIT_FILTERS.map((f) => f.id);

  expect(ids).toEqual([
    "housing-type",
    "length-of-stay",
    "population",
    "gender",
    "ward",
    "referral-required",
    "sobriety",
    "background-check",
    "sex-offense-restrictions",
    "treatment",
    "housing-vouchers",
  ]);
  expect(new Set(ids).size).toBe(ids.length);
});

const expectedControlById: Record<string, string> = {
  "housing-type": "single-select",
  "length-of-stay": "single-select",
  population: "single-select",
  gender: "single-select",
  ward: "multi-select",
  "referral-required": "boolean",
  sobriety: "boolean",
  "background-check": "boolean",
  "sex-offense-restrictions": "boolean",
  treatment: "boolean",
  "housing-vouchers": "boolean",
};

test("each filter has its literally pinned control type", () => {
  expect(UNIT_FILTERS.length).toBe(Object.keys(expectedControlById).length);
  for (const [id, control] of Object.entries(expectedControlById)) {
    const filter = UNIT_FILTERS.find((f) => f.id === id);
    expect(filter, `${id} must exist`).toBeDefined();
    expect(filter?.control, `${id} control`).toBe(control);
  }
});

const expectedTargetById: Record<string, string> = {
  "housing-type": "program.housingType",
  "length-of-stay": "program.lengthOfStay",
  population: "program.population",
  gender: "program.gender",
  ward: "unit.ward",
  "referral-required": "program.referralRequired",
  sobriety: "program.sobrietyRequired",
  "background-check": "program.backgroundCheckRequired",
  "sex-offense-restrictions": "program.sexOffenseRestrictions",
  treatment: "program.treatmentRequired",
  "housing-vouchers": "program.housingVouchersAccepted",
};

test("each filter targets its literally pinned field", () => {
  expect(UNIT_FILTERS.length).toBe(Object.keys(expectedTargetById).length);
  for (const [id, target] of Object.entries(expectedTargetById)) {
    const filter = UNIT_FILTERS.find((f) => f.id === id);
    expect(filter, `${id} must exist`).toBeDefined();
    expect(filter?.target, `${id} target`).toBe(target);
  }
});

test("every filter targets a known card field", () => {
  for (const filter of UNIT_FILTERS) {
    expect(FILTER_TARGETS, `${filter.id} target`).toContain(filter.target);
    expect(Value.Check(FilterDefinitionSchema, filter)).toBe(true);
  }
});

const expectedOptionValuesById: Record<string, string[]> = {
  "housing-type": [
    "emergency-shelter",
    "transitional",
    "permanent-supportive-housing",
    "subsidized-rental",
    "market-rate",
  ],
  "length-of-stay": [
    "emergency-nightly",
    "short-term-up-to-90-days",
    "transitional-up-to-24-months",
    "permanent-open-ended",
  ],
  population: ["individuals", "families", "both"],
  gender: ["men", "women", "all"],
  ward: ["1", "2", "3", "4", "5", "6", "7", "8"],
};

test("option value lists are literally pinned", () => {
  for (const [id, values] of Object.entries(expectedOptionValuesById)) {
    const options = UNIT_FILTERS.find((f) => f.id === id)?.options ?? [];
    expect(
      options.map((o) => o.value),
      `${id} option values`,
    ).toEqual(values);
  }
});

test("the exported taxonomy constants are those same literally pinned lists", () => {
  expect([...HOUSING_TYPES]).toEqual(expectedOptionValuesById["housing-type"]);
  expect([...LENGTHS_OF_STAY]).toEqual(expectedOptionValuesById["length-of-stay"]);
  expect([...POPULATIONS]).toEqual(expectedOptionValuesById["population"]);
  expect([...GENDERS]).toEqual(expectedOptionValuesById["gender"]);
});

test("the ward multi-select offers exactly the eight DC wards", () => {
  expect(wardOptions.map((o) => o.value)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
  expect(wardOptions[4]?.label).toBe("Ward 5");
});

test("the unknown data state is never a filter option", () => {
  for (const filter of UNIT_FILTERS) {
    for (const option of filter.options ?? []) {
      expect(option.value, `${filter.id}/${option.value}`).not.toBe("unknown");
    }
  }
});

test("boolean filters carry no option list", () => {
  for (const filter of boolean) {
    expect(filter.options).toBeUndefined();
  }
});

test("an unrecognized control type is not a valid schema value", () => {
  const first = UNIT_FILTERS[0] as unknown as Record<string, unknown>;

  expect(Value.Check(FilterDefinitionSchema, { ...first, control: "rating" })).toBe(false);
});
