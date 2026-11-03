import Type, { type Static } from "typebox";

/**
 * Primitives shared by every contract in this package.
 *
 * Unknown honesty (spec: "Unknown is a representable state"): EVERY
 * policy/eligibility field supports unknown ("not publicly listed"). The
 * enumerated eligibility fields extend their taxonomy with the same
 * "unknown" literal the tri-state PolicyState uses — one representation,
 * consistent across the contract. Unknown is a data state only; filter
 * option lists stay the pinned taxonomies.
 */

/** Version of the shared contract carried by card and envelope payloads. */
export const SCHEMA_VERSION = "2.0";

export const SchemaVersionSchema = Type.Literal(SCHEMA_VERSION);

/**
 * Tri-state policy value: known yes / known no / unknown ("not publicly
 * listed"). Boolean filter semantics map `unknown` against "no" selections
 * (API layer), while detail data always retains the honest unknown.
 */
export const POLICY_STATES = ["yes", "no", "unknown"] as const;

export const PolicyStateSchema = Type.Enum([...POLICY_STATES]);
export type PolicyState = Static<typeof PolicyStateSchema>;

/** The 8 DC wards (numbers validated by range, not by a type alias). */
export const WardSchema = Type.Integer({ minimum: 1, maximum: 8 });
export type Ward = Static<typeof WardSchema>;

/** DC address quadrants. */
export const QUADRANTS = ["NW", "NE", "SW", "SE"] as const;

export const QuadrantSchema = Type.Enum([...QUADRANTS]);
export type Quadrant = Static<typeof QuadrantSchema>;

/**
 * Geo coordinates for a unit's exact street-level location. Every unit and
 * card carries coordinates — exact addresses only; the approximate-location
 * representation (precision flag, null coordinates) was removed in schema
 * version 2.0 (user decision 2026-10-31).
 */
export const CoordinatesSchema = Type.Object({
  latitude: Type.Number(),
  longitude: Type.Number(),
});
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

export const AvailabilityStateSchema = Type.Enum([...AVAILABILITY_STATES]);
export type AvailabilityState = Static<typeof AvailabilityStateSchema>;

/**
 * Displayable confirmation badge for available units: confirmed with the
 * source vs still needing verification.
 */
export const VERIFICATION_BADGES = ["confirmed", "needs-verification"] as const;

export const VerificationBadgeSchema = Type.Enum([...VERIFICATION_BADGES]);
export type VerificationBadge = Static<typeof VerificationBadgeSchema>;
