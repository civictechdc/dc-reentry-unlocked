# Tasks

## 1. Web (apps/web)

- [ ] 1.1 Add the document-level off-map click dismissal to MapView (bubble-phase listener; exclusions `.map-view`, `.list-pane`, `.detail`, `.mobile-bar`; clear `hoveredCardUnitId`/`hoveredPinUnitId`/`selectedUnitId`; clear `detailTriggerElement` before the selection so the close edge skips focus restoration) and the component tests: dismiss on filter-bar/background click, keep-alive on list card / detail panel / tab bar clicks, focus stays on the clicked control, existing dismissal state machine + property suite green; run `pnpm -C apps/web test`, root `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `openspec validate off-map-click-dismiss --strict`

## Workflow follow-up

- After all tasks complete: run code review per project policy, resolve findings, then archive this change (`openspec archive`) and verify the archived specs.
