# Tasks

## 1. Flag registry and override module

- [x] 1.1 Create `apps/web/src/lib/flags/registry.ts` (flag-name tuple + `FeatureFlag` type, empty to start) and `apps/web/src/lib/flags/index.ts` with the dev-only `?flags=` override parser (unknown names dropped, empty value enables nothing, non-dev is a dead branch) per design D1/D2; export the env-key and define-key derivations as pure functions; verify unit tests cover: unknown name ignored, empty value, comma list membership, non-dev dead branch
- [x] 1.2 Add TypeScript declarations for the `__FLAG_*__` define globals beside the registry so unregistered names fail `pnpm typecheck`; verify referencing a fabricated flag name in a scratch check fails to compile, then remove the scratch check

## 2. Vite wiring

- [x] 2.1 Wire the registry into `apps/web/vite.config.ts`: a pure `buildFlagDefines(env)` (unit-tested: `"1"` → true, unset/garbage → false, one define entry per registry name in `__FLAG_<SCREAMING_SNAKE>__` form) feeding vite `define`, so `VITE_FEATURE_<NAME>=1 pnpm -C apps/web dev` sets session flag defaults; verify `pnpm -C apps/web dev` boots and `VITE_FEATURE_…=1` flips a temporary probe read via the guard shape, then remove the probe
- [x] 2.2 Document the mechanism for riders in the flags module docs: the exact blessed guard shape from design D3 with the two elimination anchors, the command-time env surface, and the `?flags=` override; verify the snippet type-checks as written in the docs
- [x] 2.3 Fold the CSP `allowInlineScripts` gate onto the same dev-server predicate as the flags (design D5, user-approved scope add): replace the `NODE_ENV`-derived check in `apps/web/vite.config.ts` with the shared `serve`+`development` predicate so no self-built bundle ships CSP `unsafe-inline`; verify `pnpm -C apps/web e2e:prod` still passes (it asserts the preview CSP headers)

## 3. Runbook note

- [x] 3.1 Add the dev-flag note to `docs/runbook.md` (dev-boot section): how to launch with flags, override per load with `?flags=`, that non-dev builds have no flag surface, and that graduating a feature removes its flag from the registry; verify the documented commands run as written

## 4. Verification

- [x] 4.1 Run the full gate from the worktree root: `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm typecheck`, `pnpm arch:check`, and `openspec validate feature-flags --strict`; verify all green before reporting done

## Workflow follow-up

- After all tasks complete: code review per project policy, then the
  first rider (`walkthrough-quick-wins`) lands the build-output scan
  promised in design D4.
