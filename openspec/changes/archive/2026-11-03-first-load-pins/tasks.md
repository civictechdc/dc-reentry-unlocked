# Tasks

## 1. Web (apps/web)

- [x] 1.1 Reproduce and diagnose the first-load pin gap: drive the mock maplibre in `MapView.test.ts` through the three interleavings (units before `load`, units after `load`, units in the style-loaded-before-load window) plus a live dev-stack check with a throttled style; record which interleaving drops the pins and why the current guard (`isStyleLoaded` + optional-chained `setData`) fails; document the confirmed mechanism in the change's design before fixing
- [x] 1.2 Fix MapView so the latest `store.units` deterministically reaches the source (the no-op window becomes impossible per the design's invariant), landing the highlight-effect `getLayer` guard in the same change if the same pattern is touched; verify the interleaving-controlled component test pins all three cases (mutation-calibrated: the old guard fails case d, the post-addSource window), the existing map/pin suites stay green, and `pnpm -C apps/web test` + root `pnpm typecheck` pass
- [x] 1.3 Verify the fix against the running stack (stale-listener hygiene first): unfiltered first load shows every available unit's pin with the full card list, repeatedly (fresh boots, hard reload, slow-network throttle); verify `pnpm -C apps/web e2e` + `e2e:bdd` + `e2e:prod` all green

## Workflow follow-up

- After all tasks complete: run code review per project policy, resolve findings, then archive this change (`openspec archive`) and verify the archived specs.
- Land BEFORE or TOGETHER WITH `card-map-focus` (shared MapView lifecycle).
