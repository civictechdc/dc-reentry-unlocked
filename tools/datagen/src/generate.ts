/**
 * The synthetic dataset generator. Given a seed and the geography corpus it
 * emits the Provider → Program → Unit hierarchy with fictional organizations,
 * plausible-but-generated building numbers on real street geometry, and
 * honest unknown states across every filter field.
 *
 * Determinism contract: the output bytes are a pure function of (seed,
 * corpus). No wall-clock, no crypto, no Math.random anywhere on this path.
 * The bytes are consumed by serializeDataset → data/units.json.
 */
import type {
  AvailabilityState,
  HousingType,
  LengthOfStay,
  Population,
  Gender,
  PolicyState,
  RoomType,
  Unit,
} from "@dc-reentry/shared";
import { SCHEMA_VERSION, ROOM_TYPES } from "@dc-reentry/shared";
import {
  distanceAlongLineMeters,
  interpolateSegment,
  lineLengthMeters,
  metersToFeet,
  pointStrictlyInside,
  type PolygonGeometry,
} from "./geometry.ts";
import type { Corpus, Street, StreetPiece } from "./corpus.ts";
import {
  hashString,
  chance,
  intInRange,
  mulberry32,
  shuffle,
  weightedPick,
  type Rng,
} from "./rng.ts";
import { applicationProcess, generateContacts, organizationName, programName } from "./naming.ts";

/** Fixed default seed for the frozen dataset. */
export const DEFAULT_SEED = 20261029;
/** Unit-count target inside the performance envelope. */
export const DEFAULT_TARGET_UNITS = 1200;
export const TARGET_UNITS_MIN = 1000;
export const TARGET_UNITS_MAX = 1500;

const ROUND_DECIMALS = 6;
/** Interior margin for sampled coordinates: survives 6-decimal rounding. */
const WARD_INTERIOR_MARGIN_DEG = 3e-5;
const UNIT_SAMPLING_ATTEMPTS = 400;

const WARD_WEIGHTS: readonly (readonly [number, number])[] = [
  [1, 14],
  [2, 12],
  [3, 13],
  [4, 12],
  [5, 13],
  [6, 11],
  [7, 13],
  [8, 12],
];

const ROOM_TYPE_BY_HOUSING_TYPE: Record<string, readonly [string, number][]> = {
  "emergency-shelter": [
    ["shared-room", 65],
    ["private-room", 35],
  ],
  transitional: [
    ["private-room", 60],
    ["shared-room", 40],
  ],
  "permanent-supportive-housing": [
    ["private-room", 40],
    ["efficiency", 35],
    ["apartment", 25],
  ],
  "subsidized-rental": [
    ["efficiency", 40],
    ["apartment", 50],
    ["private-room", 10],
  ],
  "market-rate": [
    ["apartment", 70],
    ["efficiency", 30],
  ],
  unknown: [
    ["private-room", 30],
    ["shared-room", 20],
    ["efficiency", 30],
    ["apartment", 20],
  ],
};

const SQUARE_FEET_BY_ROOM_TYPE: Record<string, readonly [number, number]> = {
  "shared-room": [80, 180],
  "private-room": [120, 260],
  efficiency: [280, 480],
  apartment: [500, 1150],
};

/** Apartment bedroom counts: always at least one separate bedroom. */
const BEDROOMS_WEIGHTS: readonly (readonly [number, number])[] = [
  [1, 45],
  [2, 18],
  [3, 7],
];

const MONTHLY_COST_RANGE_BY_HOUSING_TYPE: Record<string, readonly [number, number]> = {
  "emergency-shelter": [0, 80],
  transitional: [150, 650],
  "permanent-supportive-housing": [0, 250],
  "subsidized-rental": [250, 1000],
  "market-rate": [1300, 2600],
  unknown: [400, 1200],
};

const HOUSING_TYPE_WEIGHTS: readonly (readonly [HousingType, number])[] = [
  ["emergency-shelter", 8],
  ["transitional", 22],
  ["permanent-supportive-housing", 32],
  ["subsidized-rental", 28],
  ["market-rate", 10],
];
const HOUSING_TYPE_UNKNOWN_SHARE = 0.08;

const LENGTH_OF_STAY_BY_HOUSING_TYPE: Record<string, readonly (readonly [LengthOfStay, number])[]> =
  {
    "emergency-shelter": [["emergency-nightly", 85]],
    transitional: [["transitional-up-to-24-months", 80]],
    "permanent-supportive-housing": [["permanent-open-ended", 85]],
    "subsidized-rental": [
      ["permanent-open-ended", 50],
      ["short-term-up-to-90-days", 20],
    ],
    "market-rate": [
      ["permanent-open-ended", 40],
      ["short-term-up-to-90-days", 30],
    ],
    unknown: [],
  };
const LENGTH_OF_STAY_UNKNOWN_SHARE = 0.15;

const POPULATION_WEIGHTS: readonly (readonly [Population, number])[] = [
  ["individuals", 55],
  ["families", 12],
  ["both", 25],
];
const POPULATION_UNKNOWN_SHARE = 0.08;

const GENDER_WEIGHTS: readonly (readonly [Gender, number])[] = [
  ["men", 30],
  ["women", 30],
  ["all", 32],
];
const GENDER_UNKNOWN_SHARE = 0.08;

const POLICY_WEIGHTS: Record<
  keyof PolicyFields,
  readonly (readonly [Exclude<PolicyState, "unknown">, number] | readonly [PolicyState, number])[]
> = {
  referralRequired: [
    ["yes", 45],
    ["no", 25],
    ["unknown", 30],
  ],
  sobrietyRequired: [
    ["yes", 40],
    ["no", 35],
    ["unknown", 25],
  ],
  backgroundCheckRequired: [
    ["yes", 55],
    ["no", 20],
    ["unknown", 25],
  ],
  sexOffenseRestrictions: [
    ["yes", 35],
    ["no", 25],
    ["unknown", 40],
  ],
  treatmentRequired: [
    ["yes", 30],
    ["no", 35],
    ["unknown", 35],
  ],
  housingVouchersAccepted: [
    ["yes", 45],
    ["no", 35],
    ["unknown", 20],
  ],
};

export interface PolicyFields {
  referralRequired: PolicyState;
  sobrietyRequired: PolicyState;
  backgroundCheckRequired: PolicyState;
  sexOffenseRestrictions: PolicyState;
  treatmentRequired: PolicyState;
  housingVouchersAccepted: PolicyState;
}

const PROGRAMS_PER_PROVIDER: readonly (readonly [number, number])[] = [
  [1, 2],
  [2, 2],
  [3, 1],
];
const UNITS_PER_PROGRAM: readonly (readonly [number, number])[] = [
  [1, 3],
  [2, 3],
  [3, 2],
  [4, 1],
  [5, 1],
];

const AVAILABLE_SHARE = 0.76;
const NOT_AVAILABLE_SHARE = 0.12;
const CONFIRMED_SHARE_WHEN_AVAILABLE = 0.6;

export interface DatasetProgram {
  id: string;
  name: string;
  applicationProcess?: string;
  housingType: HousingType;
  lengthOfStay: LengthOfStay;
  population: Population;
  gender: Gender;
  referralRequired: PolicyState;
  sobrietyRequired: PolicyState;
  backgroundCheckRequired: PolicyState;
  sexOffenseRestrictions: PolicyState;
  treatmentRequired: PolicyState;
  housingVouchersAccepted: PolicyState;
  units: Unit[];
}

export interface DatasetProvider {
  id: string;
  organization: string;
  phone?: string;
  email?: string;
  website?: string;
  programs: DatasetProgram[];
}

export interface Dataset {
  schemaVersion: typeof SCHEMA_VERSION;
  /** Machine-readable synthetic marker: every record below is generated. */
  synthetic: true;
  disclaimer: string;
  seed: number;
  generation: DatasetGeneration;
  providers: DatasetProvider[];
}

export interface DatasetGeneration {
  generator: string;
  corpusFormat: string;
  rng: string;
}

export const SYNTHETIC_DISCLAIMER =
  "Synthetic prototype data — fictional providers, generated addresses on real DC geography. " +
  "Not real housing inventory; never contact these organizations.";

export const GENERATOR_ID = "@dc-reentry/datagen (pnpm datagen)";
const RNG_ID = "mulberry32 (fixed default seed, no wall-clock on the generation path)";

/**
 * Stable serialization: fixed object-insertion order, 2-space indent,
 * trailing newline. The same function is used by the CLI and the suites, so
 * byte-identical regeneration is checkable anywhere.
 */
export function serializeDataset(dataset: Dataset): string {
  return `${JSON.stringify(dataset, null, 2)}\n`;
}

/* ------------------------------------------------------------------ */
/* Geography context                                                   */
/* ------------------------------------------------------------------ */

interface WardPieceRef {
  streetIndex: number;
  pieceIndex: number;
}

interface GenerationContext {
  wardPieces: Map<number, WardPieceRef[]>;
  zips: {
    code: string;
    geometry: PolygonGeometry;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }[];
}

function buildContext(corpus: Corpus): GenerationContext {
  const wardPieces = new Map<number, WardPieceRef[]>();
  for (let streetIndex = 0; streetIndex < corpus.streets.length; streetIndex++) {
    const street = corpus.streets[streetIndex];
    if (!street) {
      continue;
    }
    for (let pieceIndex = 0; pieceIndex < street.pieces.length; pieceIndex++) {
      const piece = street.pieces[pieceIndex];
      if (!piece) {
        continue;
      }
      let refs = wardPieces.get(piece.ward);
      if (!refs) {
        refs = [];
        wardPieces.set(piece.ward, refs);
      }
      refs.push({ streetIndex, pieceIndex });
    }
  }
  for (let ward = 1; ward <= 8; ward++) {
    if ((wardPieces.get(ward)?.length ?? 0) === 0) {
      throw new Error(`no street pieces in the corpus for ward ${ward}`);
    }
  }
  const zips = corpus.zips.map((zip) => ({
    code: zip.code,
    geometry: zip.geometry,
    minX: zip.minX,
    minY: zip.minY,
    maxX: zip.maxX,
    maxY: zip.maxY,
  }));
  return { wardPieces, zips };
}

interface WardSample {
  street: Street;
  piece: StreetPiece;
  segmentIndex: number;
  t: number;
  x: number;
  y: number;
  zipCode: string;
}

/** Samples a point on a ward-interior street piece that lies in exactly one ZIP. */
function sampleExactLocation(
  rng: Rng,
  context: GenerationContext,
  corpus: Corpus,
  ward: number,
): WardSample {
  const refs = context.wardPieces.get(ward);
  if (!refs || refs.length === 0) {
    throw new Error(`no street pieces for ward ${ward}`);
  }
  const wardRings = corpus.wards.find((w) => w.id === ward);
  if (!wardRings) {
    throw new Error(`corpus lacks ward ${ward}`);
  }
  let lastError = "no attempt succeeded";
  for (let attempt = 0; attempt < UNIT_SAMPLING_ATTEMPTS; attempt++) {
    const ref = refs[intInRange(rng, 0, refs.length - 1)];
    if (!ref) {
      continue;
    }
    const street = corpus.streets[ref.streetIndex];
    const piece = street?.pieces[ref.pieceIndex];
    if (!street || !piece || piece.poly.length < 2) {
      continue;
    }
    const segmentIndex = intInRange(rng, 0, piece.poly.length - 2);
    const t = 0.05 + 0.9 * rng();
    const a = piece.poly[segmentIndex];
    const b = piece.poly[segmentIndex + 1];
    if (!a || !b) {
      continue;
    }
    const point = interpolateSegment(a, b, t);
    const x = roundDegrees(point[0]);
    const y = roundDegrees(point[1]);
    if (!pointStrictlyInside(wardRings.geometry, x, y, WARD_INTERIOR_MARGIN_DEG)) {
      lastError = "point not strictly inside the ward interior";
      continue;
    }
    const zips = zipsContaining(context, x, y);
    if (zips.length !== 1) {
      lastError = `point fell inside ${zips.length} ZIP polygons`;
      continue;
    }
    const zipCode = zips[0];
    if (zipCode === undefined) {
      continue;
    }
    return { street, piece, segmentIndex, t, x, y, zipCode };
  }
  throw new Error(`could not sample a valid exact location for ward ${ward}: ${lastError}`);
}

function zipsContaining(context: GenerationContext, x: number, y: number): string[] {
  const hits: string[] = [];
  for (const zip of context.zips) {
    if (x < zip.minX || x > zip.maxX || y < zip.minY || y > zip.maxY) {
      continue;
    }
    if (pointStrictlyInside(zip.geometry, x, y, 0)) {
      hits.push(zip.code);
    }
  }
  return hits;
}

function roundDegrees(value: number): number {
  const factor = 10 ** ROUND_DECIMALS;
  return Math.round(value * factor) / factor;
}

/* ------------------------------------------------------------------ */
/* Plausible per-street building numbers                               */
/* ------------------------------------------------------------------ */

/** Feet along a street frontage between neighboring building numbers. */
export const STREET_NUMBER_PITCH_FEET = 52;

/**
 * The plausible per-street number range: the floor comes from a deterministic
 * hash of the street, the ceiling from the street's own geometry length
 * (~52 ft of frontage per same-side number). Nothing here touches real
 * listing or address data — source fields like address ranges are never read.
 */
export function streetNumberRange(street: Street): { min: number; max: number } {
  const hash = hashString(`${street.name}|${street.quadrant}`);
  const min = 100 + (hash % 2200);
  const totalFeet = metersToFeet(streetTotalMeters(street));
  const max = min + Math.floor(totalFeet / STREET_NUMBER_PITCH_FEET);
  return { min, max: Math.max(min, max) };
}

function streetTotalMeters(street: Street): number {
  let total = 0;
  for (const piece of street.pieces) {
    total += lineLengthMeters(piece.poly);
  }
  return total;
}

function streetNumberFor(
  street: Street,
  piece: StreetPiece,
  segmentIndex: number,
  t: number,
): number {
  const range = streetNumberRange(street);
  const alongFeet = metersToFeet(distanceAlongLineMeters(piece.poly, segmentIndex, t));
  const number = range.min + Math.round(alongFeet / STREET_NUMBER_PITCH_FEET);
  return Math.min(range.max, Math.max(range.min, number));
}

/* ------------------------------------------------------------------ */
/* Field distributions                                                 */
/* ------------------------------------------------------------------ */

function pickPolicyField(rng: Rng, field: keyof PolicyFields): PolicyState {
  return weightedPick(rng, POLICY_WEIGHTS[field]);
}

function pickTaxonomy<T extends string>(
  rng: Rng,
  unknownShare: number,
  weights: readonly (readonly [T, number])[],
): T | "unknown" {
  if (chance(rng, unknownShare)) {
    return "unknown";
  }
  return weightedPick(rng, weights);
}

function pickLengthOfStay(rng: Rng, housingType: HousingType): LengthOfStay | "unknown" {
  if (chance(rng, LENGTH_OF_STAY_UNKNOWN_SHARE)) {
    return "unknown";
  }
  const options = LENGTH_OF_STAY_BY_HOUSING_TYPE[housingType] ?? [];
  if (options.length === 0) {
    return "unknown";
  }
  return weightedPick(rng, options);
}

function pickRoomType(rng: Rng, housingType: HousingType): RoomType {
  const weights = ROOM_TYPE_BY_HOUSING_TYPE[housingType] ?? ROOM_TYPE_BY_HOUSING_TYPE.unknown;
  if (!weights) {
    throw new Error(`no room-type weights for housing type ${housingType}`);
  }
  const label = weightedPick(rng, weights);
  if (!(ROOM_TYPES as readonly string[]).includes(label)) {
    throw new Error(`generated room type not in the pinned taxonomy: ${label}`);
  }
  return label as RoomType;
}

/* ------------------------------------------------------------------ */
/* Provider / program / unit generation                                */
/* ------------------------------------------------------------------ */

function generateProgramUnits(
  rng: Rng,
  context: GenerationContext,
  corpus: Corpus,
  wardBag: number[],
  program: DatasetProgram,
  unitCount: number,
  unitOrdinal: () => number,
): void {
  for (let unitIndex = 1; unitIndex <= unitCount; unitIndex++) {
    program.units.push(
      generateUnit(rng, context, corpus, wardBag, program, unitIndex, unitOrdinal),
    );
  }
}

function generateUnit(
  rng: Rng,
  context: GenerationContext,
  corpus: Corpus,
  wardBag: number[],
  program: DatasetProgram,
  unitIndex: number,
  unitOrdinal: () => number,
): Unit {
  const ward = bagWard(wardBag, unitOrdinal());
  const availabilityState = pickAvailabilityState(rng);
  const availabilityConfirmed =
    availabilityState === "available" ? chance(rng, CONFIRMED_SHARE_WHEN_AVAILABLE) : false;
  const roomType = pickRoomType(rng, program.housingType);
  const bedrooms = pickBedrooms(rng, roomType);
  const sizeRange = SQUARE_FEET_BY_ROOM_TYPE[roomType];
  const squareFeet = sizeRange
    ? Math.round(sizeRange[0] + rng() * (sizeRange[1] - sizeRange[0]))
    : 250;
  const costRange = MONTHLY_COST_RANGE_BY_HOUSING_TYPE[program.housingType];
  const cost = costRange ? Math.round(costRange[0] + rng() * (costRange[1] - costRange[0])) : 400;

  // Every unit derives from a real street piece: interpolated coordinates on
  // the piece's geometry, a building number consistent with the position
  // along the street, and the street's own quadrant.
  const sample = sampleExactLocation(rng, context, corpus, ward);
  const number = streetNumberFor(sample.street, sample.piece, sample.segmentIndex, sample.t);

  const unit: Unit = {
    id: `${program.id}-${String(unitIndex).padStart(2, "0")}`,
    programId: program.id,
    address: `${number} ${sample.street.name} ${sample.street.quadrant}, Washington, DC ${sample.zipCode}`,
    ward,
    quadrant: sample.street.quadrant,
    coordinates: { latitude: sample.y, longitude: sample.x },
    bedrooms,
    size: { squareFeet, roomType },
    cost,
    availabilityState,
    availabilityConfirmed,
  };
  return unit;
}

function pickAvailabilityState(rng: Rng): AvailabilityState {
  const roll = rng();
  if (roll < AVAILABLE_SHARE) {
    return "available";
  }
  if (roll < AVAILABLE_SHARE + NOT_AVAILABLE_SHARE) {
    return "not-available";
  }
  return "unverified-availability";
}

/**
 * Bedrooms agree with room type: apartments have at least one separate
 * bedroom, private rooms exactly one, and efficiency/shared rooms none.
 */
function pickBedrooms(rng: Rng, roomType: string): number {
  if (roomType === "apartment") {
    return weightedPick(rng, BEDROOMS_WEIGHTS);
  }
  if (roomType === "private-room") {
    return 1;
  }
  return 0;
}

function bagWard(values: number[], ordinal: number): number {
  const ward = values[ordinal];
  if (ward === undefined) {
    throw new Error(`ward bag exhausted at ordinal ${ordinal}`);
  }
  return ward;
}

function buildWardBag(rng: Rng, targetUnits: number): number[] {
  // Largest-remainder apportionment keeps the per-ward weights while making
  // the counts total exactly targetUnits (and every ward far above zero).
  const total = WARD_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
  const entries = WARD_WEIGHTS.map(([ward, weight]) => {
    const exact = (targetUnits * weight) / total;
    return { ward, floor: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  const counts = new Map<number, number>(entries.map((entry) => [entry.ward, entry.floor]));
  let assigned = entries.reduce((sum, entry) => sum + entry.floor, 0);
  const byRemainder = [...entries].sort((a, b) => b.remainder - a.remainder || a.ward - b.ward);
  let index = 0;
  while (assigned < targetUnits) {
    const entry = byRemainder[index % byRemainder.length];
    if (!entry) {
      throw new Error("ward bucket missing");
    }
    counts.set(entry.ward, (counts.get(entry.ward) ?? 0) + 1);
    assigned++;
    index++;
  }
  const values: number[] = [];
  for (const [ward, count] of counts) {
    for (let i = 0; i < count; i++) {
      values.push(ward);
    }
  }
  return shuffle(rng, values);
}

/* ------------------------------------------------------------------ */
/* Dataset assembly                                                    */
/* ------------------------------------------------------------------ */

export function generateDataset(
  seed: number,
  corpus: Corpus,
  targetUnits: number = DEFAULT_TARGET_UNITS,
): Dataset {
  if (targetUnits < 8) {
    throw new Error("targetUnits must be at least one per ward");
  }
  const rng = mulberry32(seed);
  const context = buildContext(corpus);
  const wardBag = buildWardBag(rng, targetUnits);

  const providers: DatasetProvider[] = [];
  const usedOrganizations = new Set<string>();
  const ordinalState = { next: 0 };
  const unitOrdinal = () => {
    const ordinal = ordinalState.next;
    ordinalState.next += 1;
    return ordinal;
  };
  let unitsRemaining = targetUnits;
  let providerSerial = 0;

  while (unitsRemaining > 0) {
    providerSerial++;
    const providerId = `prv-${String(providerSerial).padStart(4, "0")}`;
    const organization = uniqueOrganizationName(rng, usedOrganizations);
    const provider: DatasetProvider = {
      id: providerId,
      organization,
      programs: [],
      ...generateContacts(rng, organization),
    };

    const programCountRaw = weightedPick(rng, PROGRAMS_PER_PROVIDER);
    const programCount = Math.min(programCountRaw, unitsRemaining);
    for (let programIndex = 1; programIndex <= programCount; programIndex++) {
      // Each program draws its weighted pull, capped so the programs after it
      // can still draw at least one unit — the final program of the dataset
      // closes the exact target count.
      const unitCount = Math.min(
        weightedPick(rng, UNITS_PER_PROGRAM),
        unitsRemaining - (programCount - programIndex),
      );
      if (unitCount < 1) {
        throw new Error("unit allocation underflow");
      }
      const program = generateProgram(
        rng,
        context,
        corpus,
        wardBag,
        providerId,
        programIndex,
        unitCount,
        unitOrdinal,
      );
      unitsRemaining -= unitCount;
      provider.programs.push(program);
    }
    providers.push(provider);
  }

  if (ordinalState.next !== targetUnits) {
    throw new Error(
      `internal ward consumption drift: ${ordinalState.next} of ${targetUnits} units`,
    );
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    synthetic: true,
    disclaimer: SYNTHETIC_DISCLAIMER,
    seed,
    generation: {
      generator: GENERATOR_ID,
      corpusFormat: corpus.format,
      rng: RNG_ID,
    },
    providers,
  };
}

function generateProgram(
  rng: Rng,
  context: GenerationContext,
  corpus: Corpus,
  wardBag: number[],
  providerId: string,
  programIndex: number,
  unitCount: number,
  unitOrdinal: () => number,
): DatasetProgram {
  const housingType = pickHousingType(rng);
  const program: DatasetProgram = {
    id: `${providerId}-pgm-${String(programIndex).padStart(2, "0")}`,
    name: programName(rng, housingType),
    ...(chance(rng, 0.7) ? { applicationProcess: applicationProcess(rng) } : {}),
    housingType,
    lengthOfStay: pickLengthOfStay(rng, housingType),
    population: pickTaxonomy(rng, POPULATION_UNKNOWN_SHARE, POPULATION_WEIGHTS),
    gender: pickTaxonomy(rng, GENDER_UNKNOWN_SHARE, GENDER_WEIGHTS),
    referralRequired: pickPolicyField(rng, "referralRequired"),
    sobrietyRequired: pickPolicyField(rng, "sobrietyRequired"),
    backgroundCheckRequired: pickPolicyField(rng, "backgroundCheckRequired"),
    sexOffenseRestrictions: pickPolicyField(rng, "sexOffenseRestrictions"),
    treatmentRequired: pickPolicyField(rng, "treatmentRequired"),
    housingVouchersAccepted: pickPolicyField(rng, "housingVouchersAccepted"),
    units: [],
  };
  generateProgramUnits(rng, context, corpus, wardBag, program, unitCount, unitOrdinal);
  return program;
}

function pickHousingType(rng: Rng): HousingType {
  if (chance(rng, HOUSING_TYPE_UNKNOWN_SHARE)) {
    return "unknown";
  }
  return weightedPick(rng, HOUSING_TYPE_WEIGHTS);
}

function uniqueOrganizationName(rng: Rng, used: Set<string>): string {
  for (let attempt = 0; attempt < 200; attempt++) {
    const name = organizationName(rng);
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  throw new Error("exhausted the fictional organization name space");
}

/* ------------------------------------------------------------------ */
/* Test-support exports (pure, no state)                               */
/* ------------------------------------------------------------------ */

export function datasetUnitCount(dataset: Dataset): number {
  let count = 0;
  for (const provider of dataset.providers) {
    for (const program of provider.programs) {
      count += program.units.length;
    }
  }
  return count;
}
