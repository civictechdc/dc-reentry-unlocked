/**
 * Reroute hook (must be exported from hooks.ts, not hooks.server.ts) —
 * undoes any localized URL prefix the Paraglide URL strategy may add; with
 * the English-only base locale it is an identity operation, but kept in
 * place so adding a locale later needs no routing changes here.
 */
import type { Reroute } from "@sveltejs/kit/hooks";
import { deLocalizeUrl } from "#lib/paraglide/runtime.js";

export const reroute: Reroute = (request) => {
  return deLocalizeUrl(request.url).pathname;
};
