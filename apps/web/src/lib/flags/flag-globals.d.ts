/**
 * Ambient declarations for the per-flag compile-time define constants that
 * `vite.config.ts` emits: one `__FLAG_<SCREAMING_SNAKE>__` boolean per
 * entry in `./registry.ts` (built by `buildFlagDefines`), plus the shared
 * `__DEV_SERVER__` dev-server marker.
 *
 * The registry's first entries are the candidate controls `w1-map-zoom`
 * and `w2-recenter`, whose globals are declared below. Each added flag
 * adds exactly one line here, beside its registry entry:
 *
 *   declare const __FLAG_EXAMPLE_NAME__: boolean;
 *
 * (The line above is an example for a hypothetical flag named
 * "example-name", not a declaration of a real flag.)
 *
 * These declarations are what make an unregistered `__FLAG_*__` reference
 * a compile error: TypeScript resolves the global only when a matching
 * declaration exists, so a typo'd or never-registered name fails the type
 * check instead of surfacing as `undefined` at run time.
 */

/** True only for a dev-server run (`vite dev`); `false` in every build/preview. */
declare const __DEV_SERVER__: boolean;

/** Launch default for the `w1-map-zoom` walkthrough zoom control. */
declare const __FLAG_W1_MAP_ZOOM__: boolean;

/** Launch default for the `w2-recenter` walkthrough recenter control. */
declare const __FLAG_W2_RECENTER__: boolean;

/** The naming contract for define constants: `__FLAG_<SCREAMING_SNAKE>__`. */
declare type FlagDefineName = `__FLAG_${string}__`;
