# Tasks

## 1. Web (apps/web)

- [x] 1.1 Compact the desktop chrome: FilterBar density (paddings/gaps 0.375rem-class, control typography to 0.8rem — no controls removed), layout `gap`/`padding` 0.75rem → 0.5rem, height calc `100vh - 9.5rem` → `100vh - 8.25rem`; add the density pins to `desktop-grid.test.ts` while keeping every structural invariant; verify live against the dev server at 1440×900 (filter bar compacted to ≈ 90–95px) and 1440×660 (map clamps, no whole-page scroll), then `pnpm -C apps/web test` + root `pnpm typecheck`
- [x] 1.2 Relax the desktop map cap to 3:2 (`calc(100cqh * 4 / 3)` → `calc(100cqh * 3 / 2)` in `+page.svelte`, pane-scoped) and move the cap pins in `desktop-grid.test.ts`; verify live at 1920×1080 the map renders ≈ 3:2 height-bound (roughly 1218×812, small side margins) and at 1440×900 ≈ 904×651 with no map-pane overflow; run `pnpm -C apps/web test`, root `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `openspec validate desktop-map-size --strict`

## Workflow follow-up

- After all tasks complete: run code review per project policy, resolve findings, then archive this change (`openspec archive`) and verify the archived specs.
