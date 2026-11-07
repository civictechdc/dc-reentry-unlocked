# Domain-driven review — 2026-11-06

A six-axis domain-driven review of the finished prototype, run before the
first push. Two independent commissioned reviewers produced the findings —
one over the capability specs, glossary, shared contract, and test suites
(finding IDs `DM-n`); one over the four workspaces (finding IDs `CO-n`) —
and the orchestrator synthesized this document. High-signal citations were
spot-verified against the working tree. The review changed no code; every
accepted finding is dispositioned below as a follow-up proposal, a fold
into the parallel documentation review, or a recorded no-action.

Reviewed at commit `7b4eefd`, after the exact-address and card/map-focus
work landed. The walkthrough-feedback capability is planned, not yet
landed, and is outside this review.

## How to read this

- Evidence cites `file:line` as of the reviewed commit; line numbers drift,
  the file paths and quoted behavior are the durable part.
- "Signal" is the reviewer's rating of how much the finding matters to
  future evolvability (high / medium / low).
- Dispositions: **follow-up proposal** (a named, scoped change to be
  planned separately — names below exist as proposal-stage OpenSpec
  changes, spawned in commit `f4cb74c`),
  **fold** (carried by an already-planned review), or **no-action**
  (rationale recorded here so the question stays answered).
- Dispositions were confirmed with the product owner on 2026-11-06; the
  calls that required product judgment are recorded inline, dated.

## What held up (the no-action baseline)

The organizational and modelling choices the codebase was built on mostly
survived contact with review:

- **Provider → Program → Unit** separates contact, policy, and
  physical-offering concerns appropriately for a read-oriented prototype.
  No reviewer found a case for behavior-heavy aggregate classes.
- **Availability vs confirmation** survives into filtering, cards, and
  tests; unconfirmed available units are not mistakenly hidden.
- **Honest unknowns** use one explicit literal (`unknown` = "not publicly
  listed") across policy and eligibility data, and the API tests sweep
  every current unknown-capable filter.
- **The flattened, self-contained UnitCard** is a sensible query
  projection — embedded Program and Provider objects preserve meaning
  without consumer-side joins.
- **Filter-as-data is realized end-to-end**: one pinned `UNIT_FILTERS`
  drives the derived OpenAPI querystring schema, `/filters`, the web
  filter UI, chips, and query building; the graceful-degradation path for
  unsupported controls is deliberate and legible.
- **The contract package is genuinely clean**: pure TypeBox + derived
  types behind a single barrel; taxonomy single-sourcing between
  `program.ts` and `filters.ts` is explicit and commented; `docgen/` is
  colocated but not on the package surface.
- **The DataSource seam design is right**: interface + fixture-friendly
  memory factory + production dataset factory; routes reach data only via
  the source, and availability gating and unknown-honesty matching live
  inside it, enforced once. (Its _static backstop_ regressed — CO-1.)
- **Web layering is textbook**: `lib/api` (transport → strict intake →
  query building → selection algebra, UI-free) → `lib/state` (runes
  stores, transport-injected) → components (no domain algebra; state has
  no DOM).
- **Error envelope as shared vocabulary**: one `ERROR_CODES` set consumed
  by both the API mapper and the web failure classifier.
- **datagen's module split** with the determinism contract in the
  generator header and the fictional-contact grammar single-sourced with
  the API's boot-time integrity assert.
- **dep-cruiser as executable architecture**, including the
  `testing`-subpath reachability rule that closes the re-export-laundering
  path; the rules otherwise match the documented seams line for line.
- **The i18n audit test** enforces catalog discipline structurally rather
  than by review vigilance.
- **Testing doctrine mostly holds**: behavioral names, shared fluent
  builders, Gherkin confined to the acceptance layer; schema-conformance
  tests sit appropriately at the contract seam.

## Findings

### Axis 1 — Feature definitions

**DM-9 · medium — Filter combination algebra is established by code and
tests but omitted from the capability contracts.**
`openspec/specs/housing-inventory-api/spec.md` specifies "matching" and
unknown behavior without defining combinations;
`openspec/specs/dynamic-filtering/spec.md` gives one two-filter example
but no within-filter rule. Code explicitly defines OR within a filter and
AND across filters (`apps/api/src/datasource.ts`, the
`matchesFilterDefinition`/`matchesFilterSelection` pair), and tests pin it
as observable behavior (`apps/api/test/units.test.ts`,
`apps/api/test/units.properties.test.ts`), including repeated yes/no
values on a nominally boolean control. A product rule this load-bearing
should live in the API capability, referenced from the UI filtering
capability — not silently in implementation.

### Axis 2 — Domain modelling and ubiquitous language

**DM-1 · high — The supposedly city-agnostic core requires DC-specific
geography on every unit.**
`openspec/specs/housing-inventory/spec.md` (the "Versioned, city-agnostic
model" requirement) keeps jurisdiction-specific fields "as extension
points rather than core fields." Yet `packages/shared/src/unit.ts` requires
`ward` and `quadrant` on both entities and cards, and
`packages/shared/src/primitives.ts` restricts them to DC's 1–8 wards and
four quadrants; `docs/glossary.md` defines Ward as DC geography. Any second
jurisdiction either lies (reusing DC wards) or breaks the contract.

**DM-2 · high — Closed eligibility schemas at the consumer boundary
contradict the promised tolerance of newly added enum values.**
The city-agnostic requirement promises consumers built against a previous
revision keep working when enum values are added ("new fields/enum values
are ignorable"), and `openspec/specs/housing-inventory-api/spec.md` repeats
the guarantee. But `packages/shared/src/program.ts` admits only current
taxonomy values plus `unknown` for every eligibility field, and
`apps/web/src/lib/api/client.ts` validates the whole `/units` response
against that schema and throws on nonconformance. Existing evolution tests
exercise extra _fields_ (`packages/shared/src/entities.test.ts`,
`unit-card.test.ts`), not future enum values: a newly added taxonomy value
would fail every old frontend at intake, equating a known new value with
"not publicly listed."

**DM-3 · high — Frontend knowledge of filter targets prevents
otherwise-supported new filters from evolving solely through backend
data.**
`openspec/specs/dynamic-filtering/spec.md` promises additions using
supported controls require no frontend release, and `docs/glossary.md`
says consumers have "no hardcoded filter knowledge." Yet
`packages/shared/src/filters.ts` pins target names, and
`apps/web/src/lib/api/filters-response.ts` rejects unrecognized string
targets — a new backend policy target using an existing control can fail
the whole filter load in an older frontend (`apps/web/src/lib/api/query.test.ts`
protects that rejection explicitly).

**DM-4 · high — The serving boundary validates record shapes but not the
hierarchy's ownership and identity invariants.**
`openspec/specs/housing-inventory/spec.md` requires exactly one program per
unit and one provider per program. `packages/shared/src/unit.ts` carries
both `programId` and an embedded program, but `ProgramSchema` has no
provider association; nesting supplies it in the frozen dataset. During
projection the loader copies `unit.programId` unchanged while attaching the
containing program/provider (`apps/api/src/datasource.ts`), and source
construction checks duplicate unit ids and schema conformance — not
`programId === program.id` or consistent ownership. This matters the day
the frozen-dataset ingestion is replaced.

**DM-5 · high — Unknown-eligibility matching silently changes when an
existing enum filter switches from single-select to multi-select.**
The glossary and the API capability say enum unknowns match every selected
value. `apps/api/src/datasource.ts` implements that for `single-select` but
exact equality only for `multi-select`, justified by a comment about today's
ward filter ("a ward is never unknown") — the unknown-possibility is a
property of the _target field_, but the behavior is keyed on the _control
branch_. A future multi-select over an unknownable field silently violates
the glossary. (Same root as CO-4 below.)

**DM-6 · medium — The glossary assigns program name and application
process to Provider; the contract assigns both to Program.**
`docs/glossary.md` says a provider owns "organization, program, phone,
email, website, application process"; `openspec/specs/housing-search-ui/spec.md`
calls that whole grouping the "provider contact block." But
`packages/shared/src/program.ts` owns `name` and `applicationProcess` while
`packages/shared/src/provider.ts` owns organization and contact channels
only. The code split is reasonable; the glossary wording is what drifts.

**DM-7 · medium — The description of unverified availability reuses
confirmation language and obscures the domain's central distinction.**
The glossary carefully separates availability state from confirmation with
the source, but `packages/shared/src/primitives.ts` describes
`unverified-availability` as "Availability has not been verified with the
source" — near-identical wording to the confirmation badge description —
and this propagates into the generated `docs/data-model.md`. An API test
additionally calls confirmed units "verified," introducing a third
near-synonym.

### Axis 3 — Test appropriateness

**DM-8 · medium — The shared fixture vocabulary conflates Unit with
UnitCard and defaults to a bedroom/room-type combination the generator's
own domain rule forbids.**
`docs/glossary.md` defines Unit as the hierarchy leaf and the API spec
defines the joined card separately, yet `aUnit()` in
`packages/shared/src/testing/index.ts` returns a `UnitCardBuilder` whose
defaults combine one bedroom with an efficiency — while the inventory spec
requires generated efficiencies to have zero bedrooms. Missing
entity-builder support also forces local `aUnitEntity` factories in
`packages/shared/src/entities.test.ts` and `shared-contracts.test.ts`,
contrary to the centralized-builder doctrine.

**DM-10 · medium — The acceptance assertion claiming identical map/card
results proves counts, not identity equality.**
`openspec/specs/dynamic-filtering/spec.md` requires "the same result set"
and "exactly the matching units"; the Gherkin feature repeats it. But the
step driver (`apps/web/e2e/steps/filter.steps.ts`) compares API, card, and
keyboard-pin _counts_ plus one ward label — equal-sized but different unit
sets would pass.

**DM-11 · medium — Concurrency tests claim response-order safety without
observing distinct delayed response contents.**
`apps/web/src/lib/state/housing-store.test.ts` claims rapid selection
changes "do not interleave stale responses," but its replacement transport
immediately returns empty arrays and the assertions inspect request
count/path only; the property variant accepts any historical path after
multiple actions without awaiting the outstanding refresh cycle. The final
observable result is never checked against controlled delayed payloads.

**DM-12 · medium — Mobile acceptance tests and production state preserve
a map-first initial view contrary to the current list-first specification.**
`openspec/specs/housing-search-ui/spec.md` requires the "tabbed list-first
form" at and below the 900px breakpoint, but production initializes
`mobileTab` to `"map"` (`apps/web/src/lib/state/ui-state.svelte.ts`) and
`apps/web/e2e/mobile.spec.ts` explicitly expects map initially visible.
Spec, implementation, and e2e cannot all be right; which is intended is a
product call this review does not make.

### Axis 4 — Organization by feature seams

**CO-1 · high — The DataSource seam's executable backstop matches a
dataset filename that no longer exists.**
The dep-cruiser rule `api-route-must-not-read-dataset-directly` targets
`(^|/)data/units\.v\d+\.json$`, but the frozen dataset is
`data/units.json` — the rule currently guards nothing, and a route module
statically importing the dataset would pass `pnpm arch:check` today. The
rename that reset the schema version updated the loaders but not this
regex. The seam now rests on the prose comment in `datasource.ts` alone.

**CO-2 · high — UnitCard's `definition` prop has no production supplier;
the housing-type label path is dead code in the running app.**
`apps/web/src/lib/components/UnitCard.svelte` resolves the housing-type
display label through an optional `definition` prop that its only
production caller (`UnitCardList.svelte`) never passes, so the resolution
branch is unreachable and the fallback always renders. Consequence: every
card renders "Housing type: Not publicly listed" regardless of data —
which also _inverts_ unknown-honesty, presenting a known taxonomy value as
not-listed. No test covers the row (spot-verified: the prop is absent at
the sole call site).

**CO-6 · medium — The frozen-dataset file shape is declared twice, once
by hand, in two workspaces.**
`tools/datagen/src/generate.ts` re-states the full provider/program field
lists for the dataset format instead of deriving them from the shared
contract types the way the API loader does. A field added to
`ProgramSchema` compiles green in datagen, produces datasets lacking it,
and fails only at API boot via the conformance gate.

**CO-10 · low — The filter-selection query shape is independently declared
on both sides of the API seam.**
`FilterSelection` — de-facto query-contract vocabulary — is declared twice
with identical shape (`apps/api/src/datasource.ts`,
`apps/web/src/lib/api/selection.ts`). Harmless today; a candidate for the
contract package if it ever gains normalization semantics. (Related: the
API's public entrypoint re-exports `matchesFilterSelection` explicitly
"for property-based tests.")

**CO-12 · low — `HousingUnitsSource` advertises a per-source
`filterSchema` the matcher ignores.**
The seam interface exposes `filterSchema` as source-owned state, but
matching iterates the module-level pinned `UNIT_FILTERS`; the factory
hardwires the two together, so they cannot diverge today — latent, not
live. Worth aligning when the seam is first actually swapped or extended.

### Axis 5 — Readability

**CO-7 · low — Dead abstraction surfaces: one zero-caller factory and one
unused barrel.**
`pinSourceDefinition()` in `apps/web/src/lib/map/map-config.ts` has no
callers (MapView inlines its `addSource`), and the bare `#lib` barrel
(`apps/web/src/lib/index.ts`) is imported by nothing — all real imports
use `#lib/…` subpaths.

**CO-8 · low — `lib/layout/` and `lib/i18n/` are directories whose only
content is a test pinning code that lives elsewhere.**
A new maintainer following directory names to find layout or i18n code
finds only tests that read other files' source text. The tests themselves
do real work; the placement misleads.

**CO-9 · low — The shared test builders carry ~200 lines of mechanical
per-field delegation that scales linearly (×4) with each new policy field.**
Every program policy field has a `withX`/`withUnknownX` pair on
`ProgramBuilder` _and_ a mirrored pair on `UnitCardBuilder`
(`packages/shared/src/testing/index.ts`); forgetting a delegation pair
fails silently — the fluent form is simply unavailable.

**CO-11 · low — Cohesive but outsized modules concentrate several
separable responsibilities each; API test placement is split across two
conventions.**
`tools/datagen/src/generate.ts` (776 lines: weight tables + geography
sampling + street numbering + assembly), `MapView.svelte` (475 lines: GL
wiring + hover-intent state machine + dismissal + sr-pin list),
`map-config.ts` (411 lines incl. a procedural bitmap renderer),
`datasource.ts` (298 lines: seam interface + filter algebra + three boot
integrity asserts + file loading). All well-bannered; nothing blocks
evolvability. Tests live in both `apps/api/src/*.test.ts` and
`apps/api/test/`.

### Axis 6 — Flexibility while stable

**CO-3 · medium — The load-bearing synthetic-disclosure sentence is
maintained in four independent copies with only a partial runtime guard.**
The provenance sentence that `packages/shared/src/envelopes.ts` says is
carried "verbatim from the dataset" exists as separate constants in
datagen (`generate.ts`), the API (`datasource.ts` boot check), and the web
catalog (`apps/web/messages/en.json`), plus the generated
`data/units.json`. Nothing guards the web copy, the web never renders the
served `disclosure` field at all (client discards it), and datagen cannot
import the API's constant (seam rules). `packages/shared` is the one
workspace all copyists may import.

**CO-4 · medium — Filter matching semantics are keyed on control type with
target-specific assumptions buried in comments.**
Same root as DM-5: `single-select` matches unknowns per the glossary,
`multi-select` does exact match with "a ward is never unknown" as a
comment; and `apps/api/src/filter-params.ts` special-cases
`target === "unit.ward"` inside a module whose header promises "Nothing
about an individual filter is hardcoded here." Shape-flexibility was
delivered; semantic-flexibility was not.

**CO-5 · medium — Taxonomy display labels live in two hand-synchronized
homes: contract data and message catalog.**
All ~26 taxonomy display strings exist both as `UNIT_FILTERS` labels in
the shared contract and as `taxonomy_*`/`detail_policy_*` keys in the web
paraglide catalog (`apps/web/src/lib/components/detail-values.ts` bridges).
Values match today; no test cross-checks the two sets, so a rewording on
either side drifts silently. This is the visible edge of the settled
schema-labels-vs-catalogs split — the overlap region is unguarded.

### Requirement-to-test cross-check (static correspondence)

| Capability requirement                 | Test evidence                                                                 | Note                            |
| -------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------- |
| Inventory hierarchy                    | `tools/datagen/src/generate.test.ts`, `packages/shared/src/unit-card.test.ts` | ownership gap DM-4              |
| Availability gating + confirmation     | `apps/api/test/datasource.test.ts`, `apps/api/test/units.test.ts`             | covered                         |
| Unknown representation + honest detail | `entities.test.ts`, `units.properties.test.ts`, `DetailSlideOver.test.ts`     | strong across layers            |
| Versioned, city-agnostic evolution     | `entities.test.ts`, `unit-card.test.ts`                                       | enum gap DM-2; portability DM-1 |
| Synthetic geography/provenance         | `generate.test.ts`, `datasource.test.ts`                                      | covered                         |
| Bedrooms agree with room type          | `generate.test.ts` (specification-based pairs)                                | covered                         |
| Dynamic schema rendering + controls    | `FilterBar.test.ts`                                                           | covered                         |
| Removed filter loses selection         | `housing-store.test.ts`                                                       | covered                         |
| Map/card synchronization               | `apps/web/e2e/steps/filter.steps.ts`                                          | identity proof weak — DM-10     |
| Removable chips + clear-all            | `ActiveChips.test.ts`                                                         | covered                         |
| Zero-results recovery                  | `filter.steps.ts`, `UnitCardList.test.ts`                                     | covered                         |
| Phone-width list-first form            | `apps/web/e2e/mobile.spec.ts`                                                 | contradicts spec — DM-12        |

### Language trace (glossary ↔ spec ↔ code ↔ tests)

Nine terms traced end-to-end; meaning holds for Provider, Program, Unit,
availability state, confirmation flag, verification badge, Ward (within
DC), filter schema/control type, and unknown state. The drifts found are
the ownership wording (DM-6), the unverified/confirmed wording (DM-7),
and the Unit/UnitCard fixture conflation (DM-8).

## Settled-decision tensions (notes, not overturn requests)

- **Schema version 0.2 reset stands.** DM-2 concerns enum evolution, not
  the reset.
- **Unknown-honesty semantics stand.** DM-5/CO-4 identify where future
  control reuse could fail to preserve them.
- **Filter-as-data stands.** DM-3/CO-4/CO-12 identify residual frontend
  and control-branch coupling that limits the promise.
- **The flattened UnitCard stands.** DM-4 concerns ownership validation
  before projection, not the response shape.
- **Schema-labels-vs-catalogs split stands** (labels ride the published
  schema; UI chrome rides paraglide). CO-5 notes the overlap region is
  unguarded, and that localizing filter labels is by design a contract
  change — worth stating in `docs/shared-contracts.md`.
- **Layer-workspace seam rules stand.** They (correctly) make
  cross-workspace single-sourcing impossible outside `packages/shared`,
  which is where CO-3's and CO-6's shared constants belong.

## Disposition table

| Finding | Signal | Disposition                                                                                                                                                    |
| ------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DM-1    | high   | follow-up: `jurisdiction-extension-points` — full contract work confirmed (product decision 2026-11-06)                                                        |
| DM-2    | high   | follow-up: `consumer-enum-tolerance` — full tolerance work confirmed (product decision 2026-11-06)                                                             |
| DM-3    | high   | follow-up: `filter-target-semantics` — frontend decoupling confirmed (product decision 2026-11-06)                                                             |
| DM-4    | high   | follow-up: `dataset-integrity`                                                                                                                                 |
| DM-5    | high   | follow-up: `filter-target-semantics` (same root as CO-4)                                                                                                       |
| DM-6    | medium | fold: documentation review (glossary-vs-code drift is its core surface)                                                                                        |
| DM-7    | medium | fold: documentation review (wording drift; note the fix touches schema description strings)                                                                    |
| DM-8    | medium | follow-up: `test-builder-vocabulary`                                                                                                                           |
| DM-9    | medium | follow-up: `filter-target-semantics` (write the AND/OR algebra into the API capability)                                                                        |
| DM-10   | medium | follow-up: `test-assertion-strength`                                                                                                                           |
| DM-11   | medium | follow-up: `test-assertion-strength`                                                                                                                           |
| DM-12   | medium | follow-up: `mobile-initial-tab` — map-first confirmed intended (product decision 2026-11-06); the spec is updated to match shipped behavior, app and e2e stand |
| CO-1    | high   | follow-up: `dataset-seam-rule` — split out to land pre-push (product decision 2026-11-06); `dataset-integrity` keeps DM-4 + CO-6                               |
| CO-2    | high   | follow-up: `honest-unknown-labels` — fix the dead resolution AND reword the honest-unknown marker, pre-push priority (product decision 2026-11-06)             |
| CO-3    | medium | follow-up: `disclosure-single-source`                                                                                                                          |
| CO-4    | medium | follow-up: `filter-target-semantics`                                                                                                                           |
| CO-5    | medium | follow-up: `taxonomy-label-parity`                                                                                                                             |
| CO-6    | medium | follow-up: `dataset-integrity`                                                                                                                                 |
| CO-7    | low    | no-action: trivial dead code — delete on next touch of `map-config.ts` / `lib/index.ts`                                                                        |
| CO-8    | low    | no-action: cosmetic placement; the tests do real work                                                                                                          |
| CO-9    | low    | follow-up: `test-builder-vocabulary` (contain delegation growth)                                                                                               |
| CO-10   | low    | no-action: harmless duplication; revisit if `FilterSelection` gains semantics                                                                                  |
| CO-11   | low    | no-action: opportunistic splits listed above for next touch; nothing blocks evolvability                                                                       |
| CO-12   | low    | follow-up: `filter-target-semantics` (align matcher with the instance schema)                                                                                  |

Eleven follow-up proposals were spawned as proposal-stage OpenSpec
changes (commit `f4cb74c`), two with pre-push priority
(`dataset-seam-rule`, `honest-unknown-labels`):
`jurisdiction-extension-points`, `consumer-enum-tolerance`,
`filter-target-semantics`, `dataset-integrity`, `dataset-seam-rule`,
`honest-unknown-labels`, `disclosure-single-source`,
`taxonomy-label-parity`, `test-builder-vocabulary`,
`test-assertion-strength`, `mobile-initial-tab`. Two findings fold into
the parallel documentation review; four are recorded no-actions.

## Product-owner resolutions (2026-11-06)

Six dispositions required a product call; each was put with the evidence
and decided:

- **DM-1 — full portability work.** A second jurisdiction is a real
  requirement, not a north star: `jurisdiction-extension-points` keeps
  contract scope (an extension mechanism for jurisdiction fields), not
  just spec wording.
- **DM-2 — full tolerance work.** The consumer-tolerance promise binds:
  `consumer-enum-tolerance` designs tolerant intake, with the constraint
  that a future enum value must never render as the honest-unknown
  marker — a value newer than the consumer's vocabulary and a fact the
  source does not publish are different unknowns and must not conflate.
- **DM-3 — decouple, honor the spec.** The no-frontend-release scenario
  means what it says: the web stops validating target membership
  (shape check only); new-target filters render like any other.
- **DM-12 — map-first is intended.** The shipped map-first phone
  behavior is the truth; the list-first spec wording is what changes.
- **CO-1 — split out, land fast.** The dead dep-cruiser dataset rule is
  restored as a tiny standalone change (`dataset-seam-rule`: regex fix +
  rot-guard test) rather than riding the larger `dataset-integrity`
  proposal.
- **CO-2 — fix and reword.** The card's housing-type resolution is fixed
  (known values show their real label) AND the "Not publicly listed"
  marker itself is reworded — the phrase reads as real-estate language
  ("listed where?"). Replacement copy ("Not stated by the source",
  "Not published", …) is decided in the proposal's planning and should
  be vetted against the walkthrough audience; the reword ripples through
  spec scenarios, glossary, message catalog, and the generated
  data-model reference.
