# Tasks

## 1. Flag registry riders (no consumers yet)

- [ ] 1.1 Register `w1-map-zoom` and `w2-recenter` via the two-line ritual (`FEATURE_FLAGS` tuple + `flag-globals.d.ts` declarations) and verify `pnpm typecheck` plus `pnpm -C apps/web test` stay green
- [ ] 1.2 Add the registry-shape unit check to `flags.test.ts` (entries unique, kebab-case `^[a-z0-9]+(-[a-z0-9]+)*$`) and verify the flags suite passes
- [ ] 1.3 Add the "flags are never a security boundary" paragraph to `apps/web/src/lib/flags/README.md` and verify the line is present and `pnpm lint` passes

## 2. Map camera controls — first flag rider (W1, W2)

Svelte edits run under the Svelte skills / `svelte-file-editor` delegation
(proposal execution approach).

- [ ] 2.1 Rename `DC_MAP_CENTER`/`DC_MAP_ZOOM` to `LOCALE_MAP_CENTER`/`LOCALE_MAP_ZOOM` (values unchanged; map-config.ts, MapView.svelte, MapView.test.ts) and verify `pnpm -C apps/web test` + `pnpm typecheck` green
- [ ] 2.2 Add camera operations beside the constants in the map-config module (`zoomIn`, `zoomOut`, `recenterOnLocale` → `flyTo` the locale view) with unit tests over a mocked map instance, and verify the behavioral-sentence tests pass
- [ ] 2.3 Add the guarded controls markup to `MapView.svelte` — `+`/`−` and recenter `<button>`s inside the blessed per-flag `{#if}` guards with `data-flag` markers, paraglide `aria-label`s (new message keys), CSS-first placement clear of the attribution corner and phone tab bar — and verify component tests: controls render and drive the camera ops with flag anchors stubbed on, absent with them off (`pnpm -C apps/web test`)

## 3. Elimination scan + gate wiring

- [ ] 3.1 Create `apps/web/scripts/scan-flag-elimination.mjs` (scans `build/client`; fails on any `__FLAG_`/`__DEV_SERVER__` identifier and any `data-flag=` marker) plus the `scan:flags` package script (build + scan), and verify it exits 0 on the guarded-controls build and fails when a marker is deliberately seeded into a fixture output
- [ ] 3.2 Add the PR-gate step to `.github/workflows/pr.yml` immediately after the existing web-production-build step (reusing its output, no second build), and verify `pnpm -C apps/web scan:flags` passes against a fresh build — the same command the gate runs
- [ ] 3.3 Add the `scan:flags` row to the AGENTS.md verification-command table and verify the documented command runs as written

## 4. Detail card — close icon and `tel:` links (W11, W13)

Svelte edits run under the Svelte skills / `svelte-file-editor` delegation.

- [ ] 4.1 Add `telHref` beside the detail-contact rendering in `detail-values.ts` (digits + leading `+` only, e.g. `(202) 555-0123` → `tel:2025550123`) with behavioral-sentence unit tests, and verify the suite passes
- [ ] 4.2 Render the provider phone as a `tel:` link when listed and the honest "not publicly listed" plain text when not (`DetailSlideOver.svelte`), and verify component tests assert both renderings (`pnpm -C apps/web test`)
- [ ] 4.3 Change the close control to the × glyph with `aria-label={m.detail_close()}` (`DetailSlideOver.svelte`) and verify component tests assert the accessible name and the existing dismissal/focus-return tests stay green

## 5. Favicon (W19)

- [ ] 5.1 Create `apps/web/static/favicon.svg` (brand mark on the theme color) and `favicon.ico` fallback, link both from `app.html`, and verify both are served 200 by a dev boot and land in `apps/web/build/client` after `pnpm -C apps/web build`

## 6. Integration sweep

- [ ] 6.1 Run the full deterministic gate — `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm typecheck`, `pnpm arch:check`, `pnpm -C apps/web scan:flags` — all green
- [ ] 6.2 Run `pnpm -C apps/web e2e` and `pnpm -C apps/web e2e:prod` (flag-off default: controls absent, detail/favicon changes live) and verify both pass
- [ ] 6.3 Run the simplification/domain-language pass over every file this change touched (`code-simplification` + `codebase-design` skills; touched surfaces only) and verify no behavior change — gates from 6.1 still green
- [ ] 6.4 Run `openspec validate walkthrough-quick-wins --strict` and the tracking-reference grep from AGENTS.md (no task/decision/change refs outside `openspec/`) and verify both clean

## Workflow follow-up

- Orchestrator commits per group (implementers never commit); tick tasks only
  after the task's verification passes.
- Dev trial session with the user
  (`VITE_FEATURE_W1_MAP_ZOOM=1 VITE_FEATURE_W2_RECENTER=1 pnpm -C apps/web dev`
  or `?flags=`) to settle final control placement.
- Archive the change after review gates pass; update the AGENTS.local.md
  execution order afterwards.
