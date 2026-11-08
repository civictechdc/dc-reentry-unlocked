# Design

## Context

`apps/web` is a SvelteKit 3 / Vite 8 SPA with exactly one non-dev build
path (`vite build`, used by the Docker image and `e2e:prod`); development
runs `vite dev`. So "production, pre-prod, beta" collapses to "every
`vite build` output" (see proposal.md — Why, for the trialing motivation).

Verified Vite 8 behaviors this design leans on (checked against the
Vite 8.3.5 docs, not memory):

- `import.meta.env.DEV` is statically replaced at build time; code inside
  `if (import.meta.env.DEV) { … }` is tree-shaken from production builds.
- `define` entries are globals during dev and statically replaced during
  build, enabling constant folding and dead-code elimination.

Mechanism decision (user decision 2026-11-07 planning session, resolving
the proposal's deferred choice): **compile-time defines + dev-only page-load
URL override** — command-time env vars set session defaults; a `?flags=`
query parameter overrides per page load; changing flags needs at most a
reload, never a dev-server restart.

## Goals / Non-Goals

**Goals:**

- One toggle module in `apps/web` future riders (starting with
  `walkthrough-quick-wins`) import to guard candidate behavior.
- Flagged code and override machinery provably absent from every
  `vite build` output.
- Flag names declared once; unregistered names fail statically.

**Non-Goals:**

- Any runtime flag surface in non-dev builds (no config UI, no query-param
  handling, no flag object shipped).
- Live mid-session toggling without a page reload (a reactive registry was
  considered and deferred — reload-to-apply is enough for trialing).
- Server-side (API) flags; this change is web-app only.
- Actually guarding any feature: the first consumers land in
  `walkthrough-quick-wins`.

## Decisions

### D1 — Per-flag compile-time define constants

`src/lib/flags/registry.ts` declares flag names:

```ts
export const FEATURE_FLAGS = [] as const;  // names added as riders land
export type FeatureFlag = (typeof FEATURE_FLAGS)[number];
```

The vite config imports the registry (same pattern as the existing
`./src/lib/security/csp.ts` import) and emits one `define` entry per name:
`__FLAG_<SCREAMING_SNAKE>__` → boolean, read from
`process.env.VITE_FEATURE_<SCREAMING_SNAKE>` (`"1"` = on; anything else =
off; default off). Env is the command-time surface:
`VITE_FEATURE_W1_MAP_ZOOM=1 pnpm -C apps/web dev`.

Alternatives considered: one JSON object define (member access on the
replaced literal is not guaranteed to fold); `VITE_`-prefixed
`import.meta.env` reads (stringly-typed, same folding caveat);
a plain module-level config object (not statically replaceable at all).

### D2 — Dev-only page-load URL override

`src/lib/flags/index.ts` exposes `hasFlagOverride(name: FeatureFlag)`:
in a dev-server session it parses `?flags=a,b` from `location.search`
once at module load and reports membership; in any build it is a dead
branch (see D3). Unknown names are dropped during parsing (spec:
ignored). Reload applies changes; no HMR/reactive store needed.

### D3 — Blessed guard shape (the elimination contract)

Consumers guard with exactly:

```ts
if (__FLAG_W1_MAP_ZOOM__ || (__DEV_SERVER__ && hasFlagOverride("w1-map-zoom"))) { … }
```

Both anchors are this change's own define constants, not Vite's
`import.meta.env.DEV`: the vite config emits `__DEV_SERVER__` true only
for a dev-server run (`command === "serve" && mode === "development"`,
the same predicate that gates the env vars), so in **every** `vite
build` — whatever `NODE_ENV` or `--mode` is in effect — both constants
are statically replaced with `false`, the expression folds to `false`,
and the guarded code plus the override machinery are eliminated.
(`import.meta.env.DEV` was rejected as the anchor: Vite derives it from
`NODE_ENV`, so a self-built `NODE_ENV=development` bundle would keep the
override surface alive.) In dev the guard is the launch default
OR-joined with the URL override. TypeScript declarations for the
`__FLAG_*__` and `__DEV_SERVER__` globals ship beside the registry so an
unregistered name is a compile error (spec: registry requirement).

A helper function like `isFlagOn("w1-map-zoom")` was rejected: call
expressions are not statically foldable, so guarded code would ship dead
in production bundles — exactly what the spec forbids.

### D4 — Elimination proof rides in with the first consumer

The registry starts empty (no real riders yet), so this change proves the
wiring with unit tests on the pure pieces (env→define builder, override
parser, name derivation, the dev-server predicate). The build-output scan
(spec: stripped-code requirement) needs a real flag-guarded consumer to
grep for, so it lands as a task in `walkthrough-quick-wins` when the
first rider checks in — recorded here so it is not forgotten. That scan
must fail on BOTH signals: guarded-feature code present, and any stray
`__FLAG_`/`__DEV_SERVER__` identifier in the output (the drift case of a
`flag-globals.d.ts` declaration without a registry entry, which would
otherwise surface only as a dev-time `ReferenceError`).

### D5 — CSP inline-script gate rides the same predicate (user decision 2026-11-07)

Security review of this diff surfaced a pre-existing adjacent hazard:
`allowInlineScripts` (CSP `unsafe-inline`) was derived from
`process.env.NODE_ENV !== "production"`, so a self-built bundle with
`NODE_ENV=staging`/`test` shipped `unsafe-inline`. The user approved
folding the fix into this change: the flag now keys on the same
`serve`+`development` predicate the flags use (`isDevServerRun`), making
the CSP invariant build-safe against `NODE_ENV` tricks. Dev-server
behavior is unchanged (inline scripts still allowed for HMR); every
build and `vite preview` now excludes `unsafe-inline` unconditionally.

## Risks / Trade-offs

- [Constant-folding beyond the two documented anchors (e.g. minifier
  folding `false || x`) is assumed] → guard shape uses only the
  documented replacements; D4's build-output scan will prove the full
  fold on real consumers and fails the build if any guarded code leaks.
- [Vitest does not apply `vite.config.ts` `define` entries (separate
  config), so `__DEV_SERVER__` is undefined under test] → the web
  vitest setup defaults it to `false` and flag tests stub it per case
  (`vi.stubGlobal`); unit tests cover the pure builder, parser, and
  predicate, not bundle output.
- [A consumer forgets the guard shape and ships flag code] → module docs
  show the exact snippet; D4's scan is the backstop for riders.
- [Flag names accumulate in the registry after features graduate] →
  registry pruning is part of each rider's graduation (flag removal) —
  noted in runbook.

## Migration Plan

Additive only: empty registry, no consumers, no behavior change. Rollback
is reverting the commit.

## Open Questions

None — the mechanism decision was resolved this session (D1–D3).
