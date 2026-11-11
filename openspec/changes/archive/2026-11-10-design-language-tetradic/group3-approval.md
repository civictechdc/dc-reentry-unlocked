# Group 3 approval — tetradic palette activation (task 3.2)

**User decision: approved as presented, 2026-11-10.** Recorded at the
walkthrough-audience gate before activation (task 3.3). The exact values
below are review outputs and are the only approved values; any later value
change goes back through review.

## What was reviewed

- The candidate constructed in `apps/web/DESIGN.md`: four OKLCH ramps at
  hue anchors blue 250° / orange 70° / green 150° / magenta 330° (two
  complementary pairs), steps faint/soft/mid/strong/deep at L targets
  0.97/0.90/0.72/0.48/0.32, chroma from 0.10 binary-search-reduced into
  sRGB gamut (tolerance 1e-4), per-channel 8-bit rounding. Construction
  recorded as prose in the artifact; conversion math self-verified against
  Ottosson / CSS Color 4 reference vectors (max observed error 1.8e-6).

### Approved ramp values

| Step (L)    | blue 250°  | orange 70° | green 150° | magenta 330° |
| ----------- | ---------- | ---------- | ---------- | ------------ |
| faint 0.97  | `#eef6ff`  | `#fff3e6`  | `#dfffe4`  | `#fff0fd`    |
| soft 0.90   | `#c6e1ff`  | `#ffd6a8`  | `#aef1bb`  | `#ffcaf9`    |
| mid 0.72    | `#73a9e1`  | `#cd995c`  | `#75b683`  | `#c88ec3`    |
| strong 0.48 | `#2c6194`  | `#81520a`  | `#2c6d3e`  | `#7d4778`    |
| deep 0.32   | `#00345f`  | `#492b00`  | `#003f18`  | `#4d1b4a`    |

### Approved role placements (blue family only)

- `accent` → blue-strong `#2c6194` (white ink 6.47:1).
- `accent-hover` → blue-deep `#00345f` (white ink 12.68:1).
- `surface-selected` → blue-faint `#eef6ff` (ink 13.49:1, muted 5.95:1).
- `accent-focus-ring` stays the literal `blue-ring` `#1d4ed8`: the only
  intermediate ramp step (blue-mid `#73a9e1`) fails every asserted ring
  adjacency at 2.27–2.47:1 (needs 3:1), and the dark steps collide with the
  action states; the literal passes 6.15–6.70:1 and stays visibly distinct
  from the fill. Rationale recorded in the artifact's prose.
- Orange/green/magenta ramps approved as **unplaced primitives** only —
  neutrals stay dominant, no hue forced onto a live component.
- Status tokens (`pin-*`, `badge-*`, `surface-warning`) keep their values,
  unaliased; `pin-exact #0b5fab` intentionally diverges from the new accent.
- Document `theme-color` follows `accent` → `#2c6194`.

## Verified outcome (pre-approval evidence)

- Deterministic gates green on the candidate tree (orchestrator-attested):
  `pnpm design:check` (lint 0 errors / 29 advisory warnings; export
  byte-identity; drift clean), `pnpm test` (592 passed, including the WCAG
  matrix — strengthened with a previously missing camera-control
  accent-hover-as-ink pair at 12.68:1, found by adversarial review),
  `pnpm lint`, `pnpm format:check`, `pnpm typecheck`.
- Reviews: security clean (no findings); code review approve (3 nits folded);
  adversarial sole finding closed by the additive matrix row above.
- Render evidence (machine-local, not committed): `.scratch/render-candidate/`
  vs `.scratch/render-after/` — 9 states, chromium 156 1440×900; 11
  computed-style leaf diffs, all accent-family/selected-tint; pins, badges,
  banner, neutrals, geometry byte-identical; diff write-up at
  `.scratch/render-candidate/DIFF.md`.

## What this unblocks

Task 3.3 activation of exactly these values through DESIGN.md +
regeneration (never hand-patched generated output, no gate dropped), full
deterministic gates and rendered checks across the browser matrix, and the
rollback-path proof.
