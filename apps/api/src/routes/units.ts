import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { SCHEMA_VERSION, UnitsResponseSchema } from "@dc-reentry/shared";
import { parseFilterSelection, FILTER_QUERY_SCHEMA } from "../filter-params";
import { ERROR_RESPONSE_SCHEMAS } from "../error-schemas";

/** The available-units listing, filtered through the shared filter schema. */
export const unitsRoutes: FastifyPluginAsyncTypebox = async (app) => {
  await app.get(
    "/units",
    {
      schema: {
        description:
          "Currently-available housing units as self-contained cards, optionally filtered. Unknown-at-source policy fields match every enum value selection and boolean no-selections.",
        querystring: FILTER_QUERY_SCHEMA,
        response: {
          200: UnitsResponseSchema,
          ...ERROR_RESPONSE_SCHEMAS,
        },
      },
    },
    (request) => ({
      schemaVersion: SCHEMA_VERSION,
      units: app.units.listUnits(parseFilterSelection(request.query)),
    }),
  );
};
