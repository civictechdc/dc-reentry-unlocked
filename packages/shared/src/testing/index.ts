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
 * Arrange reads as domain language: `aUnit().inWard(5).withUnknownSobrietyPolicy()`.
 */

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

  build(): Provider {
    return structuredClone(this.fields);
  }
}

export class ProgramBuilder {
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

  withHousingType(housingType: HousingType): this {
    this.fields = { ...this.fields, housingType };
    return this;
  }

  withUnknownHousingType(): this {
    return this.withHousingType("unknown");
  }

  withLengthOfStay(lengthOfStay: LengthOfStay): this {
    this.fields = { ...this.fields, lengthOfStay };
    return this;
  }

  withUnknownLengthOfStay(): this {
    return this.withLengthOfStay("unknown");
  }

  withPopulation(population: Population): this {
    this.fields = { ...this.fields, population };
    return this;
  }

  withUnknownPopulation(): this {
    return this.withPopulation("unknown");
  }

  withGender(gender: Gender): this {
    this.fields = { ...this.fields, gender };
    return this;
  }

  withUnknownGender(): this {
    return this.withGender("unknown");
  }

  withReferralPolicy(state: PolicyState): this {
    this.fields = { ...this.fields, referralRequired: state };
    return this;
  }

  withUnknownReferralPolicy(): this {
    return this.withReferralPolicy("unknown");
  }

  withSobrietyPolicy(state: PolicyState): this {
    this.fields = { ...this.fields, sobrietyRequired: state };
    return this;
  }

  withUnknownSobrietyPolicy(): this {
    return this.withSobrietyPolicy("unknown");
  }

  withBackgroundCheckPolicy(state: PolicyState): this {
    this.fields = { ...this.fields, backgroundCheckRequired: state };
    return this;
  }

  withUnknownBackgroundCheckPolicy(): this {
    return this.withBackgroundCheckPolicy("unknown");
  }

  withSexOffenseRestrictionPolicy(state: PolicyState): this {
    this.fields = { ...this.fields, sexOffenseRestrictions: state };
    return this;
  }

  withUnknownSexOffenseRestrictionPolicy(): this {
    return this.withSexOffenseRestrictionPolicy("unknown");
  }

  withTreatmentPolicy(state: PolicyState): this {
    this.fields = { ...this.fields, treatmentRequired: state };
    return this;
  }

  withUnknownTreatmentPolicy(): this {
    return this.withTreatmentPolicy("unknown");
  }

  withHousingVoucherPolicy(state: PolicyState): this {
    this.fields = { ...this.fields, housingVouchersAccepted: state };
    return this;
  }

  withUnknownHousingVoucherPolicy(): this {
    return this.withHousingVoucherPolicy("unknown");
  }

  build(): Program {
    return structuredClone(this.fields);
  }
}

export class UnitCardBuilder {
  private program = new ProgramBuilder();
  private provider = new ProviderBuilder();

  private unitId = "unit-test";
  private ward: Ward = 1;
  private quadrant: Quadrant = "NW";
  private address = "1440 Test Street NW";
  private coordinates: Coordinates = { latitude: 38.913, longitude: -77.032 };
  private bedrooms = 1;
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

  withHousingType(housingType: HousingType): this {
    this.program.withHousingType(housingType);
    return this;
  }

  withUnknownHousingType(): this {
    this.program.withUnknownHousingType();
    return this;
  }

  withLengthOfStay(lengthOfStay: LengthOfStay): this {
    this.program.withLengthOfStay(lengthOfStay);
    return this;
  }

  withUnknownLengthOfStay(): this {
    this.program.withUnknownLengthOfStay();
    return this;
  }

  withPopulation(population: Population): this {
    this.program.withPopulation(population);
    return this;
  }

  withUnknownPopulation(): this {
    this.program.withUnknownPopulation();
    return this;
  }

  withGender(gender: Gender): this {
    this.program.withGender(gender);
    return this;
  }

  withUnknownGender(): this {
    this.program.withUnknownGender();
    return this;
  }

  withReferralPolicy(state: PolicyState): this {
    this.program.withReferralPolicy(state);
    return this;
  }

  withUnknownReferralPolicy(): this {
    this.program.withUnknownReferralPolicy();
    return this;
  }

  withSobrietyPolicy(state: PolicyState): this {
    this.program.withSobrietyPolicy(state);
    return this;
  }

  withUnknownSobrietyPolicy(): this {
    this.program.withUnknownSobrietyPolicy();
    return this;
  }

  withBackgroundCheckPolicy(state: PolicyState): this {
    this.program.withBackgroundCheckPolicy(state);
    return this;
  }

  withUnknownBackgroundCheckPolicy(): this {
    this.program.withUnknownBackgroundCheckPolicy();
    return this;
  }

  withSexOffenseRestrictionPolicy(state: PolicyState): this {
    this.program.withSexOffenseRestrictionPolicy(state);
    return this;
  }

  withUnknownSexOffenseRestrictionPolicy(): this {
    this.program.withUnknownSexOffenseRestrictionPolicy();
    return this;
  }

  withTreatmentPolicy(state: PolicyState): this {
    this.program.withTreatmentPolicy(state);
    return this;
  }

  withUnknownTreatmentPolicy(): this {
    this.program.withUnknownTreatmentPolicy();
    return this;
  }

  withHousingVoucherPolicy(state: PolicyState): this {
    this.program.withHousingVoucherPolicy(state);
    return this;
  }

  withUnknownHousingVoucherPolicy(): this {
    this.program.withUnknownHousingVoucherPolicy();
    return this;
  }

  atOrganization(organization: string): this {
    this.provider.withOrganization(organization);
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

export const aProvider = (): ProviderBuilder => new ProviderBuilder();
export const aProgram = (): ProgramBuilder => new ProgramBuilder();
export const aUnit = (): UnitCardBuilder => new UnitCardBuilder();
