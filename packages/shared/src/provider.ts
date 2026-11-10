import Type, { type Static } from "typebox";

/**
 * Housing provider: the contact-bearing organization at the top of the
 * Provider → Program → Unit hierarchy. Contact details are optional strings
 * — a missing contact is absent, never fabricated.
 */
export const ProviderSchema = Type.Object(
  {
    id: Type.String({ description: "Stable provider identifier." }),
    organization: Type.String({ description: "Organization name shown as the contact." }),
    phone: Type.Optional(Type.String({ description: "Contact phone, when the source states it." })),
    email: Type.Optional(Type.String({ description: "Contact email, when the source states it." })),
    website: Type.Optional(
      Type.String({
        pattern: "^https?://",
        description: "Contact website URL (http/https), when the source states it.",
      }),
    ),
  },
  {
    description:
      "Housing provider: the contact-bearing organization at the top of the " +
      "Provider → Program → Unit hierarchy. A missing contact field is absent — " +
      "never fabricated.",
  },
);
export type Provider = Static<typeof ProviderSchema>;
