# Design

## Context

See `proposal.md` and finding CO-3 in
`openspec/changes/archive/2026-11-06-domain-driven-review/domain-review.md`.
The user-approved decisions of 2026-11-12 resolve the proposal's earlier
consumer-side alternatives: render shared contract data, not response-driven
banner state, and retain the envelope's verbatim-description prose.

Verified investigation facts supplied for this plan:

- Four production copies currently agree: datagen
  `tools/datagen/src/generate.ts:244–246`, API
  `apps/api/src/datasource.ts:44–45`, catalog
  `apps/web/messages/en.json:6`, and frozen `data/units.json:4`.
  `packages/shared/src/envelopes.test.ts:15–16` has a fifth fixture copy.
- `packages/shared/src/envelopes.ts:18–41` requires the full units envelope,
  including literal-true synthetic provenance and a non-empty disclosure.
  `apps/api/src/datasource.ts:282–330` checks exact disclaimer agreement,
  rejects drift, then serves the dataset's own sentence. Startup awaits
  dataset construction before listening (`apps/api/src/server.ts:44–61`);
  `apps/api/src/routes/units.ts:21–26` serves source disclosure unchanged.
- `DisclosureBanner.svelte` is mounted by the root layout
  (`apps/web/src/routes/+layout.svelte:5,14`). The client validates the full
  envelope and returns only units (`apps/web/src/lib/api/client.ts:103–109`);
  the store consumes units only (`housing-store.svelte.ts:131`). English is
  the only locale (`apps/web/project.inlang/settings.json`).
- Shared main-entry imports already serve all consumers; existing constant
  precedents include `ERROR_CODES` and `SCHEMA_VERSION`. Shared package
  exports and `.dependency-cruiser.cjs:36–65` permit the intended seam.

## Goals / Non-Goals

**Goals:**

- One authored disclosure literal shared by generator, API, banner, and fixture.
- Preserve dataset bytes, wire shape, exact boot guard, and visible wording.
- Keep the safety notice present even before or without a successful API call.
- Pin observable provenance, startup refusal, and banner behavior in tests.

**Non-Goals:**

- Schema-version changes, dependency additions, schema tightening, ingestion
  redesign, or changes to hierarchy, filters, availability, or unknown values.
- Payload-driven banner state, new fetches, store/client return-type changes,
  localization infrastructure, or repairs to the unused region-label key.
- Product implementation or commits during this planning session.

## Decisions

These decisions bind implementation.

### 1. Publish contract data from the existing envelope module

Define `SYNTHETIC_DISCLOSURE` in `packages/shared/src/envelopes.ts` as one
string literal, re-exported by `packages/shared/src/index.ts` through the
existing main package entry. Exact value:

> Synthetic prototype data — fictional providers, generated addresses on real DC geography. Not real housing inventory; never contact these organizations.

Follow the existing `ERROR_CODES` / `SCHEMA_VERSION` pattern. Keep schema
description prose, `UnitsResponseSchema`, exports configuration, and schema
version unchanged; do not make disclosure a literal-constrained schema.

Rationale: provenance is contract data; shared is the permitted common
dependency. Alternatives: an API-owned export violates generator seams;
another subpath/module adds needless surface; independent literals preserve
the drift risk.

### 2. Consume the constant without changing serialization or fail-closed startup

Datagen imports the main-entry constant and removes its local
`SYNTHETIC_DISCLAIMER`. API imports it and removes its local
`SYNTHETIC_DISCLOSURE`. Preserve generator construction, random draws,
insertion order, serialization, and the frozen disclaimer field.
`pnpm datagen` must leave `git diff --exit-code -- data/` empty.

Keep the loader's exact-equality check, diagnostic, check order, startup-before-
listen ordering, and `dataset.disclaimer` serving path. Preserve the memory
source's default disclosure and whitespace-only rejection. Routes still
reach data only through the source boundary.

Rationale: source consolidation must not weaken the file/runtime agreement
guard. Alternatives: trusting generated files without comparison removes a
safety boundary; silently replacing an incorrect disclaimer hides drift;
hand-editing the dataset breaks deterministic provenance.

### 3. Render contract data independently of API availability

`apps/web/src/lib/components/DisclosureBanner.svelte` imports the constant
from the shared main entry and renders it as normal text for its body.
Keep root-layout placement, prominence, markup semantics, and heading.
Remove only `banner_body` from `apps/web/messages/en.json`, first searching
for every reference. Retain `banner_heading` and `banner_region_label` as UI
chrome; leave the region-label key's pre-existing unused state alone.
Use normal catalog generation, never hand-edit generated messages.

Render through an ordinary escaped text expression, never raw HTML.
Verified against the current official [Svelte basic-markup documentation](https://svelte.dev/docs/svelte/basic-markup#Text-expressions)
via Context7 on 2026-11-12: text expressions stringify and escape values.

No fetch, response, store, loading, or error-state dependency may gate the
notice. The client still validates the entire `UnitsResponseSchema` envelope
and returns only `payload.units`. The schema prose remains honest: API
disclosure is verbatim dataset provenance, and the banner separately renders
the same canonical contract data.

Rationale: the safety notice must survive service failure. Alternatives:
payload-driven rendering fails before the first successful response; keeping
catalog body text preserves a second authored provenance source. This change
exercises the already-settled schema-labels-vs-catalogs split: contract data
rides the published contract, like filter labels, while UI chrome rides the
message catalog. The delta therefore MODIFIES the Internationalization
readiness requirement to scope externalization to UI chrome and name the
contract-data carve-out, so spec and implementation agree rather than
contradict. This English provenance sentence is deliberately not translatable
UI chrome.

### 4. Remove the fixture copy without hiding drift

Replace `sampleDisclosure`'s literal in
`packages/shared/src/envelopes.test.ts:15–16` with the shared constant.
Retain test intent and fixture shape. Do not copy the literal into new tests.

Rationale: fixtures should consume the same contract data. Alternative:
leaving an independent fixture sentence creates another maintenance site.
Frozen-file byte identity supplies an independent guard against accidental
wording changes even when expectations import the constant.

### 5. Pin every delta scenario with behavioral evidence

- API "Units payload preserves dataset provenance": retain the existing
  verbatim-header route assertion in `apps/api/test/datasource.test.ts:193–213`.
- API "Empty results preserve dataset provenance": add or retain a route
  request yielding no matches and assert both provenance fields.
- API "Served disclosure agrees with the contract": assert served disclosure
  equals the imported constant in addition to the dataset header. Retain
  memory-source marker coverage at `:215–220`.
- API "Dataset disclaimer differs from the contract": retain drift rejection
  at `:239–254`; review the unchanged startup await before listen as the
  connection from source rejection to boot refusal. Never weaken the guard
  or change the diagnostic to make a test pass.
- UI "Synthetic-data notice visible": add a web-side rendered banner-body
  assertion against the imported constant, retaining heading assertions.
- UI "Synthetic-data notice survives an unreachable API": add a rendered
  root-layout web test with the units request rejecting from initial load,
  no cached response, and assert full banner text remains after failure.
  A standalone component test alone does not prove root-layout persistence.
- UI "String externalization": the banner-body equality test plus the
  existing externalization audit practice cover contract-data rendering and
  catalog-backed UI chrome; no new test framework is needed.
- Retain datagen byte-identity tests (`generate.test.ts:41–45,62–70`), extend
  the header assertion at `:47–60` to exact constant equality, and regenerate
  with an empty `data/` diff.

Rationale: existing heading-only e2e waits (`app.steps.ts:8–12`) do not prove
body agreement or failure-state visibility. Alternatives: source-text grep
alone cannot prove rendering; repeating the sentence in assertions restores
the duplication being removed. Human verification must confirm the notice's
unchanged prominence in normal and API-unreachable views before completion.

### 6. Document ownership, preserve architecture and workflow boundaries

During implementation add a concise ownership note in
`docs/data-synthetic.md` near `:158–162`: the shared contract sentence feeds
generation, boot agreement, and the always-present banner. Add the main-entry
constant and banner's no-fetch intent near the disclosure example in
`docs/shared-contracts.md:134`. Preserve its testing-subpath rule at `:146–147`
and the frozen-contract invariant prose; no broader doc rewrite is needed.

Shared imports nothing from apps/tools; consumers import only shared across
workspace seams. Testing builders come only from the testing subpath in test
files. No OpenSpec tracking references enter code/config/docs outside
`openspec/`. Implementers never commit; human artifact approval precedes
implementation, and code plus security review precede orchestrator commits.

Rationale: ownership and the deliberate payload discard should be explicit
without weakening established rules. Alternative: broad documentation or
architecture cleanup expands scope without strengthening this contract.

## Risks / Trade-offs

- [Banner body no longer localizable] → English-only by design; sentence is
  data provenance, not UI chrome. Heading and region label remain catalog
  entries. Any future translated provenance needs a separately approved
  contract design.
- [Removing a catalog key leaves stale references] → Search references first,
  update the banner, regenerate through normal tooling, then run web tests
  and typechecking; do not patch generated files manually.
- [Constant extraction changes frozen bytes] → Keep punctuation, em dash,
  spaces, and serialization identical; require byte-identity tests and an
  empty regenerated `data/` diff. Never accept new bytes as a cleanup.
- [Shared expectations conceal a wording change] → Frozen bytes independently
  pin the sentence; compare the literal against the approved value in review.
- [Banner becomes coupled to service success] → Keep root-layout placement
  and import-only data flow; test initial API failure without cached units.

## Migration Plan

1. Human approval of these artifacts and the `skip_specs` removal is required
   before implementation. Removal is included in this planning edit; it does
   not authorize implementation.
2. Add the shared constant and main-entry export; de-duplicate the fixture.
3. Switch datagen consumption; prove frozen-byte identity immediately.
4. Switch API consumption; retain boot guards and pin serving semantics.
5. Switch banner body, remove the catalog key, and prove normal/failure views.
6. Add the two focused ownership notes, run all task gates, and obtain human
   UI verification plus code/security review before orchestrator commit.

No data migration or schema-version bump. Rollback is a revert of the scoped
code/tests/docs and corresponding spec changes; never hand-edit frozen data.
