# Design

## Context

Same review method as the domain-driven review (commissioned reviewers, evidence-backed findings, disposition table, no in-flight fixes) applied to the documentation surfaces. The repo's docs doctrine is already established: README is the concise human front door (quickstart, navigation, tests), AGENTS.md is the agent standard, `docs/` carries depth, machine-local content stays out, and every documented command must run as written.

## Goals / Non-Goals

**Goals:**
- Five axes reviewed with evidence (per-doc citations and executed-command transcripts where accuracy is claimed)
- Every finding dispositioned (no-action / follow-up proposal / fold into a planned change)
- The review document useful to a maintainer deciding what doc work actually matters

**Non-Goals:**
- No doc edits in this change — accepted findings spawn separate changes or fold into planned ones
- Not a copy-editing pass (style nits only where they impair comprehension)
- Not reviewing the openspec workspace's internal artifacts (they follow the openspec tooling's own conventions)

## Decisions

**D1 — The five axes, concretely.**
1. *Accuracy* — every documented command and example runs as written (execute them; capture transcripts); docs match implemented behavior: endpoints and fields vs the served OpenAPI, runbook steps vs the actual compose/dev story, shared-contracts examples vs the v2 contract, data-synthetic vs the generator, perf-notes numbers vs current measurements, glossary terms vs the post-change domain language
2. *Audience altitude* — each surface pitched right: README stays quickstart-concise, AGENTS.md stays agent-operational, docs/ carries depth; no content duplicated across surfaces that should be a cross-link (single source of truth — command lists and env tables are the classic drift points)
3. *Completeness* — the new-contributor path (clone → orient → run → test → change → contribute) has no holes; anything stale or obsolete is a deletion finding
4. *Consistency* — terminology matches the glossary; cross-links resolve (including deep anchors); fence/formatting integrity (the quad-fence class of bug); the no-openspec-internal-refs hygiene rule holds across all doc surfaces
5. *Freshness* — "planned, not yet landed" marks vs landed reality; version/pin references current; the architecture diagram matches the actual seams post-changes

**D2 — One commissioned reviewer, orchestrator synthesis.** A single documentation reviewer with the five-axis brief (the surfaces are cohesive enough for one pass; the orchestrator synthesizes and applies the disposition policy). Evidence requirement identical to the domain review: citations per finding, executed transcripts for accuracy claims.

**D3 — Disposition policy (shared with the domain review).** no-action (rationale) / follow-up proposal (named, scoped, citing this document) / fold into a planned change (cite the task). User reviews the document and dispositions before commit.

## Risks / Trade-offs

- [Transcript-heavy verification] — accuracy checks execute real commands (dev boots, curls, compose); bounded by reusing the runbook's own steps as the checklist — the docs' claims are the test plan
- [Doc-review scope creep into the domain review's axes] — modelling/language findings belong to the domain review; this review touches language only where a DOC contradicts the glossary
