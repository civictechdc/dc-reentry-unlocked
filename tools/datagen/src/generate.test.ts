import { expect, test } from "vitest";
import { fc, test as fcTest } from "@fast-check/vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Value } from "@dc-reentry/shared";
import {
  POLICY_STATES,
  ProviderSchema,
  ProgramSchema,
  UnitSchema,
  type Provider as SharedProvider,
  type Program as SharedProgram,
  type Unit as SharedUnit,
} from "@dc-reentry/shared";
import { getCorpus } from "./corpus.ts";
import { distanceToLine, pointStrictlyInside } from "./geometry.ts";
import {
  DEFAULT_SEED,
  TARGET_UNITS_MAX,
  TARGET_UNITS_MIN,
  datasetUnitCount,
  generateDataset,
  serializeDataset,
  streetNumberRange,
} from "./generate.ts";
import type { Dataset } from "./generate.ts";

const corpus = await getCorpus();

function datasetUnits(dataset: Dataset): SharedUnit[] {
  return dataset.providers.flatMap((provider) =>
    provider.programs.flatMap((program) => program.units),
  );
}

function datasetPrograms(dataset: Dataset): SharedProgram[] {
  return dataset.providers.flatMap((provider) => provider.programs);
}

test("regenerating with the fixed default seed is byte-identical", () => {
  const first = generateDataset(DEFAULT_SEED, corpus);
  const second = generateDataset(DEFAULT_SEED, corpus);
  expect(serializeDataset(second)).toBe(serializeDataset(first));
});

test("the dataset carries the synthetic disclosure in a fixed header block", () => {
  const dataset = generateDataset(DEFAULT_SEED, corpus);
  expect(dataset.synthetic).toBe(true);
  expect(
    dataset.disclaimer.length,
    "a human-readable disclaimer is always present",
  ).toBeGreaterThan(20);
  expect(dataset.disclaimer).toMatch(/[Ss]ynthetic/);
  expect(dataset.disclaimer).toMatch(/never contact/);
  expect(dataset.seed).toBe(DEFAULT_SEED);
  expect(dataset.generation.generator).toContain("datagen");
  expect(dataset.generation.rng).toContain("mulberry32");
  expect(dataset.generation.corpusFormat).toBe(corpus.format);
});

test("the frozen dataset file matches regeneration byte for byte", async () => {
  const dataset = generateDataset(DEFAULT_SEED, corpus);
  const target = fileURLToPath(new URL("../../../data/units.v1.json", import.meta.url));
  const frozen = await readFile(target, "utf8");
  expect(
    frozen,
    "regenerate the frozen dataset with `pnpm datagen` after changing the generator or corpus",
  ).toBe(serializeDataset(dataset));
});

test("a different seed produces different bytes, not a disguised copy", () => {
  const a = serializeDataset(generateDataset(101, corpus));
  const b = serializeDataset(generateDataset(102, corpus));
  expect(a).not.toBe(b);
});

test("the default-seed unit count stays inside the 1,000–1,500 envelope", () => {
  const dataset = generateDataset(DEFAULT_SEED, corpus);
  const count = datasetUnitCount(dataset);
  expect(count).toBeGreaterThanOrEqual(TARGET_UNITS_MIN);
  expect(count).toBeLessThanOrEqual(TARGET_UNITS_MAX);
});

/* ------------------------------------------------------------------ */
/* Structural + geographic invariants shared by the seed checks         */
/* ------------------------------------------------------------------ */

const APPROX_SHARE_MIN = 0.14;
const APPROX_SHARE_MAX = 0.27;

/** The quadrants actually reachable in a ward, from the corpus street pieces. */
function wardReachableQuadrants(ward: number): Set<string> {
  const quadrants = new Set<string>();
  for (const street of corpus.streets) {
    if (street.pieces.some((piece) => piece.ward === ward)) {
      quadrants.add(street.quadrant);
    }
  }
  return quadrants;
}

const ADDRESS_PATTERN = /^(\d+) (.+), Washington, DC (\d{5})$/;

function assertStructuralInvariants(dataset: Dataset): void {
  const units = datasetUnits(dataset);
  const programs = datasetPrograms(dataset);
  const label = `seed ${dataset.seed}`;

  expect(units.length).toBeGreaterThanOrEqual(TARGET_UNITS_MIN);
  expect(units.length).toBeLessThanOrEqual(TARGET_UNITS_MAX);

  // Schema conformance for every record, across all three layers.
  for (const unit of units) {
    expect(Value.Check(UnitSchema, unit), `unit conforms (${dataset.seed}): ${unit.id}`).toBe(true);
  }
  for (const program of programs) {
    expect(
      Value.Check(ProgramSchema, program),
      `program conforms (${dataset.seed}): ${program.id}`,
    ).toBe(true);
  }
  for (const provider of dataset.providers) {
    expect(
      Value.Check(ProviderSchema, provider as unknown as SharedProvider),
      `provider conforms (${dataset.seed}): ${provider.id}`,
    ).toBe(true);
  }

  // Cards resolve through the hierarchy: every unit names a program under
  // the same provider it appears under.
  const programIdsByProvider = new Map<string, Set<string>>();
  for (const provider of dataset.providers) {
    for (const program of provider.programs) {
      let ids = programIdsByProvider.get(provider.id);
      if (!ids) {
        ids = new Set();
        programIdsByProvider.set(provider.id, ids);
      }
      ids.add(program.id);
      expect(program.units.every((unit) => unit.programId === program.id)).toBe(true);
    }
  }

  // Ward coverage: every ward 1–8 has units, and both location precisions
  // in every ward.
  for (let ward = 1; ward <= 8; ward++) {
    const wardUnits = units.filter((unit) => unit.ward === ward);
    expect(wardUnits.length, `ward ${ward} has units (${label})`).toBeGreaterThan(0);
    expect(
      wardUnits.some((unit) => unit.locationPrecision === "exact"),
      `ward ${ward} has an exact location (${label})`,
    ).toBe(true);
    expect(
      wardUnits.some((unit) => unit.locationPrecision === "approximate"),
      `ward ${ward} has an approximate location (${label})`,
    ).toBe(true);
  }

  // All three availability states exist; both confirmation flags exist
  // among the available units.
  for (const state of ["available", "not-available", "unverified-availability"] as const) {
    expect(
      units.some((unit) => unit.availabilityState === state),
      `${state} exists (${label})`,
    ).toBe(true);
  }
  expect(
    units.some((unit) => unit.availabilityState === "available" && unit.availabilityConfirmed),
    `confirmed available units exist (${label})`,
  ).toBe(true);
  expect(
    units.some((unit) => unit.availabilityState === "available" && !unit.availabilityConfirmed),
    `needs-verification available units exist (${label})`,
  ).toBe(true);

  // Approximate share stays realistic and bounded.
  const approxShare =
    units.filter((unit) => unit.locationPrecision === "approximate").length / units.length;
  expect(approxShare).toBeGreaterThanOrEqual(APPROX_SHARE_MIN);
  expect(approxShare).toBeLessThanOrEqual(APPROX_SHARE_MAX);

  // Unknown states surface on all 10 unknown-capable fields (ward is the
  // multi-select filter and cannot be unknown).
  const taxonomyFields = ["housingType", "lengthOfStay", "population", "gender"] as const;
  const policyFields = [
    "referralRequired",
    "sobrietyRequired",
    "backgroundCheckRequired",
    "sexOffenseRestrictions",
    "treatmentRequired",
    "housingVouchersAccepted",
  ] as const;
  for (const field of taxonomyFields) {
    expect(
      programs.some((program) => program[field] === "unknown"),
      `${field} unknown exists (${label})`,
    ).toBe(true);
  }
  for (const field of policyFields) {
    expect(
      programs.some((program) => program[field] === "unknown"),
      `${field} policy unknown exists (${label})`,
    ).toBe(true);
    expect(
      programs.every((program) => (POLICY_STATES as readonly string[]).includes(program[field])),
      `${field} values stay in the pinned policy states (${label})`,
    ).toBe(true);
  }

  // Fictional providers are unique and carry contacts.
  const organizations = dataset.providers.map((provider) => provider.organization);
  expect(new Set(organizations).size, `organization names unique (${label})`).toBe(
    organizations.length,
  );
}

function assertExactUnitGeography(unit: SharedUnit): void {
  if (unit.locationPrecision !== "exact") {
    expect(unit.coordinates, `approximate unit has null coordinates: ${unit.id}`).toBeNull();
    expect(unit.address).toBe(`Ward ${unit.ward} (approximate location)`);
    // Ward-level locations keep quadrants the ward's streets can actually
    // carry — no impossible ward/quadrant pairs on the map.
    const reachable = wardReachableQuadrants(unit.ward);
    if (!reachable.has(unit.quadrant)) {
      throw new Error(
        `approximate unit ${unit.id} carries quadrant ${unit.quadrant}, unreachable in ward ${unit.ward}`,
      );
    }
    return;
  }
  const coords = unit.coordinates;
  if (!coords) {
    throw new Error(`exact unit ${unit.id} lacks coordinates`);
  }
  const match = ADDRESS_PATTERN.exec(unit.address);
  if (!match) {
    throw new Error(`unparsable exact address: ${unit.address}`);
  }
  const number = Number(match[1]);
  const streetPart = match[2] ?? "";
  const zipCode = match[3] ?? "";
  const quadrantMatch = /(NW|NE|SE|SW)$/.exec(streetPart);
  if (!quadrantMatch) {
    throw new Error(`address without a quadrant: ${unit.address}`);
  }
  const quadrant = quadrantMatch[1] ?? "";
  const name = streetPart.slice(0, streetPart.length - quadrant.length - 1);

  const street = corpus.streets.find((entry) => entry.name === name && entry.quadrant === quadrant);
  if (!street) {
    throw new Error(`address names a street outside the corpus: ${unit.address}`);
  }
  expect(unit.quadrant === quadrant, `quadrant matches the street: ${unit.id}`).toBe(true);

  // The point stays strictly inside its ward's real boundary.
  const ward = corpus.wards.find((entry) => entry.id === unit.ward);
  if (!ward) {
    throw new Error(`missing ward ${unit.ward} in the corpus`);
  }
  expect(
    pointStrictlyInside(ward.geometry, coords.longitude, coords.latitude, 1e-6),
    `unit ${unit.id} sits strictly inside its ward ${unit.ward}`,
  ).toBe(true);

  // ... and lies on the real street geometry (its ward piece).
  const pieces = street.pieces.filter((piece) => piece.ward === unit.ward);
  expect(
    pieces.length,
    `street ${street.name} ${street.quadrant} reaches ward ${unit.ward}`,
  ).toBeGreaterThan(0);
  const distance = Math.min(
    ...pieces.map((piece) => distanceToLine(piece.poly, coords.longitude, coords.latitude)),
  );
  expect(distance, `unit ${unit.id} on the real street`).toBeLessThanOrEqual(2e-6);

  // ... and inside exactly one ZIP polygon that matches the address ZIP.
  const hits = corpus.zips
    .filter(
      (zip) =>
        coords.longitude >= zip.minX &&
        coords.longitude <= zip.maxX &&
        coords.latitude >= zip.minY &&
        coords.latitude <= zip.maxY &&
        pointStrictlyInside(zip.geometry, coords.longitude, coords.latitude, 0),
    )
    .map((zip) => zip.code);
  expect(hits, `exactly one ZIP for unit ${unit.id}`).toEqual([zipCode]);

  // Building numbers come from the plausible per-street range, never from
  // real listing data.
  const range = streetNumberRange(street);
  expect(number, `building number within range for unit ${unit.id}`).toBeGreaterThanOrEqual(
    range.min,
  );
  expect(number, `building number within range for unit ${unit.id}`).toBeLessThanOrEqual(range.max);
}

const DOCUMENTED_SEEDS = [1, 2, 3, 4, 5, 42, 1234, 98765, 777, DEFAULT_SEED] as const;

test("structural and geographic invariants hold for every documented seed", async () => {
  for (const seed of DOCUMENTED_SEEDS) {
    const dataset = generateDataset(seed, corpus);
    assertStructuralInvariants(dataset);
    for (const unit of datasetUnits(dataset)) {
      assertExactUnitGeography(unit);
    }
  }
}, 600_000);

fcTest.prop({ seed: fc.integer({ min: 1, max: 2000 }) }, { numRuns: 6, timeout: 600_000 })(
  "structural and geographic invariants, and byte-identical regeneration, hold for arbitrary seeds drawn by fast-check",
  ({ seed }) => {
    const dataset = generateDataset(seed, corpus);
    assertStructuralInvariants(dataset);
    for (const unit of datasetUnits(dataset)) {
      assertExactUnitGeography(unit);
    }
    expect(serializeDataset(generateDataset(seed, corpus)), `same-seed bytes equal (${seed})`).toBe(
      serializeDataset(dataset),
    );
  },
);
