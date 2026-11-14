# Proposal

## Why

The CI repair that made the PR-check e2e matrix green left three
WebKit-specific exceptions in the test code, each with a written reason
and removal condition (never a blanket skip). They are honest debt,
and this change exists to retire them:

1. **Click-off dismissal skip** (`map-dismissal.spec.ts`): a pin-free
   canvas click verified across two consecutive frames still never
   dismisses the selection on the CI WebKit leg — the detail stays
   open on the focused unit — while the identical flow passes on
   Chromium and Firefox and in Linux-container WebKit runs. Three
   consecutive CI runs failed the same way (PR-check runs 42533937147,
   42535220837 on the repair branch); the failure snapshot shows a
   no-op click, pointing at raster-to-hit-geometry fidelity specific
   to the runner's WebKit build.
2. **Pin-scan hover skip** (`map-label.spec.ts`): the helper that
   locates a pin by scanning canvas pixels finds no pin on WebKit's
   rasterization ("the canvas scan found no visible pin to hover") —
   the scan is calibrated to the Chromium/Firefox rasters.
3. **Filter-apply perf floor** (`perf.spec.ts`): the 2s gross-churn
   floor is calibrated to 3s for WebKit (CI measurements 2354/2553ms,
   ~2.3s in container) because software-GL WebKit consistently exceeds
   the shared floor.

A raster-independent (DOM-observable) dismissal/hover hook is a
candidate direction that would make proofs 1 and 2 engine-neutral
instead of scan-calibrated.

## What Changes

- Reproduce the click-off no-op on a WebKit build matching the CI
  runner's, and root-cause it (input pipeline vs hit-test geometry vs
  raster readback)
- Retire each exception by fixing the underlying fidelity gap or
  replacing the raster-scan proofs with engine-neutral observability;
  recalibrate or remove the WebKit perf floor once the leg runs a
  representative GL path
- Keep the matrix honestly green throughout — no assertion weakened

## Capabilities

### New Capabilities

(none — CI/test-suite fidelity work; `skip_specs` until planned)

### Modified Capabilities

## Impact

- **Code:** `apps/web/e2e/` specs and helpers; possibly a small
  testability hook in `MapView.svelte` (camera observability precedent)
- **Sequencing:** independent of other in-flight changes; small;
  benefits from landing before any change that leans on WebKit e2e
  coverage
