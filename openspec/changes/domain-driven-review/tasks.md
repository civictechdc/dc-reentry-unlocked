# Tasks

## 1. Domain-driven review

- [x] 1.1 Commission the two-part review (after `exact-addresses-only` and `card-map-focus` land): the domain/modelling reviewer over the capability specs, glossary, shared contract, and test suites (feature-definition cohesion, modelling choices, ubiquitous-language consistency, test appropriateness — domain behavior vs implementation detail) and the code-organization reviewer over the four workspaces (feature-seam alignment vs the dep-cruiser rules, module placement, readability against the ubiquitous language, flexibility/stability balance — speculative flexibility and hardcoded-that-should-be-data flagged); verify every finding arrives evidence-backed with file/module/spec citations
- [x] 1.2 Synthesize both reviews into `docs/domain-review.md`: the six axes, findings with evidence, and the disposition table (no-action with rationale / follow-up proposal / fold into a named planned change); verify the user reviews the document and its dispositions before commit
- [x] 1.3 Spawn the accepted follow-up change proposals (named, scoped, citing the review document) and record any tensions with settled decisions as notes rather than overturning them; verify `openspec validate --all --strict` stays green with the new proposals planned

## Workflow follow-up

- After all tasks complete: code review per project policy (the review document itself), then archive this change (`openspec archive`) and verify the archived state.
