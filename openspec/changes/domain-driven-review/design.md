# Design

## Context

The review targets a codebase whose structure was itself a design decision: layer workspaces (apps/web, apps/api, packages/shared, tools/datagen) with capability-aligned internal modules, executable seams (dependency-cruiser rules), a shared TypeBox contract as the stable boundary, a documented ubiquitous language (`docs/glossary.md` ↔ the main specs ↔ code identifiers), and a test-style doctrine (behavioral names, domain-language bodies, shared builders). The review verifies reality against those intentions — and judges whether the intentions themselves were right.

## Goals / Non-Goals

**Goals:**
- Six axes reviewed with evidence (file/module/spec citations), not impressions
- Every finding dispositioned: no-action with rationale, or a follow-up change proposal
- The review document readable by a future maintainer who wasn't present

**Non-Goals:**
- No code changes in this change — accepted findings spawn separate changes
- Not a security/performance audit (those ran per-block; this is the domain/design lens)
- Not a re-litigation of settled user decisions (recorded decisions stand; the review may note tensions it finds, not overturn them)

## Decisions

**D1 — Review method: two commissioned reviewers, one synthesis.** The orchestrator commissions (a) a domain/modelling reviewer over the specs + glossary + shared contract + test suite (feature definitions, modelling, ubiquitous-language consistency, test appropriateness) and (b) a code-organization reviewer over the four workspaces (seams, module placement, readability, flexibility/stability). Both produce evidence-backed findings; the orchestrator synthesizes into the document. Same separation-of-powers as every block review — no self-review.

**D2 — The six axes, concretely.**
1. *Feature definitions* — each capability spec (housing-inventory, -api, dynamic-filtering, housing-search-ui, walkthrough-feedback when landed) is cohesive, bounded, and independently evolvable; requirements read as domain behavior, not implementation
2. *Modelling* — the Provider→Program→Unit model, availability/confirmation distinction, unknown states, the flattened UnitCard read model, filter-as-data: right calls? Any misaligned aggregates, anemic/hostile models, or language drift (glossary ↔ spec ↔ code identifier mismatches)
3. *Test appropriateness* — tests pin domain behavior (the doctrine held?); any suite testing implementation details, or domain rules uncovered
4. *Organization by feature seams* — do the dep-cruiser seams match the actual feature boundaries; domain logic in components or UI concerns in state; module placement honesty
5. *Readability* — naming against the ubiquitous language, module sizes, cohesion; a new-maintainer comprehension pass
6. *Flexibility while stable* — flexibility lives where change is expected (filter definitions as data, DataSource swap, additive contract, message catalogs); stability where it matters (contract, seams); flag speculative flexibility (over-engineering) and hardcoded-that-should-be-data

**D3 — Disposition policy.** Each finding gets one of: **no-action** (with rationale — includes "settled user decision, tension noted"), **follow-up proposal** (a named, scoped future change), or **fold into a planned change** (if an already-planned change's scope naturally covers it — cite which task). The document records the disposition table; the orchestrator spawns the accepted follow-up proposals after user review of the document.

## Risks / Trade-offs

- [Review drift into re-architecture] — the disposition policy caps it: findings are recorded and dispositioned, not acted on in-flight
- [Subjectivity] — mitigated by the evidence requirement (citations per finding) and the two-reviewer split
