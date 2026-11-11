# Performance notes — housing-units web frontend

Measured baselines and revisable budgets for `apps/web`. The initial targets
come from the search-UI performance requirement (light payload, ~60fps map,
smooth filter changes). Measurements below are the FIRST baselines, taken
against the dev servers — **warn-gate status**: the envelopes above still
only warn; hard failure thresholds are deliberately loose until a production
(`vite build` + adapter-node server on port 4317 inside `e2e:prod`) baseline
is frozen. When that lands, revisit every budget below using the measured
numbers. One distinction runs through this file: the numbers below were
measured against the **dev servers**, while the suite's CI matrix (`e2e:ci`)
measures the same specs against the **Compose boot** (production-built API +
web images) — the dev numbers carry Vite transform overhead and are not
comparable to Compose-measured ceilings; each measured basis is labeled
where it matters.

## Units payload (user decision 2026-10-29 — API compression)

The budget is measured **on the wire** (the `@fastify/compress` plugin with
`global: true` on the housing API matches `accept-encoding`; brotli wins for
the JSON card payload).

- Measurement method: raw `node:http` request against the API
  (`e2e/perf-payload.spec.ts`); `bytesOnWire` counts the encoded BODY chunks
  on the socket — response headers (content-length, transfer framing) are
  excluded. Brotli decode is for the card count only (wire bytes stay the compressed size).
- Served dataset: 932 available unit cards (frozen synthetic dataset, seed
  20261029 — every card carries map coordinates).

| Number                          | Value         |
| ------------------------------- | ------------- |
| Uncompressed body               | 896,581 bytes |
| Wire payload (brotli)           | 53,488 bytes  |
| Wire bytes per 1,000 unit cards | **57,390**    |
| Budget target per 1,000         | 500,000 bytes |

The uncompressed join (program policies + provider contacts on every card)
is ~896KB for 932 cards (~962KB per 1,000) — noted as the recorded baseline
that motivated the compression decision. The brotli wire payload grew from
the previous 919-card dataset (49,742 → 53,488 bytes; 54,126 → 57,390 per
1,000) because every card now carries coordinates; it remains well inside
the ~500KB/1,000 budget. The warn-gate semantics stay (wire budget warns
above 500KB/1,000, gross churn fails above 1MB total).

## Map interaction smoothness (dev-server numbers)

- Method: `PerformanceObserver({ entryTypes: ['longtask'] })` during a
  scripted pan (mouse drag) + zoom over the map canvas (`e2e/perf.spec.ts`).
- Observed spread across review + this round's runs: worst long task
  **122ms–690ms** (run-to-run varies with the dev server's transform churn).

| Number          | Value (dev)       | Advisory target |
| --------------- | ----------------- | --------------- |
| Worst long task | 122ms–690ms (dev) | < 50ms          |

The 50ms target is advisory in the warn-gate; the hard floor inside the e2e
is 2s (gross churn only). A frozen budget needs a production-build
measurement (dev server dominates with transform overhead).

## Filter-change latency

- Method: timestamp around a filter toggle click + wait for the result-count
  update (includes server round-trip, not only pin re-render).
- Observed spread: **0.49s–~1.5s** in dev runs (server round-trip + vite
  re-render; the review recorded the ~1.5s upper edge).

| Number                   | Value (dev)     | Advisory target       |
| ------------------------ | --------------- | --------------------- |
| Filter-change round trip | ~0.5–1.5s (dev) | < 100ms pin re-render |

Pin re-render alone (GeoJSON `setData` on the source) is sub-frame in the
component tests; the measured number covers the full network round trip. A
production budget should split server time from client re-render time.

### Software-GL WebKit ceiling (Compose-measured calibration)

The filter-apply gross-churn ceiling is engine-split in `e2e/perf.spec.ts`:
2s shared, **3s for WebKit** (named constants `GROSS_CHURN_FLOOR_MS` /
`CALIBRATED_WEBKIT_SOFTWARE_GL_FLOOR_MS`). This is a calibration against
measured software-GL round-trips, not an advisory target:

- CI runner (ubuntu-24.04, `LIBGL_ALWAYS_SOFTWARE=1`, xvfb): recorded
  round-trips of **2354ms and 2553ms** on the WebKit leg.
- Linux reference rig (the runbook's Playwright-container WebKit leg,
  arm64 under Apple Silicon — a CPU-noisier software-GL host than the
  runner's amd64): cold first attempts **2740ms / 3617ms / 4322ms**,
  warm-retry values **1445ms / 2434ms**, full-suite run **2160ms**.

Both measured bases sit near or past the shared 2s ceiling, so the WebKit
leg keeps its own 3s ceiling: tightening below 3000ms has no measurement
basis (the rig's cold spread reaches past 3s under CPU contention), and
loosening past it would weaken the assertion. The ceiling leans on the CI
retry posture (`retries: 1` under `CI`) for rig-side contention spikes;
the PR-check runner remains the authoritative gate.

## Known dev-only residual

`maplibre-gl` logs `Worker failed to load. Check that the worker URL is
correct.` console errors under Vite dev only (vite worker dependency chunking
vs maplibre's bundled worker creation). Behaviorally verified unaffected —
map interaction, pin rendering, and unit selection all pass in the e2e
suite; the production `worker-src 'self' blob:` is asserted in
`e2e/preview-headers.spec.ts`. Future agents: don't chase this in dev.

## Gates

`e2e/perf-payload.spec.ts` + `e2e/perf.spec.ts`:

- payload: hard-fails only on gross bloat (< 1MB wire total); the
  ~500KB/1,000 on-the-wire target warns.
- long task: hard-fails only above 2s in a dev run; 50ms target warns.
- filter latency: hard-fails above the gross-churn ceilings — 2s shared,
  3s for WebKit's software-GL calibration (measured basis above);
  100ms target warns.

When the production baseline is frozen (`vite build` + adapter-node server +
measured numbers), turn the warn-gates into real threshold assertions by
updating the budget constants in the two perf specs and the numbers here.
