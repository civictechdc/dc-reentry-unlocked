# Tasks

## 1. Web (apps/web)

- [ ] 1.1 Implement the desktop proportions fix in `apps/web/src/routes/+page.svelte` per the design (aspect-capped, square-ish map pane; list window gains usable height/width; row stays viewport-height so the page does not scroll whole; mobile untouched); verify component tests pin the proportion rules structurally, and `pnpm -C apps/web test` + root `pnpm typecheck` pass
- [ ] 1.2 Verify live on the running stack (stale-listener hygiene first): maximized desktop viewport shows a square-ish map (no ~2:1 strip) with several cards visible unscrolled (around 5+, count confirmed with the user), wide/short viewport shapes do not overflow, and `pnpm -C apps/web e2e` + `e2e:bdd` + `e2e:prod` all green

## Workflow follow-up

- After all tasks complete: run code review per project policy, resolve findings, then archive this change (`openspec archive`) and verify the archived specs.
