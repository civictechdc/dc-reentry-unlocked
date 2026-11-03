# Tasks

## 1. Shared contract (packages/shared)

- [x] 1.1 Remove `LocationPrecision` and the `locationPrecision` field from Unit and UnitCard; make `coordinates` required (non-null) on both; bump `SCHEMA_VERSION` to 2.0; remove the approximate-related builder methods from the testing subpath; verify round-trip/conformance tests updated and green (`pnpm -C packages/shared test`) — an approximate-shaped payload now FAILS validation, pinned by test
- [x] 1.2 Update `docs/shared-contracts.md` field lists and examples for the v2 card; verify the doc-example mirror test compiles and passes against the v2 contract

## 2. Dataset v2 (tools/datagen)

- [x] 2.1 Remove the approximate distribution from the generator (every unit derives from a real street piece with interpolated coordinates); drop the both-precisions-per-ward invariant while keeping ward coverage 1–8; correlate bedrooms with room type (apartment ≥ 1, efficiency 0, private-room 1, shared-room 0 — the incoherent 0BR apartments die); verify fast-check properties re-proven for the exact-only world (on-street, strictly-inside-ward, one-ZIP, schema conformance, determinism) plus the new bedrooms-agree-with-room-type invariant
- [x] 2.2 Write the new frozen dataset `data/units.v2.json` (fixed seed discipline unchanged), delete `data/units.v1.json`, update the loader path + version assert (schemaVersion 2.0) and the api Dockerfile's dataset COPY; verify `pnpm datagen && git diff --exit-code -- data/` proves byte-identical regeneration of v2, and re-measure the units payload (record the new baseline in `docs/perf-notes.md`)

## 3. API (apps/api)

- [x] 3.1 Serve the v2 dataset (loader changes only — routes serialize via the shared schemas); verify the served-card tests pin exact coordinates on every card, the availability/unknown semantics suites stay green, and `pnpm -C apps/api test` passes including the OpenAPI drift test against the updated schemas

## 4. Web (apps/web)

- [x] 4.1 Remove the approximate machinery: delete `src/lib/map/ward-anchors.ts`; simplify `unitsToFeatureCollection` (no anchor fallback, no `approximate` property); remove the dashed pin style, the legend's approximate entry, the detail view's approximate qualifier, and their message keys; verify the i18n audit stays green (no dead keys), component tests pin the new shape (legend without approximate entry, every pin from unit coordinates), and existing approximate-pinning tests are removed or inverted honestly
- [ ] 4.2 Present zero-bedroom efficiencies as "Studio": a message key mapping 0BR + efficiency on the card's bedroom line and the detail's bedrooms row (other zero-bedroom pairs keep numeric presentation — a shared-room bed is honestly "0 bedrooms"); verify component tests pin the Studio presentation and the shared-room numeric case, the i18n audit stays green, and the BDD/detail steps that count bedroom labels are updated
- [ ] 4.3 Update the e2e/BDD layers: mobile/a11y/perf/detail specs and BDD steps that referenced approximate placement or the qualifier; verify `pnpm -C apps/web e2e` + `e2e:bdd` + `e2e:prod` all green

## 5. Docs + hygiene

- [ ] 5.1 Update committed docs and the skill for the exact-only world: `docs/glossary.md` (remove the location-precision term), `docs/data-synthetic.md` (no approximate share; v2 dataset), `docs/api.md` (card field list), the data-model-reference skill's contract description, `docs/architecture.md` diagram if it names precision; verify the hygiene grep stays clean and every documented command still runs as written
- [ ] 5.2 Verify the planned `card-map-focus` change (amended during this change's planning) carries no approximate/ward-anchor references and remains coherent with the exact-only world; verify `openspec validate --all --strict` passes with both changes planned

## Workflow follow-up

- After all tasks complete: run code review + adversarial security review per project policy, resolve findings, then archive this change (`openspec archive`) and verify the archived specs.
- Implement and archive BEFORE `card-map-focus` (sequencing decision in the design).
