# Close-button red — palette amendment approval (addendum to group 3)

**User decision: red fill with appropriately contrasted ×, 2026-11-10.**
Product-owner request raised during the live post-activation trial, decided
through the palette gate: candidate constructed and gated first, treatment
chosen by the user, exact values recorded here as the review outputs.

## Approved value (final)

- **Fill / edge**: `close` → `red-strong` `#a92227` — functional dismissive
  red, deliberately OUTSIDE the tetrad (four brand anchors unchanged).
  Construction: OKLCH L 0.48 (the strong/accent step) / hue 25°, chroma
  DELIBERATELY RAISED to 0.17 — above the ramps' 0.10 start — holding in
  gamut unreduced (verified with the project's verified conversion math,
  tol 1e-4, 8-bit rounding), because at 0.10 the red was user-reviewed as
  reading brown, not as the dismissive red a close control needs.
  Measured on the final hex: oklch L 0.4806 / C 0.1705 / H 24.9°.
- **Decision trail**: fill treatment chosen by the user over the quiet
  red-outline candidate → the first construction (`#8d4540`, C 0.10) was
  criticized as reading brown → candidates explored at L 0.48 across
  C 0.13–0.19 and hue 25–27° → the user picked between `#a92227` and
  `#b00a1d` (oklch L 0.4802 / C 0.1902 / H 25.1°) → **`#a92227` approved
  for the chroma margin**: it keeps three-axis separation from the
  selection red on every axis.
- **Distinctness evidence (measured on the final hexes, consistent basis)**:
  the selection red `pin-highlight #d9340f` measures oklch L 0.5803 /
  C 0.2058 / H 33.1°; `#a92227` measures ΔH 8.20°, ΔL −0.0997,
  ΔC −0.0353, while `#b00a1d` would have narrowed the chroma gap to
  ΔC −0.0156. The verification badge pair is likewise distant
  (badge-unverified ink at hue 52.3°) and means verification, not
  dismissal.
- **× ink**: `ink-on-close` → `white` `#ffffff` — 7.1305:1 on the fill
  (normal-text bar 4.5:1; the glyph inherits 1rem regular — the 1.05rem
  in an earlier draft of this record belonged to the sibling `h2` — so no
  large-text claim is made).
- **Treatment**: red fill + red 1px edge on the raised panel; the
  fill-vs-panel edge is the essential boundary (7.1305:1 against the 3:1
  non-text bar). Background-fill role and the control's padding/radius
  unchanged.

## Semantic-distinction obligations (recorded in the artifact)

- The red means dismiss/close only; it must never read as availability
  (pins), selection (highlight), or verification (badges).
- It is the one sanctioned dismissive control color; the "no second action
  hue" rule otherwise stands.
- Consumer: the detail slide-over close button only.

## Gate evidence (pre-commit, on the final value)

- Contrast matrix extended additively: `text | on-close ink | close control
  at rest` (4.5:1, measured 7.1305) and `non-text | close control boundary
  | red edge on raised fill` (3:1, measured 7.1305), both locked by the
  exact-multiset completeness guard; the required-token list gained `close`
  and `ink-on-close`.
- Deterministic gates green on the final tree (implementer-run):
  `design:check` (lint 0 errors / 29 advisory; byte-identity; bridges),
  `test` (592), `lint`, `format:check`, `typecheck`.
- Reviews: code review approve — checker recipe-exclusion verified
  name-exact with fail-closed guards intact; three prose nits folded
  (measurement bases unified, hue-gap basis stated, reflow). Security
  surface unchanged (no new dependencies; one data-string exclusion entry).
- Render evidence (machine-local): `.scratch/render-close-final/` vs
  `.scratch/render-close-fill/` — `.detail .close` only: fill and borders
  `#8d4540`→`#a92227` (vector (+28,−35,−25)); × ink stays `#ffffff`;
  all other states byte-identical beyond the documented GL/AA noise
  classes; 0 geometry diffs.

## Scope note

Added mid-change at user request as task 3.4; the full verification sweep
(task 4.1) runs after this activation.
