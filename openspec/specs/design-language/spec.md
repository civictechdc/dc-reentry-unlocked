# design-language Specification

## Purpose
Governs the web app's visual identity as a maintained design language: one source artifact, layered readable tokens, a tetradic WCAG-conformant palette, mechanical contrast guarantees, and deterministic generation into runtime CSS.

## Requirements

### Requirement: Single source artifact generates runtime tokens

The design language SHALL be defined in one machine-readable source artifact (`apps/web/DESIGN.md`) with rationale prose, and runtime color, spacing, and rounded-corner tokens SHALL exist only as committed output generated from it. Regeneration from an unchanged artifact SHALL be byte-identical, and a missing, untracked, or hand-edited generated artifact SHALL fail verification.

#### Scenario: Token edit regenerates cleanly

- **WHEN** a token value is edited in the source artifact and the export is regenerated
- **THEN** the committed generated stylesheet reflects the edit and a further regeneration produces no diff

#### Scenario: Generated-artifact tampering fails closed

- **WHEN** the generated stylesheet is hand-edited, deleted, or left untracked
- **THEN** the export verification step fails

#### Scenario: Runtime consumption goes through the generated stylesheet

- **WHEN** a color, spacing, or rounded-corner token is consumed at runtime
- **THEN** it resolves through the generated token stylesheet rather than a duplicated hand-written literal (non-CSS consumers follow the bridge requirement below)

### Requirement: Layered, readable token names

Tokens SHALL follow a three-layer grammar — primitives, semantic aliases, and component entries — with flat, domain-readable leaf names whose names say what they are for. Component entries SHALL reference other tokens and govern recipes and contrast without emitting CSS custom properties. Consumers SHALL use semantic names rather than primitive names, and every exported leaf SHALL flatten to exactly one distinct `--color-*`, `--spacing-*`, or `--rounded-*` property.

#### Scenario: Reference resolves at export time

- **WHEN** a semantic color such as `accent` references a primitive such as `blue-strong`
- **THEN** the generated stylesheet contains `--color-accent` set to the primitive's resolved literal value, with no runtime `var()` chain

#### Scenario: Component entries emit no custom properties

- **WHEN** a component entry such as `components.button-primary` references `{colors.accent}`
- **THEN** it documents the recipe but generates no CSS custom property of its own

#### Scenario: Flattened names stay distinct and predictable

- **WHEN** the token tree is exported
- **THEN** every custom-property name in the output is unique and derivable from its leaf path

### Requirement: Tetradic palette with subordinate supporting hues

The brand palette SHALL be organized as a tetradic scheme — two complementary pairs anchored on blue/orange and green/magenta hue roles documented in the source artifact — with neutrals dominant, blue owning primary-action identity, and supporting hues subordinate. Data-carrying status colors SHALL stay semantically independent of brand tokens: map pins denote availability, highlight denotes selection, badges denote verification status.

#### Scenario: Palette derives from the four documented anchors

- **WHEN** brand palette primitives are defined
- **THEN** their construction from the four hue anchors (ramps, lightness targets, gamut reduction) is recorded in the source artifact's prose

#### Scenario: Coinciding values stay unaliased

- **WHEN** a status token and a brand token happen to hold equal values
- **THEN** they remain separate tokens with no alias between them, so one can change without the other

#### Scenario: Supporting hues never pose as status

- **WHEN** a supporting brand hue is applied to a component
- **THEN** it does not present as availability, selection, or verification-status meaning

### Requirement: WCAG-conformant token pairs enforced mechanically

Every token pair the UI relies on SHALL meet WCAG 2.x contrast thresholds under a blocking automated suite over an explicit role/state/adjacency matrix: normal text at least 4.5:1; large text at least 3:1 claimed only with size or weight evidence; essential non-text boundaries at least 3:1 against actual adjacent colors. Thresholds SHALL NOT be rounded or waived to make a failing pair pass.

#### Scenario: Matrix pairs pass

- **WHEN** the contrast suite runs against resolved tokens
- **THEN** every in-use pair in the matrix — body and muted ink on each used surface, on-accent text in each action state, badges, map-label text, focus rings, selection outlines, and essential control and pin boundaries — meets its threshold

#### Scenario: Regression fails the build

- **WHEN** a token change drops any matrix pair below its threshold
- **THEN** the suite fails

#### Scenario: Essential boundaries use passing roles

- **WHEN** a control or pin boundary carries meaning
- **THEN** it uses a token that passes the non-text threshold against its actual adjacent color, and decorative lines are not counted as essential

#### Scenario: Pre-existing failures are corrected, not exempted

- **WHEN** an in-use essential pair fails at inventory time
- **THEN** the failure is documented and the pair corrected, not carved out of the matrix

### Requirement: Hand-written families and bridges stay drift-checked

Typography and elevation, which the generated output does not cover, plus non-CSS color consumers (map paints, bitmap channels, document theme-color) SHALL be hand-written or bridged and checked against the source artifact. The check SHALL parse the artifact safely as data, resolve references, and fail closed on missing or extra mappings, unsupported values, unresolvable or cyclic references, or hand-written overrides of generated names.

#### Scenario: Drift in hand-written families fails

- **WHEN** a hand-written typography or shadow value diverges from the source artifact
- **THEN** the drift check fails

#### Scenario: Malformed source fails closed

- **WHEN** the artifact's YAML is malformed or a reference cannot be resolved
- **THEN** the check errors rather than passing silently

#### Scenario: Bridge drift fails

- **WHEN** a source color consumed by the map, a bitmap channel, or the document theme-color changes
- **THEN** the check fails until the bridge constant is updated

#### Scenario: Generated names cannot be overridden by hand

- **WHEN** hand-written CSS declares a custom property under a generated name
- **THEN** the check fails

### Requirement: Opaque sRGB runtime with guarded modern features

Runtime token values SHALL be opaque sRGB hex requiring no engine feature beyond CSS custom properties; reference resolution SHALL happen at generation time, not as runtime `var()` chains or color conversion. Any future less-supported color feature SHALL ship an sRGB base declaration plus a real `@supports` property-value guard, and engines without the feature SHALL receive a legible, plainer theme with no polyfill JavaScript.

#### Scenario: Hex-only runtime needs no guards

- **WHEN** the token system as delivered by this change is inspected
- **THEN** every color value is opaque hex and no `@supports` guard is required for correctness

#### Scenario: Future modern features are guarded

- **WHEN** a modern color function is adopted later
- **THEN** an sRGB base declaration and a real `@supports` property-value guard accompany it, and both the modern and fallback paths are tested

#### Scenario: Unsupported engines degrade honestly

- **WHEN** an engine lacks a guarded feature
- **THEN** fallback values render a legible theme without JavaScript assistance

### Requirement: Palette activation gated by audience review

Palette value changes (as distinct from structure or tooling work) SHALL be produced as candidates whose exact values are review outputs and activated only after recorded walkthrough-audience approval of the palette and its semantic distinction, with all mechanical gates passing. Rejected palettes SHALL roll back through the source artifact and regeneration — never by hand-editing generated output or weakening a gate.

#### Scenario: Candidate waits for approval

- **WHEN** a candidate palette has been produced and its gates pass
- **THEN** activation remains blocked until the audience approval is recorded

#### Scenario: Rejection rolls back through the source

- **WHEN** the audience rejects a candidate
- **THEN** values are reverted in the source artifact and the stylesheet regenerated, leaving the generated file unpatched and every gate intact

### Requirement: Design verification wired into every entry point

Design-language verification — artifact lint (errors blocking, warnings surfaced without failing), regeneration identity, the drift check, and the contrast suite — SHALL run through a single root command locally and in both CI workflow entry points, and its failures SHALL block.

#### Scenario: Root command blocks on each failure class

- **WHEN** the root design command runs
- **THEN** lint errors, regeneration diffs, drift failures, and contrast failures each produce a failing exit

#### Scenario: Warnings surface without failing

- **WHEN** lint reports warnings but no errors
- **THEN** the run surfaces them and still succeeds

#### Scenario: Both CI entry points enforce it

- **WHEN** either CI workflow runs
- **THEN** the design command executes and the job blocks on its failure
