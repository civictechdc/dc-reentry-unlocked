# Web feature flags — dev-only toggles for candidate features

Feature flags let candidate web behavior ship guarded and disabled by
default, so it can be trialed in a running development session. Flagged
code and all toggle machinery are absent from every non-development
build (`vite build` — the Docker image and the production e2e probe):
elimination is by construction, because both guard anchors are this
repo's own define constants and are forced `false` in every build. An
empirical scan of the emitted bundle joins with the first flagged
feature.

## Flags are never a security boundary

Flags gate candidate UX trials only — never authorization, access
control, or any security-relevant behavior. A flag is a compile-time
constant plus a dev-only URL override: trivially flipped in a development
session, and absent from production builds rather than enforced there.
Anything that must be enforced stays behind the API's real checks.

## The blessed guard shape

Guard candidate behavior with exactly this shape:

```ts
if (__FLAG_EXAMPLE_NAME__ || (__DEV_SERVER__ && hasFlagOverride("example-name"))) {
  // candidate behavior
}
```

`__FLAG_EXAMPLE_NAME__` / `"example-name"` are placeholders for
illustration — real names must be registered in `registry.ts`, and an
unregistered `__FLAG_*__` name is a compile error (the ambient
declarations in `flag-globals.d.ts` only cover registered flags plus the
shared `__DEV_SERVER__`).

Keep the shape literal. Its two elimination anchors, in any `vite build`
— whatever `NODE_ENV` or `--mode` is in effect:

1. The define constant folds to `false` — `vite.config.ts` emits one
   `__FLAG_<SCREAMING_SNAKE>__` boolean per registry entry
   (`buildFlagDefines`), `true` only when the flag's
   `VITE_FEATURE_<NAME>=1` was set for the command that started the **dev
   server**. Even with the variable exported, non-dev builds ignore it
   entirely: `flagDefineEnv` gives every build (and preview) an empty
   environment, forcing all defines to `false`. In dev it is the launch
   default.
2. `__DEV_SERVER__` folds to `false` too, so the override half folds away
   — the whole condition folds to `false` and the guarded code plus the
   `hasFlagOverride` call are dead-code-eliminated. In a dev server it is
   the page-load override, OR-joined with the launch default.

Both anchors are this repo's own defines rather than Vite's
`import.meta.env.DEV` on purpose: that constant derives from `NODE_ENV`,
so a self-built `NODE_ENV=development` bundle would keep the override
machinery alive. Only a dev-server run (`serve` + development mode, the
`isDevServerRun` predicate) sees `true` here.

Do not wrap the shape in a helper like `isFlagOn("name")`: a call
expression is not statically foldable, so guarded code would ship in
production bundles.

## The two toggle surfaces (development only)

- **Command time (session default):**
  `VITE_FEATURE_<NAME>=1 pnpm -C apps/web dev`. Command-time env only:
  `VITE_FEATURE_X=1` in a `.env*` file does NOT enable a flag —
  `vite.config.ts` reads `process.env` at config time, before `.env`
  files land in `import.meta.env`.
- **Page load (per-load override):** add `?flags=name1,name2` to the app
  URL. The override replaces nothing — it enables on top of the launch
  defaults — and a reload applies changes; never restart the dev server.
  Unknown names are ignored, and an empty value enables nothing.

## Adding a flag

1. Append the name (kebab-case) to the `FEATURE_FLAGS` tuple in
   `registry.ts`.
2. Add one line beside it in `flag-globals.d.ts`:
   `declare const __FLAG_<SCREAMING_SNAKE>__: boolean;`

That is the whole registration: the entry lights up the env variable and
the URL override, and the declare line makes the guard global valid.
When the feature graduates, remove the flag — the registry entry and the
declare line — together with the guard.

Component tests under Vitest do not receive the vite.config defines (this
repo's vitest.config.ts is separate — the setup defaults `__DEV_SERVER__`
to `false`), so a test exercising a guarded branch must stub the globals
itself: `vi.stubGlobal("__DEV_SERVER__", …)` and, for the flag constant,
`vi.stubGlobal("__FLAG_<NAME>__", …)`.
