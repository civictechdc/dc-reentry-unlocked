import Type, { type Static } from "typebox";

/**
 * Housing provider: the contact-bearing organization at the top of the
 * Provider → Program → Unit hierarchy. Contact details are optional strings
 * — a missing contact is absent, never fabricated.
 */
export const ProviderSchema = Type.Object({
  id: Type.String(),
  organization: Type.String(),
  phone: Type.Optional(Type.String()),
  email: Type.Optional(Type.String()),
  website: Type.Optional(Type.String({ pattern: "^https?://" })),
});
export type Provider = Static<typeof ProviderSchema>;
