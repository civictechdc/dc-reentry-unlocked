# Proposal

## Why

The prototype is feature-complete and about to be pushed. Before broader exposure, a domain-driven review should verify the quality dimensions that determine whether the codebase stays evolvable: are the feature definitions (the capability specs) clear and cohesive, is the domain modelling right, do tests test domain behavior, is the code organized by feature seams, is it readable, and is the flexibility/stability balance appropriate — flexible where change is expected (filters as data, the DataSource seam, additive contracts), stable where it matters (the contract, the seams). Findings become either documented no-actions (with rationale) or follow-up change proposals.

## What Changes

- A domain-driven review of the finished codebase across six axes: feature definitions (capability cohesion, bounded clarity), domain modelling (the ubiquitous language and model choices), test appropriateness (domain behavior vs implementation detail), code organization by feature seams, readability, and the flexibility/stability balance
- A committed review document (`docs/domain-review.md`) with evidence-backed findings and a disposition per finding: no-action (rationale) or follow-up change proposal
- Follow-up change proposals spawned for accepted findings — this change reviews and records; it does not fix code

## Capabilities

### New Capabilities

### Modified Capabilities

## Impact

- **Code:** none (review-only; findings spawn separate changes)
- **Docs:** `docs/domain-review.md` (new, committed)
- **Sequencing:** after `exact-addresses-only` and `card-map-focus` land (reviews the complete picture), before or alongside the `live-walkthrough-feedback` session; pre-push
