# Design

## Context

Three WebKit-specific exceptions existed in the e2e suite when this
change opened — the pre-change state this section describes (line
references are to the pre-change files; this change removes all three
sites):
repair, each with a written removal condition:

- Click-off dismissal (`apps/web/e2e/map-dismissal.spec.ts:129`): the
  pixel-verified pin-free click never dismisses on the CI WebKit leg;
  removal when the fidelity gap is root-caused or the proof becomes
  raster-independent.
- Pin-hover scan (`apps/web/e2e/map-label.spec.ts:83`): the pin-locating
  canvas scan finds no pin on WebKit's rasterization; removal when a
  WebKit calibration or a DOM-observable hover proof lands.
- Filter-apply floor (`apps/web/e2e/perf.spec.ts:97`): the 2s gross-churn
  ceiling is split to 3s for WebKit; removal when the CI leg gets a
  representative GL path or the budget gains a software-GL calibration.

Environment facts (researched this session, cited from the repo):

- CI runs both e2e workflows on `ubuntu-24.04` with
  `LIBGL_ALWAYS_SOFTWARE: "1"` under `xvfb-run`, Playwright 1.64.1,
  WebKit via `playwright install --with-deps webkit` (Linux revision
  2370; macOS arm64 installs revision 2251). The Compose boot serves the
  app; the browser runs on the workflow host.
- Local macOS WebKit is a different platform artifact and cannot
  establish runner fidelity. The proposal's "Linux-container WebKit"
  passes have no recorded provenance in the repo.
- Both canvas-scan helpers (`apps/web/e2e/steps/label-pixels.ts`) use
  color predicates calibrated to the Chromium/Firefox rasters. The hover
  scan finds no pin on WebKit; the dismissal scan's pin-free verdict
  therefore excludes nothing it recognizes differently — a point it
  certifies pin-free can overlap a real pin on WebKit's raster.
- Pins and address labels are MapLibre canvas layers (no per-pin DOM
  markers). Click-off dismissal runs `map.queryRenderedFeatures` at the
  click point: a pin hit leaves the selection alone.
- Read-only observability precedent: `MapView.svelte` exposes
  `data-map-center`/`data-map-zoom`, refreshed on `moveend`, always-on
  (not flag-guarded), and consumed by e2e helpers. Flag-guarded markup is
  statically stripped from production builds — the exact builds the CI
  matrix tests — so a flag-guarded hook is not an option.

## Goals / Non-Goals

**Goals:**

- Retire all three exceptions with the PR-check matrix honestly green;
  no assertion weakened.
- Root-cause the CI WebKit no-op click with captured evidence.
- Give the suite proofs that do not depend on any engine's raster.

**Non-Goals:**

- No user-facing behavior change; the observability additions are e2e/
  debug hooks in the camera-attribute precedent (and so no spec delta —
  product behavior is unchanged).
- No new CI leg or workflow change.
- No WebKit raster recalibration of the pixel scans (rejected direction,
  see D1).
- No deletion of `label-pixels.ts` beyond dead exports — the phone
  touch-drag endpoint test still consumes `pinFreeCanvasPoint`.

## Decisions

- **D1 — Engine-neutral proofs via read-only observability, not scan
  recalibration.** Extend `MapView.svelte` in the camera-attribute
  pattern with: (a) `data-pin-points` — the projected canvas-local
  centers of every rendered pin, serialized `"x,y;x,y;..."`, refreshed
  on `moveend` and whenever the rendered unit set changes; and
  (b) `data-label-unit` — the unit id whose address label is currently
  live, or `none`. Tests then: hover at an exact pin center from (a) and
  assert (b) transitions; pick a click point maximally distant from all
  (a) points and assert dismissal closes the detail, clears (b), and
  leaves the camera attributes unchanged (already engine-neutral).
  These proofs exercise the real MapLibre hit-testing per engine —
  stronger than scan approximations. Recalibrating the scans per raster
  was rejected: it keeps every proof engine-coupled and re-rots on the
  next WebKit build.
- **D2 — Reference rig for local WebKit evidence.** A documented recipe
  (docs/runbook.md) running the repo's CI Playwright config's
  `desktop-webkit` project inside
  `mcr.microsoft.com/playwright:v1.64.1-noble` with
  `LIBGL_ALWAYS_SOFTWARE=1` and `xvfb-run`, against the host Compose
  boot. This approximates the runner (same distro family, same Playwright
  browser build lineage, software GL, xvfb) closely enough for local
  evidence; the PR-check leg remains the authoritative gate. A new CI
  leg was rejected as cost without added signal.
- **D3 — Root-cause by instrumentation comparison, with a stop branch.**
  In the rig, capture the old pixel-scan's certified pin-free point and
  the hook-provided pin geometry at the same moment. If a real pin sits
  within hit-test distance of the certified point, the no-op is
  raster-readback misclassification (app correct; proof was wrong) —
  skip retires on the engine-neutral proof. If the point is genuinely
  pin-free and the click still no-ops, that is an input-pipeline or
  hit-test defect in the runner's WebKit: STOP, report, and let the
  user decide — the skip is not retired by re-proofing around a real
  bug.
- **D4 — Perf floor becomes a calibrated software-GL budget.** Measure
  the filter-apply round-trip in the rig (at least three runs), keep the
  WebKit ceiling at 3000ms (tightening allowed with evidence; loosening
  is assertion-weakening and forbidden), move the split into a named
  calibrated constant whose comment cites the measurements, and update
  `docs/perf-notes.md` — including its existing drift (still says
  "hard-fails only above 2s", does not mention the split) and the
  dev-measured vs Compose-target distinction. This satisfies the written
  removal condition ("budget gains a software-GL calibration"); a
  representative hardware-GL path does not exist on hosted runners.
- **D5 — Skip removal is code deletion with the reasons preserved in
  history.** The two `test.skip` blocks and the browser-split ternary
  are deleted; their written reasons live on in git history and the
  archived repair/proposal record. No marker comments are left behind.

## Risks / Trade-offs

- [Hook refresh cost on `moveend`/unit-set changes] -> serialization is
  bounded by the unit count and runs at moveend frequency (same as the
  camera attributes); `perf.spec.ts` must stay green on all engines
  after the change.
- [Attribute growth] -> pin-point strings are short per pin; cap concern
  is negligible at the synthetic corpus size; verified by the perf leg.
- [Rig is not the runner] -> same distro family and browser lineage but
  not byte-identical installation; conclusions from the rig are evidence,
  not proof — the PR leg gates.
- [Real WebKit input defect surfaces] -> D3's stop branch protects
  against masking a genuine engine bug as test debt.

## Migration Plan

None needed: tests and a read-only hook only. Rollback is revert.

## Open Questions

None — the retirement paths are those the exceptions' own removal
conditions name, and the observability pattern is precedented.
