# Design

## Context

`locationPrecision` (exact/approximate) lives in `packages/shared` (Unit + UnitCard, nullable coordinates), `tools/datagen` (~19.6% approximate units placed at ward anchors), `apps/web` (ward-anchors.ts, dashed pin style, legend entry, detail qualifier, message keys), and the main specs. The served card field list includes location precision. No external consumers exist; the prototype is pre-push. The `card-map-focus` change (planned, unimplemented) references ward-anchor focus.

## Goals / Non-Goals

**Goals:**
- Exact addresses only: `locationPrecision` removed, coordinates required everywhere, one positive spec statement per level (model, served card)
- Breaking change handled per the stable-contract rule: versioned (schemaVersion 2.0), no consumer migration needed (none exist)
- Clean removal — no dead code, styles, message keys, or doc references left behind

**Non-Goals:**
- No change to ward/quadrant fields, the ward filter, availability semantics, or unknown-policy honesty — untouched
- No dormant "precision-ready" plumbing kept — the removal is complete; reintroduction is a future additive change if real data demands it

## Decisions

**D1 — Full concept removal (user decision 2026-10-31).** Alternative considered: keep the capability in the contract, generate no approximate units (dormant). Rejected — the user asked for the concept gone; dormant plumbing would leave dead UI (legend, styles) and schema surface that contradicts "only exact addresses for now." Reversibility: a future change reintroduces precision additively (optional field defaulting to exact + schemaVersion bump) — recorded in the spec delta's migration note.

**D2 — Contract versioning: SCHEMA_VERSION 1.0 → 2.0 and `data/units.v2.json`.** Removing a field and tightening coordinates to required is breaking; the stable-contract rule says breaking changes are versioned. The dataset file version follows the record shape (v1 file deleted, v2 written); the API loader's version assert and the Dockerfile's dataset COPY path update. No external consumers exist, so the bump is prophylactic compliance — cheap now, correct forever.

**D3 — Datagen goes exact-only, and bedrooms become coherent with room type** (user decision 2026-10-31). The approximate distribution branch is removed; every unit derives from a real street piece with interpolated coordinates (the corpus already supports full exact generation — the strict-inside/on-street/one-ZIP invariants apply to 100% of units now). The both-precisions-per-ward invariant is dropped; ward coverage 1–8 stays. Bedrooms correlation (apartment ≥ 1, efficiency 0, private-room 1, shared-room 0) replaces the independent sampling — the 94 incoherent 0BR "apartments" die here; zero-bedroom efficiencies stay (they are the studio/SRO inventory). New frozen dataset (same fixed seed discipline — the seed stays 20261029; the output differs because the generator's distributions changed), byte-identical regeneration re-proven, new SHA recorded in docs.

**D3a — "Studio" is a presentation vocabulary change, not a data change.** Bedrooms stay 0 in the data and contract; the web maps zero-bedroom + efficiency to the "Studio" message key on the card and detail (the industry-standard presentation of 0BR). Other zero-bedroom pairs keep their numeric presentation (shared-room 0BR renders as "0 bedrooms" — a bed in a shared room is honestly zero-own-bedrooms; relabeling those would fabricate an apartment-ish identity the unit doesn't have).

**D4 — Web removals are deletions, not toggles.** `src/lib/map/ward-anchors.ts` deleted; `unitsToFeatureCollection` loses the anchor fallback and the `approximate` property; the dashed pin style, legend entry, detail qualifier, and their message keys are removed (i18n audit must stay green — dead keys fail it); component/e2e tests that pinned approximate behavior are updated to pin its absence where that's the honest inverse (e.g. legend has no approximate entry) and deleted where the behavior simply no longer exists.

**D5 — Builders lose their approximate knobs.** `aUnit()` emits exact coordinates by default; `withApproximateLocation()` and any precision-flipping methods are removed. Tests that arranged approximate units are re-pointed at exact fixtures or removed with the behavior.

**D6 — Sequencing with `card-map-focus`.** This change implements FIRST; `card-map-focus` (amended to exact-only) follows. Its focus logic then has exactly one coordinate source — the unit's own — with no anchor case.

## Risks / Trade-offs

- [Breadth] The removal touches four workspaces + docs + the skill; mitigated by the repo's gates (arch rules, i18n audit, e2e, determinism diff) which mechanically catch leftovers.
- [Real-data readiness] A future ingestion pipeline receiving ward-only units will need the reintroduction change — recorded in the spec migration note; acceptable per the user's "for now."
- [Dataset churn] A new frozen file invalidates perf-notes' per-1,000 measurements' unit mix (slightly larger payload — no approximate units means all cards carry coordinates); re-measure and record.
