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

/**
 * Synthetic-provenance markers served on every units payload — the same
 * disclosure sentence the frozen dataset carries in its own header. The
 * dataset loader pins the file's wording to this constant, so the
 * generator, the dataset, and the served envelope can never disagree.
 */
export const SYNTHETIC_DISCLOSURE =
  "Synthetic prototype data — fictional providers, generated addresses on real DC geography. Not real housing inventory; never contact these organizations.";

export interface HousingUnitsSource {
  /** Hard provenance marker for the served envelope (never anything else). */
  readonly synthetic: true;
  /** The disclosure sentence carried verbatim on every served payload. */
  readonly disclosure: string;
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
      // Unknown-at-source honesty: an unknown-at-source policy matches a
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

/**
 * Boot-time integrity asserts on the contact surface — the dataset is the
 * trust boundary at serving time as much as at generation time. A
 * compromised dataset must not boot into clickable real-looking contacts;
 * every served provider contact carries a fictional-only pattern: DC
 * fictional phone block, and example.org (or subdomain) email + website
 * hosts. Violations refuse the whole source with the offending contact.
 */
function rejectNonFictionalContact(cards: readonly UnitCard[]): void {
  const seenProviders = new Set<string>();
  const fictionalPhone = /^\(202\) 555-01\d\d$/;
  const fictionalEmailDomain = /^[^@\s]+@([a-z0-9-]+\.)*example\.org$/i;
  const fictionalWebsiteHost = /^https?:\/\/([a-z0-9-]+\.)*example\.org(?:\/|$)/i;

  for (const card of cards) {
    const provider = card.provider;
    if (seenProviders.has(provider.id)) continue;
    seenProviders.add(provider.id);

    if (provider.phone !== undefined && !fictionalPhone.test(provider.phone)) {
      throw new Error(
        `provider contact is not the fictional phone pattern (202) 555-01XX: ${provider.phone} (provider ${provider.id})`,
      );
    }
    if (provider.website !== undefined && !fictionalWebsiteHost.test(provider.website)) {
      throw new Error(
        `provider website is not an example.org (or subdomain) host: ${provider.website} (provider ${provider.id})`,
      );
    }
    if (provider.email !== undefined && !fictionalEmailDomain.test(provider.email)) {
      throw new Error(
        `provider email is not an example.org (or subdomain) host: ${provider.email} (provider ${provider.id})`,
      );
    }
  }
}

/**
 * Boot-time integrity assert: served unit ids become rendering and URL keys
 * everywhere downstream. One duplicate id in the dataset would silently
 * collapse or hijack keyed views — refuse the whole source with the id.
 */
function rejectDuplicateUnitIds(cards: readonly UnitCard[]): void {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const card of cards) {
    if (seen.has(card.id) && !duplicates.includes(card.id)) duplicates.push(card.id);
    seen.add(card.id);
  }
  if (duplicates.length > 0) {
    throw new Error(`dataset carries duplicate unit ids: ${duplicates.join(", ")}`);
  }
}

/**
 * Boot-time integrity asserts on the dataset's Provider → Program → Unit
 * tree: ownership in the frozen file is purely structural nesting, so the
 * ids the records carry must agree with the structure they sit in. Provider
 * ids are unique across the dataset, Program ids are globally unique, and
 * every Unit names the Program that encloses it — empty Providers and
 * Programs included, every availability state included (these checks run
 * before any availability filtering). The first violation refuses the whole
 * source: references are never repaired, duplicates never deduplicated,
 * inventory never partially served.
 */
function rejectDatasetHierarchyViolations(dataset: DatasetFile): void {
  // Deterministic category order: provider identities, then program
  // identities, then per-unit ownership.
  const providerIds = new Set<string>();
  for (const provider of dataset.providers) {
    if (providerIds.has(provider.id)) {
      throw new Error(`dataset carries duplicate provider ids: ${provider.id}`);
    }
    providerIds.add(provider.id);
  }
  const programIds = new Set<string>();
  for (const provider of dataset.providers) {
    for (const program of provider.programs) {
      if (programIds.has(program.id)) {
        throw new Error(`dataset carries duplicate program ids: ${program.id}`);
      }
      programIds.add(program.id);
    }
  }
  for (const provider of dataset.providers) {
    for (const program of provider.programs) {
      for (const unit of program.units) {
        if (unit.programId !== program.id) {
          throw new Error(
            `dataset carries unit ${unit.id} with programId ${unit.programId} but enclosing program id ${program.id}`,
          );
        }
      }
    }
  }
}

export function createMemoryHousingUnitsSource(
  cards: readonly UnitCard[],
  disclosure: string = SYNTHETIC_DISCLOSURE,
): HousingUnitsSource {
  rejectUnresolvableFilterTargets();
  rejectDuplicateUnitIds(cards);
  rejectNonFictionalContact(cards);
  if (disclosure.trim().length === 0) {
    throw new Error("the served synthetic disclosure must be a non-empty sentence");
  }
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
    synthetic: true,
    disclosure,
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
  // The dataset's own synthetic-provenance header must be intact: it is the
  // never-mistakable-for-real guarantee at the trust boundary. The header
  // disclosure becomes the served envelope's disclosure sentence.
  if (dataset.synthetic !== true) {
    throw new Error(
      `Dataset ${datasetPath} does not carry synthetic: true — refuse the whole dataset (missing or false provenance marker)`,
    );
  }
  if (typeof dataset.disclaimer !== "string" || dataset.disclaimer.trim().length === 0) {
    throw new Error(`Dataset ${datasetPath} carries no synthetic-data disclaimer sentence`);
  }
  if (dataset.disclaimer !== SYNTHETIC_DISCLOSURE) {
    throw new Error(
      `Dataset ${datasetPath} carries a disclosure that differs from the served synthetic-provenance sentence — regenerate the dataset`,
    );
  }
  // Hierarchy integrity at the trust boundary: duplicate Provider or Program
  // identities, or a Unit naming a foreign Program, refuse the whole dataset
  // before anything is projected into served inventory.
  rejectDatasetHierarchyViolations(dataset);
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
  return createMemoryHousingUnitsSource(cards, dataset.disclaimer);
}

/** Default location of the frozen generated dataset (repo root /data). */
export function defaultDatasetPath(): string {
  // src/datasource.ts → apps/api/src → apps/api → apps → repo root /data.
  return fileURLToPath(new URL("../../../data/units.json", import.meta.url));
}

interface DatasetFile {
  schemaVersion: string;
  synthetic: boolean;
  disclaimer: string;
  providers: Array<Provider & { programs: Array<Program & { units: DatasetUnit[] }> }>;
}
type DatasetUnit = Omit<UnitCard, "schemaVersion" | "verificationBadge" | "program" | "provider">;
