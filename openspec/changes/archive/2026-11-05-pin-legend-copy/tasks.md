# Tasks

## 1. Web (apps/web)

- [x] 1.1 Rename the legend message key (`map_legend_exact` → `map_legend_unit`) with the value "Available unit" in every locale, update the MapView reference and the legend component test's vocabulary; verify the i18n audit stays green (no dead keys — the old key fully removed), the single-entry legend shape stays pinned, and `pnpm -C apps/web test` + root `pnpm typecheck` pass

## Workflow follow-up

- After all tasks complete: run code review per project policy, resolve findings, then archive this change (`openspec archive`) and verify the archived specs.
