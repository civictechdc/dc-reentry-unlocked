# Tasks

## 1. Reference rig (matching WebKit environment)

- [x] 1.1 Stand up the rig: host Compose boot (`docker compose up -d --wait`), then run the repo's CI Playwright config's webkit project inside `mcr.microsoft.com/playwright:v1.64.1-noble` (`LIBGL_ALWAYS_SOFTWARE=1`, `xvfb-run`, repo mounted, app origin reached via the host's Docker address) — verify `pnpm -C apps/web e2e:ci --project=desktop-webkit` completes in-rig with the current suite green (both skips active, 3s floor in force) and record the run output location
- [x] 1.2 Add the rig recipe to `docs/runbook.md` (docker run command, env, prerequisites, what it is and is not evidence of); verify the documented commands run as written from a clean shell

## 2. Engine-neutral observability hook

- [x] 2.1 Extend `apps/web/src/lib/components/MapView.svelte` in the camera-attribute pattern with `data-pin-points` (projected canvas-local pin centers, `"x,y;..."`, refreshed on `moveend` and rendered-unit-set change) and `data-label-unit` (live address-label unit id or `none`); verify new behavioral component tests in `MapView.test.ts` cover projection refresh and label-unit transitions, and `pnpm -C apps/web test` passes
- [x] 2.2 Verify the hook carries no flag machinery (`pnpm -C apps/web scan:flags` unchanged), renders in the production build posture, and the full web gates pass (`pnpm -C apps/web test`, `pnpm -C apps/web e2e` dev chromium suite self-boot)

## 3. Engine-neutral proofs, skip retirement, root-cause evidence

- [x] 3.1 Rewrite the click-off dismissal test in `apps/web/e2e/map-dismissal.spec.ts` to pick its click point from `data-pin-points` (maximal clearance from all pins, margin covering label bubbles) and assert dismissal via DOM + `data-label-unit` + unchanged camera attributes; delete the webkit `test.skip`; verify `pnpm -C apps/web e2e` (chromium) passes
- [x] 3.2 Rewrite the pin-hover test in `apps/web/e2e/map-label.spec.ts` to hover at an exact `data-pin-points` center and assert label paint/erase via `data-label-unit`; delete the webkit `test.skip` and the now-dead pin-scan path if no consumer remains; verify `pnpm -C apps/web e2e` (chromium) passes
- [x] 3.3 Run the rewritten proofs in the rig (`desktop-webkit`): if they pass, capture the root-cause evidence (old pixel-scan certified point vs `data-pin-points` geometry at the same frame — misclassification verdict) into `openspec/changes/webkit-ci-fidelity/root-cause.md`; if a genuinely pin-free click still no-ops, STOP and report (input-pipeline/hit-test defect — not retired here)
- [x] 3.4 Verify `pnpm -C apps/web scan:flags` and `pnpm -C apps/web e2e:bdd` stay green (no BDD step coupled to the rewritten specs)

## 4. Perf floor calibration

- [x] 4.1 Measure the filter-apply round-trip in the rig (at least three runs, `desktop-webkit`); keep the ceiling at 3000ms or tighten with evidence (never loosen); replace the inline ternary with a named calibrated constant whose comment cites the measurements; verify `pnpm -C apps/web e2e:ci --project=desktop-webkit` passes in-rig with the calibrated budget
- [x] 4.2 Update `docs/perf-notes.md`: record the calibrated software-GL budget and its measured basis, fix the existing drift (the "hard-fails only above 2s" wording omits the split), and note the dev-measured vs Compose-target distinction; verify documented commands run as written

## 5. Full verification

- [x] 5.1 Run the repo gates from the worktree root — `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm typecheck`, `pnpm arch:check`, `pnpm design:check` — and `openspec validate webkit-ci-fidelity --strict`; verify every command exits 0 and record results before review
- [x] 5.2 Final matrix evidence: re-run the rig webkit project end-to-end plus the local dev `pnpm -C apps/web e2e` (chromium), confirm zero remaining `browserName === "webkit"` exceptions in `apps/web/e2e/` (grep), and record the summary

## Workflow follow-up

- Orchestrator commits after the review gates pass (implementers never commit).
- Archive via the archive workflow after review.
