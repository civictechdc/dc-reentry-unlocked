# Proposal

## Why

The walkthrough logged W17 (docs/feedback/2026-11-07-walkthrough.md, quote 21,
23:38Z): *"research a tetradic color scheme for the web app that still follows
wcag/a11y guidelines"* — a design-system research item, deliberately slotted
as a planning session in the execution order. The user promoted it to next
(user decision 2026-11-09) and supplied the reference:
[google-labs-code/design.md](https://github.com/google-labs-code/design.md) —
a Google Labs **format specification for describing a visual identity to
coding agents**.

Two problems it addresses:

1. **Tokens without a language.** `apps/web/src/app.css` carries a "civic
   clean light theme" as an ad-hoc CSS custom-property block — values exist,
   but there is no structure, no rationale for why each value exists, no
   machine-readable form agents can consume, and no contrast guarantee.
2. **Palette without a scheme.** The current palette grew item by item
   (ink/paper neutrals, map/status colors, badge colors). W17 asks whether a
   tetradic scheme (two complementary pairs) can organize it — without
   breaking WCAG AA contrast or colliding with the data-carrying map/status
   and badge colors, which are semantic, not brand.

## What Changes

- **Evaluate the DESIGN.md format** as the web app's design-language
  artifact: YAML design tokens + markdown rationale, canonical sections
  (Overview, Colors, Typography, Layout, Elevation, Shapes, Components,
  Do's and Don'ts), component tokens with `{token}` references
- **Organize the existing tokens** (colors, typography, spacing, rounded,
  component styles) from `app.css` into that structure, with rationale prose
- **Explore a tetradic color scheme** whose text/background pairs pass WCAG
  AA (4.5:1) — validated mechanically (the `@google/design.md` linter ships
  a `contrast-ratio` rule), never by eye
- **Ground the CSS usage in [CSS Snapshot 2026](https://www.w3.org/TR/css-2026/)**:
  build the token system on snapshot-stable modules — custom properties,
  cascade layers (css-cascade-5), `@supports` conditional rules, CSS Color 4
  (oklch and friends) and Color 5 (`color-mix()`, relative-color syntax —
  both cleared for broad release pre-CR by the CSSWG). The snapshot
  classifies by spec stability, NOT engine adoption (its own abstract says
  so) — so feature choices pair snapshot status with engine-support
  evidence from the repo's own cross-engine e2e matrix
  (Chromium/Firefox/WebKit)
- **Define the adaptation strategy for missing engine support**: a fallback
  doctrine for every non-universal feature — fallback declarations ahead of
  modern syntax (relying on the snapshot's §3.1 rule that renderers ignore
  unsupported constructs whole), `@supports` feature queries where the
  fallback needs different structure, and honest degradation (the design
  stays legible, if plainer) rather than polyfill JS. This feeds W14
  (JS→CSS offload) and W15 (no-JS minimal functionality), which want CSS
  doing more without breaking weaker engines — WebKit in CI being the
  alerting surface (`webkit-ci-fidelity`)
- **Wire the outcome into the web app** (token source of truth and the
  app.css consumption path) — the exact integration (hand-maintained
  DESIGN.md as documentation only vs. lint/export tooling in the dev loop)
  is decided at planning

## Capabilities

### New Capabilities

- `design-language` — the web app's visual identity as a governed artifact:
  token structure, palette scheme, contrast requirements, and how agents and
  humans consume it

### Modified Capabilities

## Impact

- **Code:** `apps/web/src/app.css` (token reorganization; component style
  consumption), possibly Svelte component style blocks
- **Docs:** a new `DESIGN.md` (location decided at planning — repo root vs
  `apps/web/`); the fallback doctrine lands beside the tokens so agents
  inherit both
- **Tooling (possible):** `@google/design.md` devDependency for lint/export.
  The format is **alpha** and under active development — adopting its CLI is
  a deliberate, reviewed, version-pinned decision (repo tooling policy), not
  a default. Documentation-only adoption is a live alternative.
- **Sequencing:** W17 research item promoted to next (user decision
  2026-11-09); feeds the medium walkthrough-UI changes (W3–W8, W10), which
  should consume the settled design language rather than grow more ad-hoc
  styles, and pairs with W14/W15 (CSS offload, no-JS fallbacks) —
  `webkit-ci-fidelity` provides the cross-engine regression signal while
  fallbacks are introduced. Walkthrough audience vets the palette like all
  copy.

(Spawned at proposal stage with `skip_specs` set; delta specs are authored in
this change's planning session, which unsets it.)
