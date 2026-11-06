import Type, { type Static } from "typebox";
import {
  AvailabilityStateSchema,
  CoordinatesSchema,
  QuadrantSchema,
  SCHEMA_VERSION,
  VerificationBadgeSchema,
  WardSchema,
} from "./primitives";
import { ProgramSchema } from "./program";
import { ProviderSchema } from "./provider";

/** Room type alongside square footage. */
export const ROOM_TYPES = ["private-room", "shared-room", "efficiency", "apartment"] as const;

export const RoomTypeSchema = Type.Enum([...ROOM_TYPES], {
  description: "Room type alongside square footage.",
  "x-enum-meanings": {
    "private-room": "Private room.",
    "shared-room": "Shared room.",
    efficiency: "Efficiency unit.",
    apartment: "Full apartment.",
  },
});
export type RoomType = Static<typeof RoomTypeSchema>;

/** Physical unit size: square footage plus room type. */
export const UnitSizeSchema = Type.Object(
  {
    squareFeet: Type.Number({ description: "Floor area in square feet." }),
    roomType: RoomTypeSchema,
  },
  { description: "Physical unit size: square footage plus room type." },
);
export type UnitSize = Static<typeof UnitSizeSchema>;

/**
 * A housing unit in the full inventory — every availability state is
 * representable here. Only units whose availability state is `available`
 * surface (that gating happens in the DataSource/API layer, not here).
 *
 * `availabilityConfirmed` is the separate confirmation flag for available
 * units: the confirmed-vs-needs-verification distinction rendered as the
 * verification badge on cards.
 */
export const UnitSchema = Type.Object(
  {
    id: Type.String({ description: "Stable unit identifier." }),
    programId: Type.String({ description: "Identifier of the owning program." }),
    address: Type.String({
      minLength: 1,
      description: "Exact street address (never empty; exact addresses only).",
    }),
    ward: WardSchema,
    quadrant: QuadrantSchema,
    /** Exact street-level coordinates — every unit is pinned to a real place. */
    coordinates: CoordinatesSchema,
    bedrooms: Type.Number({ description: "Bedroom count." }),
    size: UnitSizeSchema,
    /** Monthly cost to the returning citizen (rent portion). */
    cost: Type.Number({ description: "Monthly cost to the returning citizen (rent portion)." }),
    availabilityState: AvailabilityStateSchema,
    availabilityConfirmed: Type.Boolean({
      description: "Whether availability was confirmed with the source.",
    }),
  },
  {
    description:
      "A housing unit in the full inventory — every availability state is representable. " +
      "Only units whose availability state is `available` surface (that gating happens in " +
      "the DataSource/API layer, not here).",
  },
);
export type Unit = Static<typeof UnitSchema>;

/**
 * The flattened self-contained unit card: unit fields joined with the owning
 * program's policy fields and the provider's contact fields, so a consumer
 * needs no further lookups. Carried only by available units (DataSource/API
 * gating); the verification badge exposes source-confirmation status.
 */
export const UnitCardSchema = Type.Object(
  {
    schemaVersion: Type.Literal(SCHEMA_VERSION, {
      description: "The shared-contract schema version this payload speaks.",
    }),
    id: Type.String({ description: "Stable unit identifier." }),
    programId: Type.String({ description: "Identifier of the owning program." }),
    address: Type.String({
      minLength: 1,
      description: "Exact street address (never empty; exact addresses only).",
    }),
    ward: WardSchema,
    quadrant: QuadrantSchema,
    coordinates: CoordinatesSchema,
    bedrooms: Type.Number({ description: "Bedroom count." }),
    size: UnitSizeSchema,
    cost: Type.Number({ description: "Monthly cost to the returning citizen (rent portion)." }),
    /** Source availability state and confirmation flag the card was built from. */
    availabilityState: AvailabilityStateSchema,
    availabilityConfirmed: Type.Boolean({
      description: "Whether availability was confirmed with the source (1:1 with the badge).",
    }),
    verificationBadge: VerificationBadgeSchema,
    program: ProgramSchema,
    provider: ProviderSchema,
  },
  {
    description:
      "The flattened self-contained unit card: unit fields joined with the owning program's " +
      "policy fields and the provider's contact fields, so a consumer needs no further " +
      "lookups. Carried only by available units (DataSource/API gating); the verification " +
      "badge exposes source-confirmation status.",
    examples: [
      {
        schemaVersion: "2.0",
        id: "u-1001",
        programId: "p-2001",
        address: "1234 Example Street NW",
        ward: 5,
        quadrant: "NW",
        coordinates: { latitude: 38.913, longitude: -77.032 },
        bedrooms: 1,
        size: { squareFeet: 350, roomType: "private-room" },
        cost: 850,
        availabilityState: "available",
        availabilityConfirmed: true,
        verificationBadge: "confirmed",
        program: {
          id: "p-2001",
          name: "Example Reentry Housing Program",
          applicationProcess: "Call the office to schedule an intake interview.",
          housingType: "transitional",
          lengthOfStay: "transitional-up-to-24-months",
          population: "both",
          gender: "all",
          referralRequired: "no",
          sobrietyRequired: "unknown",
          backgroundCheckRequired: "yes",
          sexOffenseRestrictions: "yes",
          treatmentRequired: "no",
          housingVouchersAccepted: "unknown",
        },
        provider: {
          id: "v-3001",
          organization: "Example Housing Provider DC",
          phone: "202-555-0100",
          email: "intake@example.org",
          website: "https://example.org",
        },
      },
    ],
  },
);
export type UnitCard = Static<typeof UnitCardSchema>;
