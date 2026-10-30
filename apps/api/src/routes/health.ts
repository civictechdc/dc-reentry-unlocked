import Type from "typebox";
import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { ERROR_RESPONSE_SCHEMAS } from "../error-schemas";

/** A health probe separate from data concerns: plain ok, no envelope. */
export const healthRoutes: FastifyPluginAsyncTypebox = async (app) => {
  await app.get(
    "/health",
    {
      schema: {
        description: "Service health probe.",
        response: {
          200: Type.Object({ status: Type.Literal("ok") }),
          ...ERROR_RESPONSE_SCHEMAS,
        },
      },
    },
    () => ({ status: "ok" as const }),
  );
};
