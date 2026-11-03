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

export const RoomTypeSchema = Type.Enum([...ROOM_TYPES]);
export type RoomType = Static<typeof RoomTypeSchema>;

/** Physical unit size: square footage plus room type. */
export const UnitSizeSchema = Type.Object({
  squareFeet: Type.Number(),
  roomType: RoomTypeSchema,
});
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
export const UnitSchema = Type.Object({
  id: Type.String(),
  programId: Type.String(),
  address: Type.String({ minLength: 1 }),
  ward: WardSchema,
  quadrant: QuadrantSchema,
  /** Exact street-level coordinates — every unit is pinned to a real place. */
  coordinates: CoordinatesSchema,
  bedrooms: Type.Number(),
  size: UnitSizeSchema,
  /** Monthly cost to the returning citizen (rent portion). */
  cost: Type.Number(),
  availabilityState: AvailabilityStateSchema,
  availabilityConfirmed: Type.Boolean(),
});
export type Unit = Static<typeof UnitSchema>;

/**
 * The flattened self-contained unit card: unit fields joined with the owning
 * program's policy fields and the provider's contact fields, so a consumer
 * needs no further lookups. Carried only by available units (DataSource/API
 * gating); the verification badge exposes source-confirmation status.
 */
export const UnitCardSchema = Type.Object({
  schemaVersion: Type.Literal(SCHEMA_VERSION),
  id: Type.String(),
  programId: Type.String(),
  address: Type.String({ minLength: 1 }),
  ward: WardSchema,
  quadrant: QuadrantSchema,
  coordinates: CoordinatesSchema,
  bedrooms: Type.Number(),
  size: UnitSizeSchema,
  cost: Type.Number(),
  /** Source availability state and confirmation flag the card was built from. */
  availabilityState: AvailabilityStateSchema,
  availabilityConfirmed: Type.Boolean(),
  verificationBadge: VerificationBadgeSchema,
  program: ProgramSchema,
  provider: ProviderSchema,
});
export type UnitCard = Static<typeof UnitCardSchema>;
