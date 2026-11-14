# Tasks

## 1. E2e identity proof (DM-10)

- [ ] 1.1 Add `data-unit-id={card.id}` to the UnitCard article (mirroring the pin-list buttons' hook) and verify the web component tests plus `pnpm -C apps/web test` still pass
- [ ] 1.2 Strengthen the golden-path step in `apps/web/e2e/steps/filter.steps.ts` to compare sorted unit-id sets three ways — API `units[].id`, rendered card `data-unit-id` values, rendered pin-list `data-unit-id` values — keeping the `.result-count` synchronization gate, count checks, and ward-text check as supporting assertions, and verify `pnpm -C apps/web e2e:bdd` passes against the self-booted dev servers (kill stray servers first per runbook lesson)

## 2. Store concurrency proof (DM-11)

- [ ] 2.1 Rebuild `rapid selection changes do not interleave stale responses` in `apps/web/src/lib/state/housing-store.test.ts` on a deferred-promise transport: ward-1 payload resolving while a ward-2 selection coalesces, stale-first resolution order, interim `loading` phase observed, final `units` deep-equal to the ward-2 payload and `phase` `ready`, and verify `pnpm -C apps/web test` passes
- [ ] 2.2 Upgrade `apps/web/src/lib/state/housing-store.prop.test.ts` to a path-deterministic payload transport with a post-run `await store.refresh()` quiescence flush, asserting the final `lastPath` equals the model's final expected path exactly and `store.units` deep-equals that path's payload, and verify the property suite passes (`pnpm -C apps/web test`)

## 3. Integration gates

- [ ] 3.1 From the worktree root run `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm typecheck`, `pnpm arch:check`, and `openspec validate --all --strict`, and confirm all green

## Workflow follow-up

- Review gates before commit: code review, security review, adversarial review (orchestrator-run; implementers never commit).
- Archive the change with `/opsx-archive` after reviews pass and the user confirms.
