import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { ERROR_RESPONSE_SCHEMAS } from "../error-schemas";

/** Serves the generated OpenAPI document (JSON only — no UI is mounted). */
export const openApiRoutes: FastifyPluginAsyncTypebox = async (app) => {
  await app.get(
    "/openapi.json",
    {
      schema: {
        description: "The machine-readable OpenAPI document, generated from the route schemas.",
        // The document is produced by the swagger decorator itself; no
        // response schema is attached for 200 (a projection would empty the
        // payload), but error responses carry the shared envelope contract.
        response: {
          ...ERROR_RESPONSE_SCHEMAS,
        },
      },
    },
    (_request, reply) => reply.send(app.swagger()),
  );
};
