import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  SCHEMA_VERSION,
  UNIT_FILTERS,
  UnitCardSchema,
  ProgramSchema,
  Value,
  type FilterDefinition,
  type Program,
  type Provider,
  type FilterTarget,
  type UnitCard,
} from "@dc-reentry/shared";

/**
 * The data source seam: the ONE module that may touch the frozen dataset
 * file (enforced by the dependency-cruiser rule
 * `api-route-must-not-read-dataset-directly`). Routes reach data only
 * through the read interface exported here.
 *
 * The availability gate lives inside the source: only units whose
 * availability state is `available` ever leave it — unavailable and
 * unverified-availability rows never surface. Filter matching also lives
 * here so the unknown-at-source semantics are enforced once, not per route.
 *
 * The seam is swap-able: `createMemoryHousingUnitsSource` accepts test-only
 * builder-arranged fixtures (from the shared testing subpath) for edge
 * cases, while production loads the frozen generated dataset.
 */

/** One applied filter selection: filter id → selected values (URL shape). */
export type FilterSelection = Readonly<Record<string, readonly string[]>>;

/** Single filter value selection — string values, or a selected list. */
export type SingleFilterSelection = readonly string[];

/** The read interface routes use — no dataset internals leak through it. */
export interface HousingUnitsSource {
  /** The published filter schema (the pinned definitions from the shared contract). */
  readonly filterSchema: readonly FilterDefinition[];
  /** Available units matching the selection; no selection = every available unit. */
  listUnits(selection?: FilterSelection): readonly UnitCard[];
}

function getFilterTargetValue(card: UnitCard, target: FilterTarget): string {
  if (target === "unit.ward") {
    return String(card.ward);
  }
  if (!target.startsWith("program.")) {
    throw new Error(`Filter target ${target} is not resolvable on a unit card`);
  }
  const field = target.slice("program.".length) as keyof Program;
  const value = card.program[field];
  if (typeof value !== "string") {
    throw new Error(`Filter target ${target} resolved to a non-string program policy`);
  }
  return value;
}

/**
 * One filter's selected values match as a union: any of the chosen values
 * may match (a multi-select ward request of ward 1 and ward 2 keeps both
 * wards). Across DIFFERENT filters every selection must hold, so choosing
 * another filter narrows the result.
 */
function matchesFilterDefinition(
  card: UnitCard,
  definition: FilterDefinition,
  selected: SingleFilterSelection,
): boolean {
  const value = getFilterTargetValue(card, definition.target);
  return selected.some((choice) => matchesChoice(card, definition, value, choice));
}

function matchesChoice(
  _card: UnitCard,
  definition: FilterDefinition,
  value: string,
  choice: string,
): boolean {
  switch (definition.control) {
    case "boolean":
      // Unknown-at-source honesty: a not-publicly-listed policy matches a
      // "no" selection, never a "yes" (one is never fabricated).
      if (choice === "yes") {
        return value === "yes";
      }
      if (choice === "no") {
        return value === "no" || value === "unknown";
      }
      return false;
    case "single-select":
      // Unknown eligibility matches every enum selection; the card's
      // retained "unknown" value IS the "policy not listed" marker.
      return String(value) === choice || value === "unknown";
    case "multi-select":
      // Ward membership; a ward is never unknown.
      return String(value) === choice;
  }
}

/**
 * Pure filter matcher — exported for property-based tests of the filter
 * algebra. Unknown filter ids are ignored by the data source (route
 * validation rejects them with an invalid-filter error before reaching here).
 */
export function matchesFilterSelection(card: UnitCard, selection: FilterSelection): boolean {
  for (const definition of UNIT_FILTERS) {
    const selected = selection[definition.id];
    if (!selected || selected.length === 0) continue;
    if (!matchesFilterDefinition(card, definition, selected)) return false;
  }
  return true;
}

/**
 * Schema-driven filters are only resolvable while their target field exists
 * in the shared contract. A target pointing at a field the program contract
 * does not carry is a data-model bug — failing at source construction (the
 * same moment the dataset loads) beats a 500 on the first filtered request.
 * `program.*` fields resolve against the shared Program schema; the ward
 * target resolves on every unit card by contract.
 */
function rejectUnresolvableFilterTargets(): void {
  const programProperties = ProgramSchema.properties as Record<string, unknown>;
  for (const definition of UNIT_FILTERS) {
    if (definition.target === "unit.ward") continue;
    if (!definition.target.startsWith("program.")) {
      throw new Error(
        `Filter target ${definition.target} is neither the shared ward nor a program policy`,
      );
    }
    const field = definition.target.slice("program.".length);
    if (!(field in programProperties)) {
      throw new Error(
        `Filter target ${definition.target} has no matching field in the shared program contract`,
      );
    }
  }
}

export function createMemoryHousingUnitsSource(cards: readonly UnitCard[]): HousingUnitsSource {
  rejectUnresolvableFilterTargets();
  // The gate: only available units ever enter the served pool.
  const available: UnitCard[] = cards.filter((card) => card.availabilityState === "available");
  for (const card of available) {
    const conformance = Value.Check(UnitCardSchema, card);
    if (card.schemaVersion !== SCHEMA_VERSION || !conformance) {
      throw new Error(
        `Unit card ${card.id} does not conform to the served inventory contract (schema version: ${card.schemaVersion}, conforms: ${conformance})`,
      );
    }
  }
  return {
    filterSchema: UNIT_FILTERS,
    listUnits(selection = {}) {
      return available.filter((card) => matchesFilterSelection(card, selection));
    },
  };
}

export async function createDatasetHousingUnitsSource(
  datasetPath: string,
): Promise<HousingUnitsSource> {
  const raw = await readFile(datasetPath, "utf8");
  const dataset = JSON.parse(raw) as DatasetFile;
  // The frozen file names its own contract version; a mismatch means the
  // dataset on disk was regenerated against a different contract revision
  // than the code serves — refuse the whole dataset at boot instead of
  // answering with cards the wire contract cannot vouch for.
  if (dataset.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `Dataset ${datasetPath} carries schema version ${dataset.schemaVersion} but the contract pins ${SCHEMA_VERSION}`,
    );
  }
  const cards: UnitCard[] = [];
  for (const provider of dataset.providers) {
    for (const program of provider.programs) {
      for (const unit of program.units) {
        cards.push({
          schemaVersion: SCHEMA_VERSION,
          ...unit,
          verificationBadge: unit.availabilityConfirmed ? "confirmed" : "needs-verification",
          program,
          provider,
        });
      }
    }
  }
  return createMemoryHousingUnitsSource(cards);
}

/** Default location of the frozen generated dataset (repo root /data). */
export function defaultDatasetPath(): string {
  // src/datasource.ts → apps/api/src → apps/api → apps → repo root /data.
  return fileURLToPath(new URL("../../../data/units.v1.json", import.meta.url));
}

interface DatasetFile {
  schemaVersion: string;
  providers: Array<Provider & { programs: Array<Program & { units: DatasetUnit[] }> }>;
}
type DatasetUnit = Omit<UnitCard, "schemaVersion" | "verificationBadge" | "program" | "provider">;
