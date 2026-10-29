import Type, { type Static } from "typebox";
import { PolicyStateSchema } from "./primitives";

/**
 * Program taxonomies — the single source of truth for the enumerated
 * eligibility values. Filter options (filters.ts) are pinned to the same
 * lists; changing a taxonomy is a spec-contract change, not a drive-by.
 */

/** Housing type taxonomy. */
export const HOUSING_TYPES = [
  "emergency-shelter",
  "transitional",
  "permanent-supportive-housing",
  "subsidized-rental",
  "market-rate",
] as const;

/** Length of stay taxonomy. */
export const LENGTHS_OF_STAY = [
  "emergency-nightly",
  "short-term-up-to-90-days",
  "transitional-up-to-24-months",
  "permanent-open-ended",
] as const;

/** Population served taxonomy. */
export const POPULATIONS = ["individuals", "families", "both"] as const;

/** Gender served taxonomy. */
export const GENDERS = ["men", "women", "all"] as const;

/**
 * Unknown honesty (spec: "Unknown is a representable state"): EVERY
 * policy/eligibility field supports unknown ("not publicly listed"). The
 * enumerated eligibility fields extend their taxonomy with the same
 * "unknown" literal the tri-state PolicyState uses — one representation,
 * consistent across the contract. "unknown" is a data state only; filter
 * option lists stay the pinned taxonomies.
 */
const UnknownSchema = Type.Literal("unknown");

/** Housing type: a taxonomy value, or "not publicly listed". */
export const HousingTypeSchema = Type.Union([Type.Enum([...HOUSING_TYPES]), UnknownSchema]);
export type HousingType = Static<typeof HousingTypeSchema>;

/** Length of stay: a taxonomy value, or "not publicly listed". */
export const LengthOfStaySchema = Type.Union([Type.Enum([...LENGTHS_OF_STAY]), UnknownSchema]);
export type LengthOfStay = Static<typeof LengthOfStaySchema>;

/** Population served: a taxonomy value, or "not publicly listed". */
export const PopulationSchema = Type.Union([Type.Enum([...POPULATIONS]), UnknownSchema]);
export type Population = Static<typeof PopulationSchema>;

/** Gender served: a taxonomy value, or "not publicly listed". */
export const GenderSchema = Type.Union([Type.Enum([...GENDERS]), UnknownSchema]);
export type Gender = Static<typeof GenderSchema>;

/**
 * Housing program: the policy-bearing layer between provider and unit.
 * Every eligibility/policy field carries the unknown state ("not publicly
 * listed") — tri-state for policy fields, taxonomy + "unknown" for the
 * enumerated eligibility fields. Unknown is never fabricated as yes/no.
 */
export const ProgramSchema = Type.Object({
  id: Type.String(),
  /** Program name shown in the detail contact block. */
  name: Type.String(),
  /** How the application process works, when publicly listed. */
  applicationProcess: Type.Optional(Type.String()),
  housingType: HousingTypeSchema,
  lengthOfStay: LengthOfStaySchema,
  population: PopulationSchema,
  gender: GenderSchema,
  referralRequired: PolicyStateSchema,
  sobrietyRequired: PolicyStateSchema,
  backgroundCheckRequired: PolicyStateSchema,
  /** Whether sex-offense restrictions apply. */
  sexOffenseRestrictions: PolicyStateSchema,
  treatmentRequired: PolicyStateSchema,
  /** Whether housing vouchers are accepted. */
  housingVouchersAccepted: PolicyStateSchema,
});
export type Program = Static<typeof ProgramSchema>;
