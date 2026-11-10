---
version: alpha
name: Civic Clean Light
description: Light-only civic-clean visual identity for the housing inventory web app — one source of truth for color, typography, spacing, shape, and elevation tokens.
colors:
  # Layer 1 — primitives: appearance-named literal values. Consumers never
  # reference these directly; semantic names below point at them.
  white: "#ffffff"
  slate-faint: "#f5f7fa"
  slate-ink: "#1b2a34"
  slate-muted: "#51606b"
  slate-line: "#cbd3d9"
  slate-line-strong: "#84909a"
  blue-faint: "#e3f0fd"
  blue-strong: "#0b5fab"
  blue-deep: "#094a86"
  blue-ring: "#1d4ed8"

  # Layer 2 — semantic aliases: the names consumers use. Flat, readable,
  # unique. Values resolve to literal lowercase hex at export time.
  surface: "{colors.slate-faint}"
  surface-raised: "{colors.white}"
  surface-selected: "{colors.blue-faint}"
  # Deliberately a literal, not a brand reference: the disclosure banner is
  # a cautionary surface whose value must not move with brand edits.
  surface-warning: "#fff8e1"
  ink: "{colors.slate-ink}"
  ink-muted: "{colors.slate-muted}"
  ink-on-accent: "{colors.white}"
  line: "{colors.slate-line}"
  line-strong: "{colors.slate-line-strong}"
  accent: "{colors.blue-strong}"
  accent-hover: "{colors.blue-deep}"
  accent-focus-ring: "{colors.blue-ring}"

  # Layer 2 — status data paints, deliberately literal (never aliased to
  # brand tokens) so availability, selection, and verification semantics can
  # change independently of the palette. Equal values are coincidence, not
  # aliasing.
  pin-exact: "#0b5fab"
  pin-highlight: "#d9340f"
  pin-highlight-ring: "#ffffff"
  # Map paint roles consumed outside CSS (MapLibre style JSON and the
  # typed-array label-bubble bitmap) through checked bridge constants.
  pin-ring: "#ffffff"
  pin-label-bg: "#ffffff"
  # Deliberately distinct from ink: the map address label keeps its own
  # darker value regardless of any body-ink edit.
  pin-label-ink: "#1f2937"
  pin-label-border: "#cccccc"
  badge-confirmed-bg: "#d1e7dd"
  badge-confirmed-ink: "#0f5132"
  badge-unverified-bg: "#ffe8cc"
  badge-unverified-ink: "#7c3a00"
typography:
  body:
    fontFamily: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.45
  small:
    fontFamily: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.45
  heading:
    fontFamily: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif
    fontSize: 1.25rem
    fontWeight: 400
    lineHeight: 1.45
spacing:
  none: 0rem
  xs: 0.25rem
  sm: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  xxl: 2rem
rounded:
  control: 6px
  pill: 999px
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink-on-accent}"
    rounded: "{rounded.control}"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.ink-on-accent}"
  button-quiet:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  toggle-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink-on-accent}"
    rounded: "{rounded.pill}"
  chip-active:
    backgroundColor: "{colors.surface-selected}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
  card-unit:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  badge-confirmed:
    backgroundColor: "{colors.badge-confirmed-bg}"
    textColor: "{colors.badge-confirmed-ink}"
    rounded: "{rounded.pill}"
  badge-unverified:
    backgroundColor: "{colors.badge-unverified-bg}"
    textColor: "{colors.badge-unverified-ink}"
    rounded: "{rounded.pill}"
  banner-disclosure:
    backgroundColor: "{colors.surface-warning}"
    textColor: "{colors.ink}"
  screen-page:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
  # Map paints are data, not chrome; they are recipes here and consumed
  # outside CSS through checked constants, never by aliasing brand tokens.
  map-pin-available:
    backgroundColor: "{colors.pin-exact}"
  map-pin-highlighted:
    backgroundColor: "{colors.pin-highlight}"
  map-pin-ring:
    backgroundColor: "{colors.pin-highlight-ring}"
  map-pin-label:
    backgroundColor: "{colors.pin-label-bg}"
    textColor: "{colors.pin-label-ink}"
  elevation-raised:
    shadow: "0 1px 3px rgb(27 42 52 / 0.25)"
---

## Overview

The visual identity is **civic clean light**: a single light theme built on
near-white neutral surfaces, dark desaturated slate ink, and one confident
institutional blue that owns primary actions. It should read as trustworthy
municipal infrastructure — calm, dense with information, and free of
decoration that competes with data.

Neutrals dominate every screen. Blue appears only where interaction or
identity demands it. Status colors (map pins, the selection highlight, and
verification badges) carry data meaning and stay independent of the brand
palette even where values coincide. A tetradic supporting palette (anchored
on complementary hue pairs) is planned as a separate reviewed candidate —
not yet landed — and must keep these status semantics intact.

## Colors

Tokens layer in three strata:

1. **Primitives** — appearance-named literal hex values (`blue-strong`,
   `slate-muted`). Nobody consumes a primitive directly.
2. **Semantic aliases** — flat, readable role names (`accent`,
   `surface-raised`) that reference primitives. These are the only names
   components consume, and export resolves each to its literal hex so
   runtime never walks a `var()` chain.
3. **Component entries** — recipes under `components:` that reference
   tokens and document pairing and contrast. They emit no CSS custom
   properties of their own.

### Primitives

| Token               | Value     | Role                                            |
| ------------------- | --------- | ----------------------------------------------- |
| `white`             | `#ffffff` | Raised cards, controls, on-accent ink           |
| `slate-faint`       | `#f5f7fa` | Cool page wash behind everything                |
| `slate-ink`         | `#1b2a34` | Body ink — near-black with a cool cast          |
| `slate-muted`       | `#51606b` | Secondary ink for de-emphasized text            |
| `slate-line`        | `#cbd3d9` | Quiet hairline borders (decorative)             |
| `slate-line-strong` | `#84909a` | Essential control boundaries                    |
| `blue-faint`        | `#e3f0fd` | Selection tint derived from the accent hue      |
| `blue-strong`       | `#0b5fab` | The institutional action blue                   |
| `blue-deep`         | `#094a86` | Hover state of the action blue                  |
| `blue-ring`         | `#1d4ed8` | Keyboard focus ring, visibly distinct from fill |

### Semantic roles

- **`surface` (`#f5f7fa`)** — the page background. Slightly cool so pure
  white cards read as lifted without any shadow increase.
- **`surface-raised` (`#ffffff`)** — cards, filter controls, header. The
  white lifting mechanism of the whole layout.
- **`surface-selected` (`#e3f0fd`)** — active chips and pressed control
  state; a whisper of the accent hue, not a new color.
- **`surface-warning` (`#fff8e1`)** — the disclosure banner only. Held as a
  literal, outside all brand references, so its cautionary warm cast cannot
  drift when the palette is reviewed.
- **`ink` (`#1b2a34`)** — primary text everywhere.
- **`ink-muted` (`#51606b`)** — secondary text: provider lines, helper
  copy, de-emphasized metadata.
- **`ink-on-accent` (`#ffffff`)** — text on any action-blue fill, in every
  action state.
- **`line` (`#cbd3d9`)** — decorative hairlines. Decorative only: nothing
  essential depends on seeing it.
- **`line-strong` (`#84909a`)** — the boundary an essential control
  actually needs; every interactive control outline uses this role.
  Inventory-time correction: the pre-existing value `#8a97a0` measured
  2.99:1 against the white control fill and 2.79:1 against the page wash —
  both below the 3:1 non-text threshold an essential boundary must meet —
  so it was darkened to `#84909a` (3.26:1 on white, 3.04:1 on the page
  wash) instead of exempting the pair.
- **`accent` (`#0b5fab`)** — primary actions, selected-state outline, and
  the document theme color.
- **`accent-hover` (`#094a86`)** — the pressed/hovered action state, one
  step deeper for visible feedback.
- **`accent-focus-ring` (`#1d4ed8`)** — the shared `:focus-visible` outline;
  deliberately a different blue than the fill so focus stays legible on and
  next to action-colored elements.

### Status and map paints (deliberately unaliased)

| Token                  | Value     | Meaning                                       |
| ---------------------- | --------- | --------------------------------------------- |
| `pin-exact`            | `#0b5fab` | Available unit's map pin (availability)       |
| `pin-highlight`        | `#d9340f` | Selected/hovered pin (selection)              |
| `pin-highlight-ring`   | `#ffffff` | Stroke that separates highlight from tiles    |
| `pin-ring`             | `#ffffff` | Stroke that separates the base pin from tiles |
| `pin-label-bg`         | `#ffffff` | Label bubble body the address text sits on    |
| `pin-label-ink`        | `#1f2937` | Map address-label text on the bubble          |
| `pin-label-border`     | `#cccccc` | Label bubble's soft bitmap border             |
| `badge-confirmed-bg`   | `#d1e7dd` | Confirmed verification badge background       |
| `badge-confirmed-ink`  | `#0f5132` | Confirmed badge text                          |
| `badge-unverified-bg`  | `#ffe8cc` | Needs-verification badge background           |
| `badge-unverified-ink` | `#7c3a00` | Needs-verification badge text                 |

These stay literal even where a value equals a brand token (`pin-exact` is
`#0b5fab`, the same hex as `accent`; `pin-ring` and `pin-label-bg` are
`#ffffff`, the same hex as `white` — with no reference between them): pins
mean availability, highlight means selection, badges mean verification
status — none may inherit palette edits meant for actions. Supporting brand
hues must never pose as status indicators.

Map paint colors and the label-bubble bitmap channels are consumed outside
CSS (MapLibre style JSON and a typed-array bitmap), so they are checked
against these tokens through the explicit bridge constants in
`src/lib/map/map-colors.ts` rather than custom properties; the drift
checker fails when any constant drifts from its token here. The map
address-label ink (`#1f2937`) keeps its distinct value as `pin-label-ink`
(exported `--color-pin-label-ink`) rather than collapsing into `ink`. The
document `theme-color` in `app.html` is checked against `accent`.

## Typography

One system font stack for everything — zero webfont payload, native
rendering per platform:

`system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`

Three roles cover the app's type needs:

- **`body`** — 1rem / 1.45 line-height, weight 400. All running text and
  default control text.
- **`small`** — 0.875rem, weight 400, inheriting the 1.45 line-height.
  Card specifications, legends, active-chip labels, banner body copy.
- **`heading`** — 1.25rem, weight 400, inheriting the 1.45 line-height.
  Section-level scale for prominent headings.

### Inventory of current component literals

Weight and line-height literals found across the components and routes at
inventory time (these govern the roles above and any later retrofit):

- **Weight 700** — unit-card titles (`h2`, at 1rem) and the disclosure
  banner title.
- **Weight 600** — verification badges (0.75rem), filter legend/control
  labels (0.8rem), the mobile sheet's apply button, the page's
  filter-open button, and the error screen call-to-action.
- **Weight 400** — the unit-card provider line (0.875rem) and everything
  inheriting the body default.
- **Line-height 1.45** — the body default, inherited by nearly all text.
- **Line-height 1.4** — the disclosure banner paragraph at 0.875rem, the
  one deliberate tightening of small prose.
- **Line-height 1** — the map camera-control buttons (at 1.25rem) and the
  detail slide-over close button; single-glyph controls, not prose.

Sizes outside the three roles — 0.75rem, 0.8rem, 0.85rem, 0.9rem, 1.05rem,
1.125rem — are exceptional dimensions that stay explicit until the repeated
equal literals are retrofitted to the roles first.

Typography custom properties are hand-written in `app.css` and drift-checked
against this section because the exporter deliberately omits the family.

## Layout

Spacing follows a 4px rhythm expressed in rem, with named steps instead of
ad-hoc values:

| Step   | Value   | Intended use                           |
| ------ | ------- | -------------------------------------- |
| `none` | 0rem    | Explicit "no gap" intent               |
| `xs`   | 0.25rem | Icon-to-label, inline nudges           |
| `sm`   | 0.5rem  | Inside-component padding, tight stacks |
| `md`   | 0.75rem | Card padding, list rhythm              |
| `lg`   | 1rem    | Control padding, group separation      |
| `xl`   | 1.5rem  | Section separation                     |
| `xxl`  | 2rem    | Page-level separation                  |

Repeated equal literals retrofit to these steps first; genuinely
exceptional dimensions (viewport-driven heights, hit-target floors) stay
explicit. Spacing and rounded values export verbatim into custom
properties; dimension renames land with the runtime swap.

## Elevation

Elevation is quiet: exactly one shadow, carried by the raised surface that
already lifts via pure white against the faint page wash.

The shadow value is `"0 1px 3px rgb(27 42 52 / 0.25)"` — a 1px-offset,
3px-blur ink shadow at 25% alpha, tight enough to read as paper edge rather
than glow. It lives at `components.elevation-raised.shadow` (an entry the
exporter does not turn into CSS, which is precisely why elevation stays
hand-written in `app.css` and drift-checked against this entry) and is
consumed by unit cards. No other elevation level exists; do not add one
without removing this one.

## Shapes

Two rounded roles:

- **`control` (6px)** — cards, buttons, selects, inputs, panels. Sharp
  enough to feel institutional, soft enough to avoid harshness at dense
  sizes.
- **`pill` (999px)** — verification badges, active chips, toggle pills.
  Full rounding marks the small, status-adjacent shapes; if a shape uses
  `pill` it is metadata, never a container.

Mixing is allowed only across these two roles; arbitrary radii are not
part of the language.

## Components

Recipes reference semantic tokens; hover and pressed variants are sibling
entries with related keys. Pairs listed here are asserted by the contrast
suite against the resolved values.

| Entry                  | Background            | Text                   | Notes                         |
| ---------------------- | --------------------- | ---------------------- | ----------------------------- |
| `button-primary`       | `accent`              | `ink-on-accent`        | The one loud action           |
| `button-primary-hover` | `accent-hover`        | `ink-on-accent`        | Hover/active variant          |
| `button-quiet`         | `surface-raised`      | `ink`                  | Secondary controls            |
| `toggle-selected`      | `accent`              | `ink-on-accent`        | Pressed filter toggle         |
| `chip-active`          | `surface-selected`    | `ink`                  | Active filter chip            |
| `card-unit`            | `surface-raised`      | `ink`                  | Unit card                     |
| `badge-confirmed`      | `badge-confirmed-bg`  | `badge-confirmed-ink`  | Verification status           |
| `badge-unverified`     | `badge-unverified-bg` | `badge-unverified-ink` | Verification status           |
| `banner-disclosure`    | `surface-warning`     | `ink`                  | Referral-policy disclosure    |
| `screen-page`          | `surface`             | `ink`                  | Page-level pairing            |
| `map-pin-available`    | `pin-exact`           | —                      | Availability paint            |
| `map-pin-highlighted`  | `pin-highlight`       | —                      | Selection paint               |
| `map-pin-ring`         | `pin-highlight-ring`  | —                      | Highlight stroke paint        |
| `map-pin-label`        | `pin-label-bg`        | `pin-label-ink`        | Address label on its bubble   |
| `elevation-raised`     | —                     | —                      | `shadow` value, see Elevation |

Essential non-text boundaries (control outlines in `line-strong`, the
selection outline in `accent`, focus rings in `accent-focus-ring`, pin
strokes in `pin-highlight-ring` and `pin-ring`) are asserted at the 3:1
non-text threshold against the surfaces they actually draw across;
decorative `line` hairlines and raster-tile adjacency are explicitly not
asserted.

## Do's and Don'ts

- Do use `accent` only for the primary action or selection state in a view.
- Don't alias status tokens (`pin-*`, `badge-*`, `surface-warning`) to
  brand tokens — equal values are coincidence, not coupling.
- Do keep text pairs at WCAG AA (4.5:1 normal text); large-text 3:1 claims
  require explicit size/weight evidence.
- Don't treat `line` as a boundary that must be seen — use `line-strong`
  for essential control edges.
- Do consume tokens through the generated custom properties and the checked
  bridge constants; never hand-edit the generated stylesheet or splice
  literals into components.
- Don't introduce a second shadow, a second action hue, or radii outside
  `control` and `pill`.
