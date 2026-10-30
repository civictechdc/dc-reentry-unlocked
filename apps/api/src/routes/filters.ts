import { SCHEMA_VERSION, FilterSchemaResponseSchema } from "@dc-reentry/shared";
import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { ERROR_RESPONSE_SCHEMAS } from "../error-schemas";

/** Serves the published filter schema — the single source of truth of filters. */
export const filtersRoutes: FastifyPluginAsyncTypebox = async (app) => {
  await app.get(
    "/filters",
    {
      schema: {
        description:
          "The filter schema that drives renderers: the pinned definitions, published exactly as they exist in the shared contract.",
        response: {
          200: FilterSchemaResponseSchema,
          ...ERROR_RESPONSE_SCHEMAS,
        },
      },
    },
    () => ({
      schemaVersion: SCHEMA_VERSION,
      filters: app.units.filterSchema,
    }),
  );
};
