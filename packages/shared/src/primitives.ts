import Type, { type Static } from "typebox";

/**
 * Primitives shared by every contract in this package.
 *
 * Unknown honesty (spec: "Unknown is a representable state"): EVERY
 * policy/eligibility field supports unknown (the honest "Unknown"). The
 * enumerated eligibility fields extend their taxonomy with the same
 * "unknown" literal the tri-state PolicyState uses — one representation,
 * consistent across the contract. Unknown is a data state only; filter
 * option lists stay the pinned taxonomies.
 */

/** Version of the shared contract carried by card and envelope payloads. */
export const SCHEMA_VERSION = "0.2";

export const SchemaVersionSchema = Type.Literal(SCHEMA_VERSION, {
  description: "The shared-contract schema version this payload speaks.",
});

/**
 * Tri-state policy value: known yes / known no / unknown ("Unknown").
 * Boolean filter semantics map `unknown` against "no" selections
 * (API layer), while detail data always retains the honest unknown.
 */
export const POLICY_STATES = ["yes", "no", "unknown"] as const;

export const PolicyStateSchema = Type.Enum([...POLICY_STATES], {
  description: 'Tri-state policy value: known yes / known no / unknown ("Unknown").',
  "x-enum-meanings": {
    yes: "The policy applies.",
    no: "The policy does not apply.",
    unknown: "Unknown — never fabricated as yes or no.",
  },
});
export type PolicyState = Static<typeof PolicyStateSchema>;

/** The 8 DC wards (numbers validated by range, not by a type alias). */
export const WardSchema = Type.Integer({
  minimum: 1,
  maximum: 8,
  description: "DC ward number, 1–8; the synthetic dataset covers every ward.",
});
export type Ward = Static<typeof WardSchema>;

/** DC address quadrants. */
export const QUADRANTS = ["NW", "NE", "SW", "SE"] as const;

export const QuadrantSchema = Type.Enum([...QUADRANTS], {
  description: "DC address quadrant.",
  "x-enum-meanings": {
    NW: "Northwest.",
    NE: "Northeast.",
    SW: "Southwest.",
    SE: "Southeast.",
  },
});
export type Quadrant = Static<typeof QuadrantSchema>;

/**
 * Geo coordinates for a unit's exact street-level location. Every unit and
 * card carries coordinates — exact addresses only; the approximate-location
 * representation (precision flag, null coordinates) was removed in the
 * 2026-10-31 revision (user decision).
 */
export const CoordinatesSchema = Type.Object(
  {
    latitude: Type.Number({ description: "Latitude in decimal degrees." }),
    longitude: Type.Number({ description: "Longitude in decimal degrees." }),
  },
  {
    description:
      "Exact street-level coordinates for a unit's location — required and non-null on every " +
      "unit and card (exact addresses only; the approximate-location representation was " +
      "removed in the 2026-10-31 revision, user decision).",
  },
);
export type Coordinates = Static<typeof CoordinatesSchema>;

/**
 * Per-unit availability state: available / not available /
 * unverified-availability. Only `available` units ever surface — that gating
 * is the DataSource/API layer's job, but the schema represents every state.
 */
export const AVAILABILITY_STATES = [
  "available",
  "not-available",
  "unverified-availability",
] as const;

export const AvailabilityStateSchema = Type.Enum([...AVAILABILITY_STATES], {
  description:
    "Per-unit availability state. Only `available` units ever surface — that gating is the " +
    "DataSource/API layer's job, but the schema represents every state.",
  "x-enum-meanings": {
    available: "The unit is available.",
    "not-available": "The unit is not available.",
    "unverified-availability": "Availability has not been verified with the source.",
  },
});
export type AvailabilityState = Static<typeof AvailabilityStateSchema>;

/**
 * Displayable confirmation badge for available units: confirmed with the
 * source vs still needing verification.
 */
export const VERIFICATION_BADGES = ["confirmed", "needs-verification"] as const;

export const VerificationBadgeSchema = Type.Enum([...VERIFICATION_BADGES], {
  description: "Displayable confirmation badge for available units.",
  "x-enum-meanings": {
    confirmed: "Availability was confirmed with the source.",
    "needs-verification": "Availability still needs verification.",
  },
});
export type VerificationBadge = Static<typeof VerificationBadgeSchema>;
