/**
 * Dev-only page-load flag override.
 *
 * In a development session, a page load can enable registered flags for
 * that load with `?flags=name1,name2` on the app URL — a reload applies
 * changes, never a dev-server restart. Unknown names are dropped while
 * parsing; an empty value enables nothing.
 *
 * Outside a dev-server run this module is inert by construction: consumers
 * consult it only inside the blessed guard shape
 * `__FLAG_<NAME>__ || (__DEV_SERVER__ && hasFlagOverride("name"))`
 * (see `./README.md`), where both anchors — this repo's own define
 * constants — fold to `false` in any `vite build` and the guarded code is
 * dead-code-eliminated.
 */
import { FEATURE_FLAGS, type FeatureFlag } from "./registry";

/**
 * Parse a query string's `flags` parameter into the set of registered
 * names it enables. Pure — takes the raw search text and the valid names
 * explicitly, so unit tests drive it without a window and without
 * depending on registry contents.
 */
export function parseFlagOverrides(raw: string, valid: readonly string[]): ReadonlySet<string> {
  const param = new URLSearchParams(raw).get("flags") ?? "";
  const registered = new Set(valid);
  return new Set(param.split(",").filter((name) => registered.has(name)));
}

/**
 * The override set, parsed once at module load. Gated on the dev-server
 * define: in any `vite build` the constant is statically replaced with
 * `false`, the ternary folds to an empty set, and none of the URL-reading
 * override machinery survives into the production bundle.
 */
const flagOverrides: ReadonlySet<string> = __DEV_SERVER__
  ? parseFlagOverrides(typeof location === "undefined" ? "" : location.search, FEATURE_FLAGS)
  : new Set<string>();

/**
 * Whether this page load's URL override enables `name`. Dev-only by
 * contract — always pair it behind `__DEV_SERVER__ &&` as in the blessed
 * guard shape in `./README.md`.
 */
export function hasFlagOverride(name: FeatureFlag): boolean {
  if (!__DEV_SERVER__) return false;
  return flagOverrides.has(name);
}
