# Design

## Context

Feature-flags landed 2026-11-07 (spec `feature-flags`; archived change): the
registry `apps/web/src/lib/flags/registry.ts` is empty, the blessed guard
shape lives in `flags/README.md`, and the archived design (D4) records three
first-rider duties owed by this change: the build-output elimination scan, a
registry name-shape/uniqueness unit check, and a "flags are never a security
boundary" docs line.

Current surfaces (all in `apps/web`):

- `MapView.svelte` wraps a MapLibre `Map`; camera constants
  (`DC_MAP_CENTER`, `DC_MAP_ZOOM`, `CARD_FOCUS_ZOOM`) come from
  `map-config.ts`; card focus uses `map.flyTo`. No MapLibre control classes
  and no `maplibre-gl.css` are used anywhere. maplibre-gl is mocked in
  component tests (`MapView.test.ts`); real-map proof is Playwright e2e.
- `DetailSlideOver.svelte` renders the close control as a text label
  (`m.detail_close()`) and the provider phone as plain text
  (`unit.provider.phone ?? m.detail_contact_no_details()`). Synthetic phone
  vocabulary is `(202) 555-01XX` (datagen, reserved exchange).
- Design tokens are centralized as CSS custom properties in `app.css`
  (`--accent`, `--ink`, `--surface`, …); components keep scoped styles and
  consume `var(--…)`.
- No `static/` directory exists — the `/favicon.ico` 404 fires on every
  boot, dev and builds. `app.html` links no icon. CSP `img-src` includes
  `self`.
- The PR gate already runs `pnpm -C apps/web build` (adapter-node output in
  `apps/web/build`), so an elimination scan can reuse that output.

Sequencing: the proposal suggested planning after `mobile-initial-tab` to
avoid racing deltas into `housing-search-ui`. The execution order of
2026-11-09 puts this change first; no race exists — `mobile-initial-tab`
has authored no delta and touches a different requirement (responsive
size-class wording). It will author against the main spec as amended here.

## Goals / Non-Goals

**Goals:**

- Land W1, W2, W11, W13, W19 as minimal scoped edits.
- First real flag riders (W1, W2) proving the elimination pipeline
  end-to-end: registry entries → guards → build-output scan green.
- Preserve unknown honesty (absent phone stays "not publicly listed") and
  i18n externalization (new strings through paraglide).
- Leave the dismissal/focus-return contract untouched by the close-icon
  change.
- Leave every touched file clearer than found — domain-named, simplified,
  still minimal in scope.

**Non-Goals:**

- Every other walkthrough item (W3–W8, W10, …) — separate changes per the
  execution order.
- Flag graduation/removal — later trial verdicts decide; both flags stay
  default-off until then.
- A swappable map-provider layer (MapLibre vs Google Maps) — see D2.
- Jurisdiction/locale decoupling beyond the D3 camera-constant rename —
  owned by the queued `jurisdiction-extension-points` change.
- Repo-wide JS→CSS offload audit (W14) and color/theming work (W17).
- MapLibre `NavigationControl` adoption / a `maplibre-gl.css` dependency.
- Runtime flag UI or a reactive registry (deferred by the feature-flags
  design).
- `tel:` extensions or phone formats beyond the data vocabulary.

## Decisions

### D1 — Two flags, one per candidate control

`w1-map-zoom` and `w2-recenter`, registered via the two-line ritual
(registry tuple entry + `flag-globals.d.ts` declaration). Alternative: one
`map-controls` flag — rejected: quoted as separate items (quotes 7, 9) and
they may graduate separately.

### D2 — In-component buttons behind a camera-ops seam, not MapLibre control classes

Zoom +/− and recenter are plain positioned `<button>`s inside
`MapView.svelte`; each calls one camera operation from a small ops module
beside the `map-config.ts` constants (`zoomIn`, `zoomOut`,
`recenterOnLocale` → `map.flyTo({ center: LOCALE_MAP_CENTER, zoom:
LOCALE_MAP_ZOOM })`). The control UI never touches the MapLibre instance
directly — MapLibre-knowing code stays confined to the map wrapper and the
camera-ops module. Rationale: no new CSS dependency, app-consistent
styling, one mechanism for both controls, native button semantics with
paraglide `aria-label`s. MapLibre `NavigationControl` was considered for
zoom and rejected (CSS import, visual mismatch, no recenter variant
anyway).

A full swappable map-provider layer (MapLibre vs Google Maps) is
explicitly rejected as out of scope: pins, labels, and hit-testing are
layer/expression-level MapLibre coupling, and Google Maps adds a billing
key and a non-OSM data posture — a provider seam of that depth is a
deliberate architecture change, not a quick win. The camera-ops seam is
the modular piece that is cheap now.

Each control's markup sits inside the blessed guard expression
(`{#if __FLAG_W1_MAP_ZOOM__ || (__DEV_SERVER__ && hasFlagOverride("w1-map-zoom"))}`,
per flag). The controls carry `data-flag="w1-map-zoom"` / `"w2-recenter"`
marker attributes — the elimination scan's guarded-code signal. Label
strings cannot serve as that signal: all app strings live in the shared
messages chunk, which legitimately survives elimination.

### D3 — Recenter targets locale-named camera constants; jurisdiction work stays in its own change

The recenter operation returns the camera to the configured locale view:
`recenterOnLocale` → `map.flyTo({ center: LOCALE_MAP_CENTER, zoom:
LOCALE_MAP_ZOOM })`. This change renames `DC_MAP_CENTER`/`DC_MAP_ZOOM` to
the locale-neutral `LOCALE_MAP_CENTER`/`LOCALE_MAP_ZOOM` (values unchanged
— DC today; mechanical rename of the two constants and their comment,
~3 files) so the control and card-focus code speak "locale", not "DC".
Making the locale actual data (city spec, geography without wards, filter
vocabulary) is owned by the queued `jurisdiction-extension-points` change
(ward/quadrant → jurisdiction-scoped data; web geography presentation
jurisdiction-driven) — this change only renames; it does not build the
mechanism. `flyTo` (not `jumpTo`) matches the card-focus camera behavior.

### D4 — Close control: × glyph, localized accessible name (unconditional)

The visible `m.detail_close()` text becomes a "×" glyph;
`aria-label={m.detail_close()}` keeps the localized accessible name, the
focus-return contract, and string externalization intact. The dismissal
requirement's behavior set is untouched.

### D5 — Phone: `tel:` link with digit-stripped href, original display text (unconditional)

When a phone is listed, render `<a href={telHref(phone)}>` where `telHref`
keeps digits and a leading `+` and drops everything else
(`(202) 555-0123` → `tel:2025550123`); the visible text keeps the formatted
value. No phone → the honest "not publicly listed" plain text, unchanged.
Alternative: the raw value in the href — rejected (separator soup is
ambiguous; stripping is the unambiguous form). No country-code invention.

### D6 — Favicon: static assets + explicit link tags (unconditional)

Create `apps/web/static/` with `favicon.svg` (brand mark on the theme
color) plus a small `favicon.ico` fallback, and link both from `app.html`
(SVG primary, ICO as the legacy alternate). SvelteKit serves `static/` in
dev and from the adapter-node build; CSP `img-src self` already covers it;
fixes the 404 in every boot posture.

### D7 — Elimination scan over the PR gate's existing build output

`apps/web/scripts/scan-flag-elimination.mjs` scans `apps/web/build/client`
and fails on BOTH signals (archived design D4): any
`__FLAG_`/`__DEV_SERVER__` identifier, and any `data-flag=` marker. Wired
as a `scan:flags` package script (local: build + scan) and a PR-gate step
immediately after the existing web-production-build step, reusing its
output — no second build in CI.

### D8 — Registry hygiene check + docs line (remaining rider duties)

`flags.test.ts` gains a registry-shape test: entries unique and kebab-case
(`^[a-z0-9]+(-[a-z0-9]+)*$`). `flags/README.md` gains a short "flags are
never a security boundary" paragraph: flags gate candidate UX trials only,
never authorization or security-relevant behavior.

### D9 — Spec delta shape (housing-search-ui) and test posture

- ADDED requirement: map camera controls — scenarios in the feature-flags
  opt-in frame (dev session with the flag enabled): controls render and
  operate; recenter returns the camera to the configured locale view.
  Prod-build absence is the feature-flags spec's elimination requirement —
  not restated.
- MODIFIED requirement: Unit detail slide-over — added scenarios for the ×
  close affordance (icon visible, localized accessible name) and
  phone-as-`tel:` link (linked when listed, honest plain text when not).
- Favicon stays out of the delta (app-shell serving polish, not a
  capability behavior).
- Tests: unit tests with the maplibre mock (`vi.stubGlobal` on the flag
  anchors, per the archived design's test note) + the D7 scan; existing
  e2e suites unchanged — the Compose matrix exercises builds where the
  controls provably don't exist.

### D12 — Markup guards are stripped pre-compilation in non-dev builds (user decision 2026-11-08)

Empirical finding at the first consumer: Svelte 5 compiles `{#if}`
branches as live closure arguments to its runtime, so a folded-false
condition eliminates the JS machinery (zero `__FLAG_*`/`__DEV_SERVER__`
identifiers in the built output — verified) but cannot eliminate the
branch closures or their hoisted template fragments: the D7 scan
correctly failed on `data-flag=` markers surviving as dead strings.
Even a literal `{#if false}` keeps its branch (verified against the
compiler directly — the consequent closure is an argument to a runtime
call the bundler must keep).

Decision: a small Svelte preprocessor (module beside the flags
registry, unit-tested, wired only into non-dev-server compiles) strips
every `{#if}` block whose condition references a `__FLAG_*__`
identifier, at parse time — before Svelte compiles. Consequences:

- Source keeps the blessed guard shape unchanged; dev-server runs keep
  the full runtime override machinery (preprocessor inert).
- JS-module guards keep define + DCE elimination as before.
- A guarded block with an `{:else}`/`{:else if}` branch is a loud
  preprocessor error — the blessed shape has no else.
- The D7 scan stays at full strength (both signals) and now passes on
  real output; the flags README documents the markup elimination path.

### D10 — CSS-first presentation for every touched surface

The new controls, the × close affordance, and the `tel:` link render all
presentation in CSS: native positioned buttons, states
(hover/focus/active/pressed) via CSS pseudo-classes, responsive placement
through the existing size-class breakpoints, colors/spacing from the
`app.css` custom-property tokens, and progressive enhancement via
`@supports` feature queries — no JS-computed inline styles, no JS feature
sniffing, no vendor-prefix branches in script. The repo-wide JS→CSS
offload audit remains W14 and theming remains W17; this change only
follows the rule on surfaces it touches.

### D11 — Simplification pass and domain language on touched surfaces

Every file this change edits gets a simplification-for-clarity review
before its block completes — run under the `code-simplification` and
`codebase-design` skills where the harness provides them, mirroring the
proposal's Svelte-skills execution approach. Names speak domain, not
mechanism: `recenterOnLocale`, `LOCALE_MAP_CENTER`, `telHref` — camera
operations live in the map-config domain module (beside the constants
they operate on), not a generic helpers file; `telHref` lives with the
detail-contact rendering it serves. Test names stay behavioral sentences
(repo doctrine already requires this). Bound: simplification applies only
to code this change already touches — no drive-by refactors of untouched
code (repo minimal-change rule); anything wider the pass suggests gets
noted for a spawn, not folded in here.

## Risks / Trade-offs

- [Svelte `{#if}` elimination relies on define replacement + esbuild DCE
  folding through Svelte 5's compiled block code] → CONFIRMED at the first
  consumer: the fold eliminates the JS machinery but not the branch
  closures' template fragments; D12's preprocessor strip is the resolution.
  D7's scan remains the empirical proof on real output and fails the gate
  on any leak — exactly why it rides with the first consumer.
- [Controls overlay collides with existing overlays (attribution control,
  phone map-tab offset)] → position the group clear of the attribution
  corner and the mobile tab bar; final placement settled in the dev trial.
- [`tel:` stripping drops extension digits or exotic separators] → out of
  scope by vocabulary (synthetic data is `(202) 555-01XX`); the rule is
  data-driven, not hardcoded to that shape.
- [A binary `.ico` enters the repo] → single small fallback asset; SVG
  stays primary.
- [Flag names linger if graduation is late] → pruning at graduation is the
  documented two-line reversal in the registry header.

## Migration Plan

Additive; both candidate controls are default-off even in dev (explicit
opt-in per the feature-flags spec), so no session sees new map controls
until a flag is set. Unconditional items (×, `tel:`, favicon) are direct
one-line-scope behavior changes. Rollback = revert the commits. Graduation
promotes a control to unconditional and removes its two registry lines.
