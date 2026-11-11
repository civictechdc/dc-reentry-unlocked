# Group 2 approval — byte-identical runtime swap (task 2.5)

**User decision: approved, 2026-11-10.** Recorded at the human verification
gate before any palette edit (group 3).

## What was reviewed

- The committed generated artifact `apps/web/src/generated/design-tokens.css`
  (43 tokens: colors, spacing, rounded; hand-written typography/shadow stay in
  `app.css`; map paints bridged through `apps/web/src/lib/map/map-colors.ts`).
- Before/after rendering evidence: 9 probed states (loaded, focus-select,
  focus-toggle, toggle-active, chips, hover-card, selected-card-detail,
  pin-bubble, error-404) at 1440×900, chromium 156.0.8078.4 / Playwright 1.64.1,
  captured against the pre-swap tree and the post-swap tree, with a
  determinism control isolating map-canvas GL jitter. Diff write-up kept with
  the session's render evidence (machine-local, not committed).

## Verified outcome

- Computed styles and geometry byte-identical across all states except one
  documented change: essential control borders `--color-line-strong`
  `#8a97a0` → `#84909a`, the inventory-time WCAG correction (the old value
  measured 2.99:1 on white, below the 3:1 essential-non-text threshold; see
  the Colors section of `apps/web/DESIGN.md`).
- Rendered state probes (focus, selected, hover, badges, map label) green
  across the CI matrix: chromium 156.0.8078.4, firefox 157.0, webkit 27.2;
  map-label pixel proof descoped on mobile per the config's documented canvas
  policy; local WebKit map-dismissal drag flake reported as a coverage gap,
  not coverage.

## Commits covered by this approval

- `87a7c7d` — app.css swap + 120 consumer renames + literal retrofits
- `782eb27` — map/theme-color bridges + bridge-checker hardening
- `e692d0e` — rendered design-state probes across the CI matrix

Group 3 (tetradic palette candidate and activation) may now start; palette
activation remains blocked behind its own walkthrough-audience review
(tasks 3.2/3.3).
