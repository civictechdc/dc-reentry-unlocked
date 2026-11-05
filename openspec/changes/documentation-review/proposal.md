# Proposal

## Why

The repo's docs are load-bearing: README is the human front door, AGENTS.md governs every agent session, docs/ carries the run story, the API contract examples, the data policy, perf baselines, and the domain language — and the CI gates on docs implicitly (commands-must-run-as-written is the repo's own bar). Before push, a documentation review should verify the docs are accurate against the implemented reality, pitched at the right audience per surface, complete for a new contributor, consistent with the glossary and each other, and honest about freshness — with the same disposition discipline as the domain-driven review: findings recorded, no in-flight fixes.

## What Changes

- A documentation review of every committed doc surface: `README.md`, `AGENTS.md`, `docs/*` (api, runbook, shared-contracts, data-synthetic, glossary, perf-notes, architecture), the skills' doc-facing content, and doc-adjacent committed surfaces (compose header comments, workflow comments)
- A committed review document (`docs/documentation-review.md`) with evidence-backed findings and the same disposition table as the domain review: no-action (rationale) / follow-up proposal / fold into a named planned change
- Follow-up proposals spawned for accepted findings — this change reviews and records; it does not edit docs

## Capabilities

### New Capabilities

### Modified Capabilities

## Impact

- **Code:** none (review-only)
- **Docs:** `docs/documentation-review.md` (new, committed)
- **Sequencing:** after `exact-addresses-only` and `card-map-focus` land (reviews the docs in their final pre-push state); parallel with `domain-driven-review`; pre-push
