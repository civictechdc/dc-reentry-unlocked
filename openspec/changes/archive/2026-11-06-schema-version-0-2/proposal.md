# Proposal

## Why

The contract carries `SCHEMA_VERSION "2.0"`, but the data model is still being
confirmed — a 2.x number implies a stability the contract has not earned and
invites consumers to treat minor bumps as safe. Pre-1 versioning (0.x) says
what is actually true: breaking changes may land between minors until the
model is confirmed (user decision 2026-11-06).

## What Changes

- **BREAKING** (version identifier only): `SCHEMA_VERSION` `"2.0"` → `"0.2"`
  — carried by unit cards and every API envelope. Two-segment format
  unchanged; exact-match `Type.Literal` consumers unaffected structurally.
  No other schema shape changes.
- Dataset example annotations reference `SCHEMA_VERSION` instead of the
  `"2.0"` literal, so they cannot drift from the constant.
- Frozen dataset renamed `data/units.v2.json` → `data/units.json` and
  regenerated (it embeds the version). Version branding leaves the filename:
  with 0.x the major stays 0 across breaking minors, so a versioned name
  would churn file+loader+Dockerfile+docs on every bump — and the API's
  dataset loader already throws on any content-version mismatch at boot.
- Version-history prose reworded to date-based provenance ("the 2026-10-31
  revision") instead of naming the old version number.
- Generated `docs/data-model.md` regenerated (renders the new version).

## Capabilities

### New Capabilities

### Modified Capabilities

(skip_specs: no capability spec pins the version value — the versioning RULE
is unchanged and still followed; this is a value swap plus mechanical
follow-through, same skip pattern as the repo's tooling/docs changes.)

## Impact

- **Code:** `packages/shared` (constant + two example annotations + test
  literals), `tools/datagen` (output filename + comments), `apps/api`
  (dataset loader path + test literals + Dockerfile COPY), `data/` (rename +
  regenerate), `docs/` (shared-contracts, api, runbook, data-synthetic,
  architecture, generated data-model), `.agents/skills/data-model-reference`
  (one line), `AGENTS.md` (one line)
- **APIs / Dependencies:** none — the literal's value changes, its type and
  every schema shape stay identical
- **Sequencing:** independent; lands before the planned documentation review
  so that review reads the pre-1 state

## Non-goals

- No schema shape changes, no field/enum changes, no confirmation decision —
  the exit criterion (bump to 1.x) happens when the data model is confirmed,
  as its own change
