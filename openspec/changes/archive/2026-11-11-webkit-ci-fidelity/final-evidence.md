# Final matrix evidence (post-remediation)

The closing verification pass: the full `desktop-webkit` project re-run in the
reference rig against a rebuilt Compose boot, the local dev e2e suite cold
-started, and the engine-exception grep. Recorded for the suite-level close;
the per-proof root-cause evidence lives in `root-cause.md`.

## 1. Rig re-run — full `desktop-webkit` project

Compose boot rebuilt (`docker compose up -d --build --wait`; both images
rebuilt since the tree gained app/test edits after the earlier runs) and
healthy, then the runbook section 6 recipe verbatim
(`mcr.microsoft.com/playwright:v1.64.1-noble`, `linux/arm64`,
`LIBGL_ALWAYS_SOFTWARE=1`, `CI=1`, `xvfb-run`, loopback forwarder, own
`node_modules` volumes):

```
2 flaky, 1 skipped, 34 passed (3.2m)   # 0 failed
```

- The skip is the Chromium-only touch-drag injection guard (CDP), unrelated
  to WebKit — the only remaining skip in the project.
- Both flakes recovered on the CI retry and are the documented contention
  shapes: the drag-pan proof (software-GL starvation registered the drag as
  a click — the runbook's flaky-but-green posture) and the perf filter-apply
  (4213ms against the 3000ms calibrated floor on attempt 1, passed on
  retry). Neither appeared on the earlier rig runs of this tree; CPU
  contention on the shared host machine is the likely difference. Re-run
  before investigating if either repeats.

## 2. Local dev e2e — cold start

Ports cleared first (a stale worktree dev API was found on 3000 and killed
before the pass — the documented stale-server poisoning posture), then
`pnpm -C apps/web e2e` cold-started:

```
3 failed, 34 passed (1.2m)
```

Adjudication by isolated re-run of each failed spec — all green isolated:

| Failed in cold start | Isolated | Verdict |
| --- | --- | --- |
| `a11y.spec.ts` keyboard-only usage | 3 passed (keyboard 1.2s) | documented pre-existing data-load flake |
| `map-label.spec.ts:205` phone remount | 6 passed (remount 4.9s) | documented pre-existing data-load flake (pixel-scan test, unmodified by this change) |
| `perf.spec.ts` filter-apply | 2 passed (625ms vs 2000ms floor) | cold-start contention; dev-mode round-trip variance is documented in the spec |

Both members of the documented data-load flake pair failed in the same
cold start; each passes isolated, so the suite-level cold-start result is a
contention artifact, not a regression signal. The rewritten proofs did not
fail anywhere: the `data-pin-points` click-off dismissal passed in the
cold-start run itself, and the rewritten canvas-pin hover passed both in the
cold-start run and isolated (3.9s).

## 3. Engine-exception grep

```
$ grep -rn 'browserName === "webkit"' apps/web/e2e/
apps/web/e2e/perf.spec.ts:108:    browserName === "webkit" ? CALIBRATED_WEBKIT_SOFTWARE_GL_FLOOR_MS : GROSS_CHURN_FLOOR_MS;
```

Exactly one hit: the calibrated-budget floor selection. It is not an
exception site — no skip, no conditional bypass; the assertion always runs
and both floors are enforced (3000ms software-GL calibrated, 2000ms gross
-churn). It is the calibration itself, the written removal path for the
perf-floor exception: the named constants select which budget applies per
engine. Zero skip/conditional exception sites remain in `apps/web/e2e/`.
