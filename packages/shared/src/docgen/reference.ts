/**
 * Composition of the generated data-model reference: the explicit, ordered
 * list of schemas the renderer turns into `docs/data-model.md`. The order
 * here is the document order; adding a schema to the reference means adding
 * it here. All prose lives in the schemas' own annotations.
 */
import {
  CoordinatesSchema,
  ErrorCodeSchema,
  ErrorEnvelopeSchema,
  FilterControlSchema,
  FilterDefinitionSchema,
  FilterOptionSchema,
  FilterSchemaResponseSchema,
  FilterTargetSchema,
  ProviderSchema,
  ProgramSchema,
  SCHEMA_VERSION,
  UnitCardSchema,
  UnitSchema,
  UnitsResponseSchema,
  UnitSizeSchema,
  UNIT_FILTERS,
} from "../index";
import type { ModelReferenceInput } from "./render";

export const MODEL_REFERENCE: ModelReferenceInput = {
  schemaVersion: SCHEMA_VERSION,
  blocks: [
    {
      kind: "schemas",
      entries: [
        { title: "Coordinates", schema: CoordinatesSchema },
        { title: "Provider", schema: ProviderSchema },
        { title: "Program", schema: ProgramSchema },
        { title: "UnitSize", schema: UnitSizeSchema },
        { title: "Unit", schema: UnitSchema },
        { title: "UnitCard", schema: UnitCardSchema },
      ],
    },
    {
      kind: "schemas",
      entries: [
        { title: "FilterControl", schema: FilterControlSchema },
        { title: "FilterOption", schema: FilterOptionSchema },
        { title: "FilterTarget", schema: FilterTargetSchema },
        { title: "FilterDefinition", schema: FilterDefinitionSchema },
      ],
    },
    { kind: "filter-table", title: "Filters", filters: UNIT_FILTERS },
    {
      kind: "schemas",
      entries: [
        { title: "UnitsResponse", schema: UnitsResponseSchema },
        { title: "FilterSchemaResponse", schema: FilterSchemaResponseSchema },
        { title: "ErrorEnvelope", schema: ErrorEnvelopeSchema },
        { title: "Error codes", schema: ErrorCodeSchema },
      ],
    },
  ],
};
