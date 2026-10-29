import Type, { type Static } from "typebox";
import { GENDERS, HOUSING_TYPES, LENGTHS_OF_STAY, POPULATIONS } from "./program";

/**
 * Filter-schema contract: the machine-readable filter definitions published
 * by the API. Renderers are generic over the control vocabulary — no filter
 * is hardcoded in a consumer. Unsupported control types degrade gracefully,
 * never crash.
 */

export const FILTER_CONTROLS = ["boolean", "single-select", "multi-select"] as const;

export const FilterControlSchema = Type.Enum([...FILTER_CONTROLS]);
export type FilterControl = Static<typeof FilterControlSchema>;

/** Human display pairing for an enumeration option. */
export const FilterOptionSchema = Type.Object({
  value: Type.String(),
  label: Type.String(),
});
export type FilterOption = Static<typeof FilterOptionSchema>;

/** Fields a filter definition may target (pinned — new fields extend it). */
export const FILTER_TARGETS = [
  "unit.ward",
  "program.housingType",
  "program.lengthOfStay",
  "program.population",
  "program.gender",
  "program.referralRequired",
  "program.sobrietyRequired",
  "program.backgroundCheckRequired",
  "program.sexOffenseRestrictions",
  "program.treatmentRequired",
  "program.housingVouchersAccepted",
] as const;

export const FilterTargetSchema = Type.Enum([...FILTER_TARGETS]);
export type FilterTarget = Static<typeof FilterTargetSchema>;

export const FilterDefinitionSchema = Type.Object({
  id: Type.String(),
  label: Type.String(),
  control: FilterControlSchema,
  target: FilterTargetSchema,
  options: Type.Optional(Type.Array(FilterOptionSchema)),
});
export type FilterDefinition = Static<typeof FilterDefinitionSchema>;

export const wardOptions: FilterOption[] = Array.from({ length: 8 }, (_, i) => ({
  value: String(i + 1),
  label: `Ward ${i + 1}`,
}));

const enumOptions = (values: readonly string[], labels: readonly string[]): FilterOption[] => {
  if (values.length !== labels.length) {
    throw new Error(
      `Pinned taxonomy mismatch: ${values.length} values but ${labels.length} labels`,
    );
  }
  return values.map((value, i) => ({ value, label: labels[i] ?? value }));
};

const booleanFilter = (id: string, label: string, target: FilterTarget): FilterDefinition => ({
  id,
  label,
  control: "boolean",
  target,
});

const enumFilter = (
  id: string,
  label: string,
  control: "single-select" | "multi-select",
  target: FilterTarget,
  options: FilterOption[],
): FilterDefinition => ({ id, label, control, target, options });

/**
 * The pinned 11-filter set — the single source of truth for what filters
 * exist (spec: "Filter schema endpoint"). Tests assert exactly this set.
 */
export const UNIT_FILTERS: FilterDefinition[] = [
  enumFilter(
    "housing-type",
    "Housing type",
    "single-select",
    "program.housingType",
    enumOptions(HOUSING_TYPES, [
      "Emergency shelter",
      "Transitional",
      "Permanent supportive housing",
      "Subsidized rental",
      "Market-rate",
    ]),
  ),
  enumFilter(
    "length-of-stay",
    "Length of stay",
    "single-select",
    "program.lengthOfStay",
    enumOptions(LENGTHS_OF_STAY, [
      "Emergency (nightly)",
      "Short-term (up to 90 days)",
      "Transitional (up to 24 months)",
      "Permanent (open-ended)",
    ]),
  ),
  enumFilter(
    "population",
    "Population served",
    "single-select",
    "program.population",
    enumOptions(POPULATIONS, ["Individuals", "Families", "Both"]),
  ),
  enumFilter(
    "gender",
    "Gender",
    "single-select",
    "program.gender",
    enumOptions(GENDERS, ["Men", "Women", "All"]),
  ),
  enumFilter("ward", "Ward", "multi-select", "unit.ward", wardOptions),
  booleanFilter("referral-required", "Referral required", "program.referralRequired"),
  booleanFilter("sobriety", "Sobriety required", "program.sobrietyRequired"),
  booleanFilter("background-check", "Background check", "program.backgroundCheckRequired"),
  booleanFilter(
    "sex-offense-restrictions",
    "Sex-offense restrictions",
    "program.sexOffenseRestrictions",
  ),
  booleanFilter("treatment", "Treatment required", "program.treatmentRequired"),
  booleanFilter("housing-vouchers", "Housing vouchers accepted", "program.housingVouchersAccepted"),
];
