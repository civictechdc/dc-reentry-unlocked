# Design

## Context

Motivation and capability scope are recorded in [proposal.md](proposal.md); the binding CO-2 resolution is in the archived domain review. Planning verified that `UnitCard.svelte` resolves housing type through an optional `definition`, but `UnitCardList.svelte:67` passes no definition. `detail-values.ts:73–79` already resolves known taxonomy values through localized messages and unknown values through the honest-unknown message. UnitCard already imports its bedroom formatter from that module.

This is a presentation and documentation correction within the existing web/shared/API boundaries, not a data-contract migration. The three spec deltas retain existing behavior except label resolution and quoted marker copy. Implementation must follow behavioral-sentence test names, Arrange-Act-Assert bodies, and fluent domain builders from the shared package's test-only `testing` subpath; builders must not be copied into workspaces.

## Goals / Non-Goals

### Goals

- Cards and detail use one existing taxonomy-label resolution path, with known values distinguishable from unknown values.
- Establish consistent temporary English copy across cards, detail, contacts, schema descriptions, documentation, and executable expectations.
- Preserve reproducible generated documentation and localization output.

### Non-Goals

- No filtering changes, including unknown matching or the distinct filter-side "policy not listed" marker and `apps/api/src/datasource.ts:107` comment.
- No wire-value, schema-shape, dataset, endpoint, dependency, localization-strategy, or security-posture changes.
- No taxonomy-wide redesign: `taxonomy-label-parity` remains a following change. No machine-local file edits.

## Decisions

These decisions bind implementation.

### 1. Use temporary marker copy "Unknown"

User decision 2026-11-09: both `detail_value_unknown` and `detail_contact_no_details` in `apps/web/messages/en.json` SHALL have the value "Unknown". The card example is "Housing type: Unknown"; an unknown contact remains plain text "Unknown", never a link. The domain meaning remains source information not publicly supplied, not a fabricated negative. Wire values remain unchanged.

This copy is explicitly TEMPORARY pending human walkthrough-audience vetting through `live-walkthrough-feedback`. `taxonomy-label-parity` sequences after this change and inherits this settled baseline; later audience feedback may authorize another copy revision. Provenance-naming alternatives such as "Not stated by the source" were considered, but the user chose "Unknown". Vetting is follow-up, not a blocking copy choice.

### 2. Reuse the exported detail resolver directly

UnitCard SHALL import and call `detailValueLabel` from `detail-values.ts` for housing type and any taxonomy labels it presents. Remove the unused `definition` prop and `FilterDefinition` type import. Do not add schema plumbing to UnitCardList or duplicate lookup tables. Known labels and unknown fallback then follow exactly the same path as detail.

Alternative: extract or rename a generalized presentation module. Rejected: UnitCard already uses this module, and extraction would add churn without creating a useful boundary. Update its comment to describe shared card/detail use and the new marker. This decision does not expand the card's displayed fields or change resolver fallback behavior for unsupported values.

### 3. Regenerate outputs from their authoritative inputs

Never hand-edit generated files. `apps/web/package.json` maps `build` to `vite build`; `apps/web/vite.config.ts:51–56` configures the Paraglide plugin with `outdir: ./src/lib/paraglide` and `emitTsDeclarations: true`. Therefore `pnpm -C apps/web build` is the regeneration step for message implementations and `apps/web/src/lib/paraglide/messages/_index.d.ts` after editing en.json. Retain existing generated-file tracking/ignore policy.

Upstream verification: [Paraglide compiling messages](https://github.com/opral/paraglide-js/blob/main/docs/compiling-messages.md), retrieved through Context7 during planning, documents Vite-plugin compilation and `emitTsDeclarations`. Repository scripts/configuration determine the exact command and output path; no new compiler invocation is needed.

Regenerate `docs/data-model.md` with `pnpm docgen:model`. Review the initial intended generated diff alongside the source edits. After the orchestrator commits that baseline, repeat regeneration and require `git diff --exit-code -- docs/data-model.md` to be empty. A clean diff against HEAD cannot be expected before committing the intentional reference update; do not hide it by restoring output. Repeat the web build to check localization-output stability as well.

### 4. Reword schema descriptions without changing contracts

Update the marker wording embedded in TypeBox descriptions/comments in `packages/shared/src/program.ts` and `packages/shared/src/primitives.ts`, together with the rendered-description assertion in `packages/shared/src/docgen/render.test.ts`. Descriptions flow into generated model documentation; runtime types, unknown literals, validation, serialization, and filter matching SHALL remain unchanged.

Retitle the glossary entry to **Unknown**, preserve its definition, and sweep the rest of `docs/glossary.md` for the old phrase. Reword marker-related prose and "when publicly listed" conditionals in `docs/api.md`, `docs/data-synthetic.md`, and `docs/shared-contracts.md` to describe known/source-supplied values; the same conditional reword applies to the provider contact descriptions in `packages/shared/src/provider.ts` so the generated reference stays internally consistent, and marker-derived comments (`apps/api/src/datasource.ts:96`, `apps/web/e2e/steps/filter.steps.ts:59`) use source-state language. Update affected test names, rendered-text assertions, e2e step wording, and presentation comments in the files named in tasks.md, including the committed agent-surface files (worktree `AGENTS.md`'s Unknown-honesty section, the two `.agents/skills/` files that quote the marker, and the fixed nudge strings in `scripts/agent-hooks/nudge.mjs` with their tests — a security-sensitive file, so that diff stays string-only on the fixed emitted copy and gets adversarial confirmation). This is not a blind replacement of unrelated uses of "listed".

## Risks / Trade-offs

- [Bare "Unknown" loses provenance detail compared with longer candidates] → Human walkthrough-audience vetting is already scheduled; preserve the glossary definition and record feedback before revising copy.
- [Message key names retain older contact semantics] → Keep stable identifiers; change values only. Renaming keys adds unrelated regeneration and consumer churn.
- [Passing a synthetic definition in a card test could conceal the production defect] → Render cards without that prop, including through their production list caller, and assert actual housing-type row text for known and unknown values.
- [Broad wording changes could alter filter semantics or wire unknowns] → Keep "policy not listed" untouched; review diffs for description-only shared/API edits and run existing filter regressions.
- [Generated reference changes could be mistaken for drift] → Review and commit intended output first; only then require the repeat-regeneration diff against HEAD to be empty.

## Migration Plan

1. Land card resolution with rendered-row regressions and corrected shared-presentation comments.
2. Change both catalog values; update detail/contact/e2e assertions and related comments. Run `pnpm -C apps/web build` to regenerate Paraglide output, then web tests and detail acceptance paths.
3. Reword shared descriptions, glossary, API/synthetic-data prose, and affected shared/API test names; update the docgen assertion and run `pnpm docgen:model`. Review generated documentation with its inputs and run shared/API regressions.
4. Run integration gates and perform human review of known/unknown card rows, unknown detail fields, and plain-text unknown contacts. The orchestrator owns commits and the post-commit regeneration cleanliness checks.

No data migration or compatibility rollout is required. Rollback is to revert the implementation commit(s), including source strings, tests, descriptions, and tracked generated output together; regenerate from reverted inputs to confirm consistency. Audience vetting remains a separate human follow-up, not a claim made by automated tests.
