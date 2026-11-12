# Root cause — the retired WebKit e2e exceptions

Evidence record for the two retired WebKit `test.skip` guards (click-off
dismissal, canvas-pin hover). Captured per design decision D3: the old
pixel-scan's certified point and the `data-pin-points` hook geometry at the
same settled frame, then a click at the certified point.

## Method

A throwaway probe spec (created, run, deleted — never committed) replicated
the retired dismissal scenario exactly: open app, select the first card,
camera flies to the pin (`data-map-zoom` = 16), canvas settled to quiescence,
then:

1. `pinFreeCanvasPoint(page, { excludeLabelBubble: true })` — the OLD proof,
   unmodified (two-frame-verified raster scan, label band excluded);
2. `data-pin-points` read at the same frame (camera verified static across
   the read: `data-map-center` identical before the scan and at the read);
3. min distance from the certified point to every real pin (in-viewport set
   = clickable pins, with a 12px hit-radius margin; plus the all-pins set);
4. the certified click, performed for real, with the dismissal observed.

Runs: once on `desktop-chromium` locally (contrast), once on
`desktop-webkit` in the reference rig (runbook section 6, arm64 image,
`LIBGL_ALWAYS_SOFTWARE=1`, `xvfb-run`, Compose boot serving the production
build with the observability hooks — the boot was rebuilt first; the
initially running image predated the hooks and honestly reported no
attributes, which the probe caught).

Raw probe output: machine-local `.scratch/rootcause-probe.jsonl` (gitignored).

## Numbers

| project (environment) | certified point | pins in viewport / total | min distance to a real pin | certified click dismissed |
| --- | --- | --- | --- | --- |
| desktop-chromium (host, contrast) | (156, 228) | 3 / 932 | 80.5 px | yes (label → `none`) |

(The chromium contrast row is the observed output of the group-3 host
probe run; only the two `desktop-webkit` rows above it were persisted to
`.scratch/rootcause-probe.jsonl` — the rig rows are the logged evidence.)
| desktop-webkit (rig) | (356, 356) | 3 / 932 | 175.5 px in-viewport; 141.9 px over all projections | yes (label → `none`) |

Both engines certify a different point (the scan is raster-dependent, as the
design notes), but on both engines the certified point is genuinely
pin-free against the hook geometry, and the click at the certified point
dismisses.

## Verdict

The comparison question — *was the old certified point within hit-distance
of a real pin on webkit (raster-readback misclassification)?* — answers
**no** in the rig: 175.5 px of clearance is far beyond any plausible pin hit
geometry (the base circle paints at ~6–8 px), and the certified click
dismisses on rig WebKit with the label dropping to `none`.

Two consequences, recorded exactly as observed:

- The misclassification hypothesis is **not reproduced** in the rig: on this
  environment the old scan's certification and the hook geometry agree, and
  the entire old flow (scan → certify → click → dismiss) works. The CI
  leg's historical no-op did not reproduce here — consistent with the
  design's stated rig limitation (same distro family and browser lineage,
  but not the runner: different CPU architecture, not a byte-identical
  browser installation). The rig evidence cannot confirm what happened on
  the runner; it can only say the click pipeline and the scan's pin-free
  verdict are sound in a WebKit environment matching the runner's
  software-GL/xvfb posture.
- D3's stop branch did **not** trigger: a genuinely pin-free click does not
  no-op on rig WebKit, so there is no evidence of an input-pipeline or
  hit-test defect being masked by the retirement.

## Retirement basis

The written removal condition for both skips ("root-caused or the proof
becomes raster-independent") is satisfied on the second arm: the rewritten
proofs source pin geometry from `data-pin-points` and label state from
`data-label-unit` and never read any engine's raster, so the class of
failure the skips guarded against (a raster-calibrated scan certifying or
rejecting the wrong pixels) is gone by construction. The in-rig suite result
backs the rewrite end to end:

```
pnpm -C apps/web e2e:ci --project=desktop-webkit   # in the reference rig
36 passed, 1 skipped (2.4m)
```

The one skip is the Chromium-only touch-drag injection guard (CDP
`Input.dispatchTouchEvent`), unrelated to WebKit. Both rewritten proofs pass
on rig WebKit — the click-off dismissal (14.4s) and the canvas-pin hover
(7.8s) — alongside the full desktop-webkit matrix. The PR-check WebKit leg
remains the authoritative gate for the runner itself.
