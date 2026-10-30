# Performance notes — housing-units web frontend

Measured baselines and revisable budgets for `apps/web`. The initial targets
come from the search-UI performance requirement (light payload, ~60fps map,
smooth filter changes). Measurements below are the FIRST baselines, taken
against the dev servers — **warn-gate status**: the envelopes above still
only warn; hard failure thresholds are deliberately loose until a production
(`vite build` + adapter-node server on port 4317 inside `e2e:prod`) baseline
is frozen. When that lands, revisit every budget below using the measured
numbers.

## Units payload (user decision 2026-10-29 — API compression)

The budget is measured **on the wire** (the `@fastify/compress` plugin with
`global: true` on the housing API matches `accept-encoding`; brotli wins for
the JSON card payload).

- Measurement method: raw `node:http` request against the API
  (`e2e/perf-payload.spec.ts`); `bytesOnWire` counts the encoded BODY chunks
  on the socket — response headers (content-length, transfer framing) are
  excluded. Brotli decode is for the card count only (wire bytes stay the compressed size).
- Served dataset: 919 available unit cards (frozen synthetic dataset).

| Number                          | Value         |
| ------------------------------- | ------------- |
| Uncompressed body               | 904,146 bytes |
| Wire payload (brotli)           | 49,742 bytes  |
| Wire bytes per 1,000 unit cards | **54,126**    |
| Budget target per 1,000         | 500,000 bytes |

The uncompressed join (program policies + provider contacts on every card)
clocks in at ~984KB per 1,000 units — noted as the recorded baseline that
motivated the compression decision. On the wire the payload is well inside
the ~500KB/1,000 budget; the warn-gate semantics stay (wire budget warns
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
- filter latency: hard-fails only above 2s; 100ms target warns.

When the production baseline is frozen (`vite build` + adapter-node server +
measured numbers), turn the warn-gates into real threshold assertions by
updating the budget constants in the two perf specs and the numbers here.
