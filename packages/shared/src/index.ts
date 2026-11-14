import Value from "typebox/value";

export { Value };

/**
 * Runtime value-utilities re-export: consumers validate shared payloads with
 * `Value.Check` without taking their own `typebox` dependency.
 */

export {
  SCHEMA_VERSION,
  SchemaVersionSchema,
  POLICY_STATES,
  PolicyStateSchema,
  WardSchema,
  QUADRANTS,
  QuadrantSchema,
  CoordinatesSchema,
  AVAILABILITY_STATES,
  AvailabilityStateSchema,
  VERIFICATION_BADGES,
  VerificationBadgeSchema,
} from "./primitives";
export type {
  PolicyState,
  Ward,
  Quadrant,
  Coordinates,
  AvailabilityState,
  VerificationBadge,
} from "./primitives";

export { ProviderSchema } from "./provider";
export type { Provider } from "./provider";

export { ProgramSchema, HOUSING_TYPES, LENGTHS_OF_STAY, POPULATIONS, GENDERS } from "./program";
export type { Program, HousingType, LengthOfStay, Population, Gender } from "./program";

export { UnitSchema, UnitCardSchema, UnitSizeSchema, ROOM_TYPES, RoomTypeSchema } from "./unit";
export type { Unit, UnitCard, UnitSize, RoomType } from "./unit";

export {
  FILTER_CONTROLS,
  FilterControlSchema,
  FilterOptionSchema,
  FILTER_TARGETS,
  FilterTargetSchema,
  FilterDefinitionSchema,
  UNIT_FILTERS,
  wardOptions,
} from "./filters";
export type { FilterControl, FilterOption, FilterTarget, FilterDefinition } from "./filters";

export {
  SYNTHETIC_DISCLOSURE,
  UnitsResponseSchema,
  FilterSchemaResponseSchema,
  ERROR_CODES,
  ErrorCodeSchema,
  ErrorEnvelopeSchema,
} from "./envelopes";
export type { UnitsResponse, FilterSchemaResponse, ErrorCode, ErrorEnvelope } from "./envelopes";
