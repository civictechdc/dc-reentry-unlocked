import type {
  AvailabilityState,
  Coordinates,
  Gender,
  HousingType,
  LengthOfStay,
  PolicyState,
  Population,
  Program,
  Provider,
  Quadrant,
  RoomType,
  Unit,
  UnitCard,
  UnitSize,
  Ward,
} from "../index";
import { SCHEMA_VERSION } from "../index";

/**
 * TEST-ONLY fluent domain builders. Importable ONLY from test files —
 * enforced by the `shared-testing-subpath-not-reachable-from-non-test-files`
 * rule in `.dependency-cruiser.cjs` (no non-test file may reach this subpath,
 * directly or through a re-exporting test file). Never import from
 * production code.
 *
 * Arrange reads as domain language: `aUnitCard().inWard(5)
 * .withUnknownSobrietyPolicy()` arranges the read model, `aUnit().inWard(5)
 * .available()` arranges the inventory entity.
 *
 * Doctrine: fluent forms are the vocabulary for domain-meaningful fields;
 * the escape hatches (`withProgram` / `withProvider` on the card builder)
 * are for schema plumbing and for fields that have not earned a fluent form
 * yet — never the default idiom in review.
 */

/**
 * Module-internal merge paths. Symbol-keyed as an encapsulation convention
 * for this test-only module: the keys stay unexported, so the members remain
 * off the dot-callable/autocomplete fluent surface callers use. Convention,
 * not enforcement — reflection (`Object.getOwnPropertySymbols`) can still
 * reach them, and this is no security boundary.
 */
const mergeProgramFields = Symbol("merge-program-fields");
const mergeProviderFields = Symbol("merge-provider-fields");
const mergeCardProgramField = Symbol("merge-card-program-field");

/**
 * Program fields carrying fluent vocabulary on both program-holding builders.
 * Stems are domain vocabulary, not mechanical field-name derivatives
 * (`sobrietyRequired` reads `withSobrietyPolicy`). The rot-guard test ties
 * this table to the policy fields `ProgramSchema` actually declares, so a new
 * policy field without an entry fails a named test instead of a memory.
 */
type DelegableProgramField = Exclude<keyof Program, "id" | "name" | "applicationProcess">;

type DelegableFieldValue = Program[DelegableProgramField];

type DelegableProgramFieldEntry = {
  [Field in DelegableProgramField]: {
    /** The program field the fluent pair writes. */
    field: Field;
    /** Fluent stem: `with${stem}` / `withUnknown${stem}`. */
    stem: string;
    /** A stated (never unknown) sample value exercising the fluent form. */
    sample: Program[Field];
    /** The honest-unknown literal the `withUnknown*` form writes. */
    unknown: "unknown";
  };
}[DelegableProgramField];

const delegableProgramFieldEntries: readonly DelegableProgramFieldEntry[] = [
  { field: "housingType", stem: "HousingType", sample: "emergency-shelter", unknown: "unknown" },
  {
    field: "lengthOfStay",
    stem: "LengthOfStay",
    sample: "permanent-open-ended",
    unknown: "unknown",
  },
  { field: "population", stem: "Population", sample: "families", unknown: "unknown" },
  { field: "gender", stem: "Gender", sample: "women", unknown: "unknown" },
  { field: "referralRequired", stem: "ReferralPolicy", sample: "yes", unknown: "unknown" },
  { field: "sobrietyRequired", stem: "SobrietyPolicy", sample: "yes", unknown: "unknown" },
  {
    field: "backgroundCheckRequired",
    stem: "BackgroundCheckPolicy",
    sample: "yes",
    unknown: "unknown",
  },
  {
    field: "sexOffenseRestrictions",
    stem: "SexOffenseRestrictionPolicy",
    sample: "yes",
    unknown: "unknown",
  },
  { field: "treatmentRequired", stem: "TreatmentPolicy", sample: "yes", unknown: "unknown" },
  {
    field: "housingVouchersAccepted",
    stem: "HousingVoucherPolicy",
    sample: "no",
    unknown: "unknown",
  },
];

export const DELEGABLE_PROGRAM_FIELDS = Object.freeze(delegableProgramFieldEntries);

/**
 * The single contained cast site in this module: the table's computed field
 * key widens to a string index here, and nowhere else.
 */
function writeProgramField(
  program: ProgramBuilder,
  field: DelegableProgramField,
  value: DelegableFieldValue,
): void {
  program[mergeProgramFields]({ [field]: value } as Partial<Program>);
}

/**
 * The fluent program-policy vocabulary shared by `ProgramBuilder` and
 * `UnitCardBuilder`. Hand-written on purpose — one method per fluent form,
 * polymorphic `this` returns — so both of the repo's TypeScript compilers see
 * a plain interface instead of a mapped/template-literal construction. The
 * merged `interface … extends DelegatesProgramFields {}` declarations put
 * these members on the class types as their compile-time surface. The
 * `implements` clause is satisfied vacuously here (class and interface share
 * a name), so the runtime installation itself is proven by the table-driven
 * tests, not by the compiler.
 */
interface DelegatesProgramFields {
  withHousingType(housingType: HousingType): this;
  withUnknownHousingType(): this;
  withLengthOfStay(lengthOfStay: LengthOfStay): this;
  withUnknownLengthOfStay(): this;
  withPopulation(population: Population): this;
  withUnknownPopulation(): this;
  withGender(gender: Gender): this;
  withUnknownGender(): this;
  withReferralPolicy(state: PolicyState): this;
  withUnknownReferralPolicy(): this;
  withSobrietyPolicy(state: PolicyState): this;
  withUnknownSobrietyPolicy(): this;
  withBackgroundCheckPolicy(state: PolicyState): this;
  withUnknownBackgroundCheckPolicy(): this;
  withSexOffenseRestrictionPolicy(state: PolicyState): this;
  withUnknownSexOffenseRestrictionPolicy(): this;
  withTreatmentPolicy(state: PolicyState): this;
  withUnknownTreatmentPolicy(): this;
  withHousingVoucherPolicy(state: PolicyState): this;
  withUnknownHousingVoucherPolicy(): this;
}

export class ProviderBuilder {
  private fields: Provider = {
    id: "provider-test",
    organization: "Fresh Start Housing",
    phone: "(202) 555-0100",
    email: "intake@freshstart.example.org",
    website: "https://freshstart.example.org",
  };

  withOrganization(organization: string): this {
    this.fields = { ...this.fields, organization };
    return this;
  }

  withPhone(phone: string): this {
    this.fields = { ...this.fields, phone };
    return this;
  }

  withoutContactDetails(): this {
    this.fields = { id: this.fields.id, organization: this.fields.organization };
    return this;
  }

  /** Module-internal merge path behind the card builder's provider escape hatch. */
  [mergeProviderFields](partial: Partial<Provider>): this {
    this.fields = { ...this.fields, ...partial };
    return this;
  }

  build(): Provider {
    return structuredClone(this.fields);
  }
}

// The class-interface merge below is deliberate: the delegation table's
// runtime installation provides the fluent members on the prototype (the
// table-driven tests prove every pair is installed), and the merged
// interface is their compile-time surface.
// oxlint-disable-next-line typescript/no-unsafe-declaration-merging
export class ProgramBuilder implements DelegatesProgramFields {
  private fields: Program = {
    id: "program-test",
    name: "Fresh Start Transitional",
    housingType: "transitional",
    lengthOfStay: "transitional-up-to-24-months",
    population: "individuals",
    gender: "all",
    referralRequired: "no",
    sobrietyRequired: "no",
    backgroundCheckRequired: "no",
    sexOffenseRestrictions: "no",
    treatmentRequired: "no",
    housingVouchersAccepted: "yes",
  };

  withName(name: string): this {
    this.fields = { ...this.fields, name };
    return this;
  }

  withApplicationProcess(text: string): this {
    this.fields = { ...this.fields, applicationProcess: text };
    return this;
  }

  /** Module-internal merge path behind the delegation table and the program escape hatch. */
  [mergeProgramFields](partial: Partial<Program>): this {
    this.fields = { ...this.fields, ...partial };
    return this;
  }

  build(): Program {
    return structuredClone(this.fields);
  }
}

// Compile-time surface for the runtime-installed fluent forms.
export interface ProgramBuilder extends DelegatesProgramFields {}

// Deliberate merge — see ProgramBuilder above.
// oxlint-disable-next-line typescript/no-unsafe-declaration-merging
export class UnitCardBuilder implements DelegatesProgramFields {
  private program = new ProgramBuilder();
  private provider = new ProviderBuilder();

  private unitId = "unit-test";
  private ward: Ward = 1;
  private quadrant: Quadrant = "NW";
  private address = "1440 Test Street NW";
  private coordinates: Coordinates = { latitude: 38.913, longitude: -77.032 };
  // Efficiencies carry no bedrooms — a one-bedroom efficiency would state a
  // combination the domain forbids; call sites say otherwise explicitly.
  private bedrooms = 0;
  private size: UnitSize = { squareFeet: 400, roomType: "efficiency" };
  private cost = 650;
  private availabilityState: AvailabilityState = "available";
  private availabilityConfirmed = true;

  withId(id: string): this {
    this.unitId = id;
    return this;
  }

  inWard(ward: Ward): this {
    this.ward = ward;
    return this;
  }

  inQuadrant(quadrant: Quadrant): this {
    this.quadrant = quadrant;
    return this;
  }

  withExactAddress(address: string): this {
    this.address = address;
    return this;
  }

  withCoordinates(latitude: number, longitude: number): this {
    this.coordinates = { latitude, longitude };
    return this;
  }

  withBedrooms(bedrooms: number): this {
    this.bedrooms = bedrooms;
    return this;
  }

  withRoomType(roomType: RoomType): this {
    this.size = { ...this.size, roomType };
    return this;
  }

  withSquareFeet(squareFeet: number): this {
    this.size = { ...this.size, squareFeet };
    return this;
  }

  withCost(cost: number): this {
    this.cost = cost;
    return this;
  }

  /**
   * Escape hatch for schema plumbing and fields that have not earned a fluent
   * form yet (see the module docblock) — never the default idiom in review.
   */
  withProgram(partial: Partial<Program>): this {
    this.program[mergeProgramFields](partial);
    return this;
  }

  /** Escape hatch mirroring `withProgram` for the provider's contact fields. */
  withProvider(partial: Partial<Provider>): this {
    this.provider[mergeProviderFields](partial);
    return this;
  }

  atOrganization(organization: string): this {
    this.provider.withOrganization(organization);
    return this;
  }

  /** Module-internal single-field path the delegation table installs against. */
  [mergeCardProgramField](field: DelegableProgramField, value: DelegableFieldValue): this {
    writeProgramField(this.program, field, value);
    return this;
  }

  available(): this {
    this.availabilityState = "available";
    return this;
  }

  unavailable(): this {
    this.availabilityState = "not-available";
    return this;
  }

  withUnverifiedAvailability(): this {
    this.availabilityState = "unverified-availability";
    return this;
  }

  needsVerification(): this {
    this.availabilityConfirmed = false;
    return this;
  }

  confirmed(): this {
    this.availabilityConfirmed = true;
    return this;
  }

  build(): UnitCard {
    return structuredClone({
      schemaVersion: SCHEMA_VERSION,
      id: this.unitId,
      programId: this.program.build().id,
      address: this.address,
      ward: this.ward,
      quadrant: this.quadrant,
      coordinates: this.coordinates,
      bedrooms: this.bedrooms,
      size: this.size,
      cost: this.cost,
      availabilityState: this.availabilityState,
      availabilityConfirmed: this.availabilityConfirmed,
      verificationBadge: this.availabilityConfirmed ? "confirmed" : "needs-verification",
      program: this.program.build(),
      provider: this.provider.build(),
    });
  }
}

// Compile-time surface for the runtime-installed fluent forms.
export interface UnitCardBuilder extends DelegatesProgramFields {}

/**
 * Builder for the `Unit` inventory entity — the hierarchy leaf itself, not the
 * flattened card. Mirrors the card builder's unit-level vocabulary so both
 * layers arrange with the same words. The default `programId` matches the
 * default `aProgram()` id, so `aUnit()` composes id-consistently out of the
 * box.
 */
export class UnitBuilder {
  private fields: Unit = {
    id: "unit-test",
    programId: "program-test",
    address: "1440 Test Street NW",
    ward: 1,
    quadrant: "NW",
    coordinates: { latitude: 38.913, longitude: -77.032 },
    // Efficiencies carry no bedrooms — mirrored from the card builder.
    bedrooms: 0,
    size: { squareFeet: 400, roomType: "efficiency" },
    cost: 650,
    availabilityState: "available",
    availabilityConfirmed: true,
  };

  withId(id: string): this {
    this.fields = { ...this.fields, id };
    return this;
  }

  withProgramId(programId: string): this {
    this.fields = { ...this.fields, programId };
    return this;
  }

  inWard(ward: Ward): this {
    this.fields = { ...this.fields, ward };
    return this;
  }

  inQuadrant(quadrant: Quadrant): this {
    this.fields = { ...this.fields, quadrant };
    return this;
  }

  withExactAddress(address: string): this {
    this.fields = { ...this.fields, address };
    return this;
  }

  withCoordinates(latitude: number, longitude: number): this {
    this.fields = { ...this.fields, coordinates: { latitude, longitude } };
    return this;
  }

  withBedrooms(bedrooms: number): this {
    this.fields = { ...this.fields, bedrooms };
    return this;
  }

  withRoomType(roomType: RoomType): this {
    this.fields = { ...this.fields, size: { ...this.fields.size, roomType } };
    return this;
  }

  withSquareFeet(squareFeet: number): this {
    this.fields = { ...this.fields, size: { ...this.fields.size, squareFeet } };
    return this;
  }

  withCost(cost: number): this {
    this.fields = { ...this.fields, cost };
    return this;
  }

  available(): this {
    this.fields = { ...this.fields, availabilityState: "available" };
    return this;
  }

  unavailable(): this {
    this.fields = { ...this.fields, availabilityState: "not-available" };
    return this;
  }

  withUnverifiedAvailability(): this {
    this.fields = { ...this.fields, availabilityState: "unverified-availability" };
    return this;
  }

  needsVerification(): this {
    this.fields = { ...this.fields, availabilityConfirmed: false };
    return this;
  }

  confirmed(): this {
    this.fields = { ...this.fields, availabilityConfirmed: true };
    return this;
  }

  build(): Unit {
    return structuredClone(this.fields);
  }
}

/**
 * Installs the `with*` / `withUnknown*` pair for every delegable program field
 * onto both program-holding builders, straight from the table. The declared
 * fluent surface stays compile-time (`DelegatesProgramFields`, merged onto the
 * class types); this runtime loop is what that surface describes — a missing
 * pair here is a failed table-driven test, not a silent gap.
 */
const installDelegatedProgramFields = (): void => {
  for (const entry of DELEGABLE_PROGRAM_FIELDS) {
    Object.assign(ProgramBuilder.prototype, {
      [`with${entry.stem}`](this: ProgramBuilder, value: DelegableFieldValue): ProgramBuilder {
        writeProgramField(this, entry.field, value);
        return this;
      },
      [`withUnknown${entry.stem}`](this: ProgramBuilder): ProgramBuilder {
        writeProgramField(this, entry.field, entry.unknown);
        return this;
      },
    });
    Object.assign(UnitCardBuilder.prototype, {
      [`with${entry.stem}`](this: UnitCardBuilder, value: DelegableFieldValue): UnitCardBuilder {
        this[mergeCardProgramField](entry.field, value);
        return this;
      },
      [`withUnknown${entry.stem}`](this: UnitCardBuilder): UnitCardBuilder {
        this[mergeCardProgramField](entry.field, entry.unknown);
        return this;
      },
    });
  }
};

installDelegatedProgramFields();

export const aProvider = (): ProviderBuilder => new ProviderBuilder();
export const aProgram = (): ProgramBuilder => new ProgramBuilder();
export const aUnitCard = (): UnitCardBuilder => new UnitCardBuilder();
export const aUnit = (): UnitBuilder => new UnitBuilder();
