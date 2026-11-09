/**
 * Single source of truth for web feature-flag names.
 *
 * A flag guards candidate behavior with the compile-time define constant
 * `__FLAG_<SCREAMING_SNAKE>__` (declared in `./flag-globals.d.ts`) plus the
 * dev-only page-load override (`?flags=<name>` — see `./index.ts`). Names
 * are kebab-case; the derivations below build the matching environment and
 * define keys. The blessed consumer shape lives in `./README.md`.
 *
 * Adding a flag: append its name to the tuple below and add one matching
 * `declare const __FLAG_<SCREAMING_SNAKE>__: boolean;` line to
 * `./flag-globals.d.ts`. Removing a flag when its feature graduates is the
 * same two lines in reverse.
 */

/**
 * Every registered flag name, as a tuple of kebab-case strings. The first
 * entries are the candidate controls `w1-map-zoom` and `w2-recenter`. An
 * entry here lights up the command-time environment variable and the
 * page-load URL override for that name; the matching
 * `declare const __FLAG_<SCREAMING_SNAKE>__: boolean;` line in
 * `./flag-globals.d.ts` is what makes its guard global valid (the README
 * documents the two-line ritual).
 */
export const FEATURE_FLAGS = ["w1-map-zoom", "w2-recenter"] as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

/** Kebab-case flag name → SCREAMING_SNAKE_CASE (`w1-map-zoom` → `W1_MAP_ZOOM`). */
function screamingSnake(name: string): string {
  return name
    .split("-")
    .map((part) => part.toUpperCase())
    .join("_");
}

/** Command-time environment key (`w1-map-zoom` → `VITE_FEATURE_W1_MAP_ZOOM`). */
export function flagEnvKey(name: string): string {
  return `VITE_FEATURE_${screamingSnake(name)}`;
}

/** Compile-time define key (`w1-map-zoom` → `__FLAG_W1_MAP_ZOOM__`). */
export function flagDefineKey(name: string): string {
  return `__FLAG_${screamingSnake(name)}__`;
}

/**
 * Whether this invocation is a dev-server run (`vite dev`): the only
 * context where command-time flag variables have any effect. Kept pure
 * and shared: the vite config keys both the flag defines and the CSP
 * inline-script relaxation on it.
 */
export function isDevServerRun(command: string, mode: string): boolean {
  return command === "serve" && mode === "development";
}

/**
 * The environment flag defines read from: only a dev-server run sees
 * command-time flag variables, and only the `VITE_FEATURE_`-prefixed
 * entries of it. Every other invocation (any `vite build`,
 * `vite preview`) gets an empty environment, so all defines fold to
 * `false` and guarded code is eliminated regardless of exported
 * variables; filtering keeps unrelated environment (paths, CI tokens)
 * from ever being baked into defines.
 */
export function flagDefineEnv(
  command: string,
  mode: string,
  env: Record<string, string | undefined>,
): Record<string, string | undefined> {
  if (!isDevServerRun(command, mode)) return {};
  return Object.fromEntries(Object.entries(env).filter(([key]) => key.startsWith("VITE_FEATURE_")));
}

/**
 * One `define` entry per listed flag, read from the command-time
 * environment (`"1"` enables the flag; anything else — unset, `"0"`,
 * anything not `"1"` — leaves it off). Pure, so `vite.config.ts` can call
 * it with `FEATURE_FLAGS` and unit tests can drive it with a fake
 * environment and fake names.
 */
export function buildFlagDefines(
  names: readonly string[],
  env: Record<string, string | undefined>,
): Record<string, boolean> {
  const defines: Record<string, boolean> = {};
  for (const name of names) {
    defines[flagDefineKey(name)] = env[flagEnvKey(name)] === "1";
  }
  return defines;
}
