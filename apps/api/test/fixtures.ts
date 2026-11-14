import type { UnitCard } from "@dc-reentry/shared";
import { aUnitCard, type UnitCardBuilder } from "@dc-reentry/shared/testing";

/**
 * Builder-arranged fixture shared by the units behavior tests and the
 * fast-check property suite: every boolean policy state, every enum value,
 * every unknown-at-source field, and every availability state in the pool,
 * spread over wards so ward and enum filters have something to separate.
 *
 * Fixture modules live in test/ but carry no tests themselves — vitest's
 * default include only picks *.test.ts, and the architecture rule permits
 * test-directory helpers to read the shared test-only builders.
 */
const shaped = (id: string, shape: (builder: UnitCardBuilder) => UnitCardBuilder): UnitCard =>
  shape(aUnitCard().withId(id)).build();

export const fixtureDataset: UnitCard[] = [
  shaped("verified-exact-nw", (unit) => unit.inWard(1).confirmed()),
  shaped("unconfirmed-ne", (unit) => unit.inWard(2).needsVerification()),
  shaped("exact-sw", (unit) => unit.inQuadrant("SW").inWard(8)),
  shaped("referral-unknown", (unit) => unit.inWard(3).withUnknownReferralPolicy()),
  shaped("referral-required", (unit) => unit.inWard(4).withReferralPolicy("yes")),
  shaped("sobriety-unknown", (unit) => unit.inWard(5).withUnknownSobrietyPolicy()),
  shaped("background-check-required", (unit) => unit.inWard(6).withBackgroundCheckPolicy("yes")),
  shaped("background-check-unknown", (unit) => unit.inWard(2).withUnknownBackgroundCheckPolicy()),
  shaped("sobriety-required", (unit) => unit.inWard(2).withSobrietyPolicy("yes")),
  shaped("sex-offense-restricted", (unit) => unit.inWard(3).withSexOffenseRestrictionPolicy("yes")),
  shaped("treatment-required", (unit) => unit.inWard(4).withTreatmentPolicy("yes")),
  shaped("vouchers-accepted", (unit) => unit.inWard(5).withHousingVoucherPolicy("yes")),
  shaped("sex-offense-unknown", (unit) => unit.inWard(7).withUnknownSexOffenseRestrictionPolicy()),
  shaped("treatment-unknown", (unit) => unit.inWard(2).withUnknownTreatmentPolicy()),
  shaped("voucher-unknown", (unit) => unit.inWard(1).withUnknownHousingVoucherPolicy()),
  shaped("housing-type-unknown", (unit) => unit.inWard(1).withUnknownHousingType()),
  shaped("stay-unknown", (unit) => unit.inWard(2).withUnknownLengthOfStay()),
  shaped("population-unknown", (unit) => unit.inWard(3).withUnknownPopulation()),
  shaped("gender-unknown", (unit) => unit.inWard(4).withUnknownGender()),
  shaped("emergency-shelter", (unit) => unit.inWard(5).withHousingType("emergency-shelter")),
  shaped("families-both", (unit) => unit.inWard(6).withPopulation("both")),
  shaped("women-only", (unit) => unit.inWard(7).withGender("women")),
  shaped("temporary-stay", (unit) => unit.inWard(8).withLengthOfStay("emergency-nightly")),
  shaped("taken-unit", (unit) => unit.inWard(1).unavailable()),
  shaped("hold-unit", (unit) => unit.inWard(2).withUnverifiedAvailability()),
  shaped("taken-referral-yes", (unit) => unit.inWard(3).unavailable().withReferralPolicy("yes")),
  shaped("hold-housing-type-unknown", (unit) =>
    unit.inWard(4).withUnverifiedAvailability().withUnknownHousingType(),
  ),
];
