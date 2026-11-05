# Tasks

## 1. Documentation review

- [ ] 1.1 Commission the documentation review (after `exact-addresses-only` and `card-map-focus` land, parallel with the domain-driven review): one reviewer over every committed doc surface (README, AGENTS.md, docs/*, skills' doc-facing content, compose/workflow comments) across the five axes — accuracy (execute every documented command/example; docs vs implemented behavior), audience altitude (no duplication that should be a cross-link), completeness (the new-contributor path; stale content), consistency (glossary terminology, resolving links, fence integrity, the no-internal-refs hygiene rule), freshness (planned-vs-landed marks, pins, the architecture diagram vs actual seams); verify every finding arrives evidence-backed with citations and transcripts
- [ ] 1.2 Synthesize into `docs/documentation-review.md`: the five axes, findings with evidence, the disposition table (no-action with rationale / follow-up proposal / fold into a named planned change — same policy as the domain review); verify the user reviews the document and its dispositions before commit
- [ ] 1.3 Spawn the accepted follow-up change proposals (named, scoped, citing the review document) or fold findings into named planned changes; verify `openspec validate --all --strict` stays green with the new proposals planned

## Workflow follow-up

- After all tasks complete: code review per project policy (the review document itself), then archive this change (`openspec archive`) and verify the archived state.
