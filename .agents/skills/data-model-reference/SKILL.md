---
name: data-model-reference
description: >
  Pinned data-model contract for dc-reentry-unlocked — Provider → Program →
  Unit hierarchy, availability states, unknown semantics, and the 11-filter
  set. Use whenever building or changing schemas, filters, inventory, API
  responses, or detail views in this repo.
---

# Data-model reference — dc-reentry-unlocked

Sourced from the capability specs in the in-repo OpenSpec planning
workspace (`openspec/`). The
TypeBox schemas in `packages/shared` are the contract's source of truth
and their tests assert the full filter set described here; this skill is
the pinned orientation reference. For the systematic field-by-field
reference — every schema's field table, enum values with their meanings,
constraints, and worked examples — see `docs/data-model.md`, which is
generated from those schemas (`pnpm docgen:model`).

## Three-layer hierarchy

Provider (contact-bearing organization) → Program (policy-bearing housing
program) → Unit (individually displayable housing unit). Every unit belongs
to exactly one program; every program to exactly one provider. A unit card's
program policy fields and provider contact fields are reachable from the unit
without further lookups.

## Availability semantics

Two distinct concepts:

1. **Availability state** per unit: `available` / `not available` /
   `unverified-availability`. Only `available` units appear in API listings,
   map pins, and card lists — unavailable and unverified are hidden.
2. **Confirmation flag** for available units: whether availability was
   confirmed with the source. Available-but-unconfirmed units still appear,
   carrying the confirmed-vs-needs-verification distinction as a displayable
   badge field (**verification badge**).

## Unknown state (never fabricate)

Every policy/eligibility field supports an **unknown** state meaning "not
publicly listed" — distinct from yes and no:

- Detail views render it honestly as "not publicly listed", never a
  fabricated yes/no (the unknown-vs-"policy not listed"-marker distinction:
  the marker travels on filtered enum results; the detail view always shows
  the honest unknown).
- Boolean filters match unknown values against "no" selections.
- Enum filters match unknown values against every value selection, carrying
  a "policy not listed" marker on results so users know to confirm.

## Versioned, city-agnostic model

The model is versioned and additive-tolerant: new fields and enum values are
ignorable by existing consumers; breaking changes are versioned, and unit
cards and API envelopes carry `schemaVersion` `"2.0"`. Every unit and card
carries required, non-null coordinates — exact street addresses only. Ward
and quadrant are core (required DC fields for this prototype); future
jurisdiction-specific concepts land as additive extension fields, not
required core changes.

## The 11 filters (pinned contract — the schema's tests assert this set)

Control vocabulary is exactly **boolean, single-select, multi-select**
(schema-driven; renderers are generic, no filter hardcoded in the frontend;
unsupported control types degrade gracefully, never crash).

**4 single-select enum filters** (taxonomies exactly as pinned by the
schema contract):

- **Housing type**: emergency shelter, transitional, permanent supportive
  housing, subsidized rental, market-rate.
- **Length of stay**: emergency/nightly, short-term ≤ 90 days, transitional
  up to 24 months, permanent/open-ended.
- **Population**: individuals, families, both.
- **Gender**: men, women, all.

**1 multi-select filter**: **Ward** — the 8 DC wards.

**6 boolean policy filters**: **referral required, sobriety, background
check, sex-offense restrictions, treatment, housing vouchers**.

## Data provenance

Synthetic only: fictional providers, generated building numbers sampled from
plausible per-street ranges, coordinates on real street geometry within the
real ward — never copied from any real listing or address source. Every ward
1–8 contains units.

## Rule of thumb

If a change bends any semantics above (new availability state, new control
type, filter set change), it belongs in an OpenSpec change — not a drive-by
edit. See `docs/glossary.md` for the canonical word definitions.
