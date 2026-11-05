# Tasks

## 1. Web (apps/web)

- [x] 1.1 Responsive survey + preferred-layout confirmation: on the running stack (stale-listener hygiene first), render each size class — phone, narrow tablet, wide tablet, narrow laptop, maximized desktop — recording today's behavior (layout form, map proportions, visible-card count, any broken intermediate states); propose a preferred layout per size class and confirm the set WITH the user; write the confirmed set into this change's spec delta before any mid-width implementation
- [x] 1.2 Implement the confirmed layouts per the design (aspect-capped, square-ish map pane on desktop; list window gains usable height/width; row stays viewport-height so the page does not scroll whole; mobile per the confirmed preference); verify component tests pin the proportion rules structurally, and `pnpm -C apps/web test` + root `pnpm typecheck` pass
- [x] 1.3 Verify live on the running stack: every confirmed size class renders its preferred form (mobile included), maximized desktop shows a square-ish map with several cards visible unscrolled (around 5+, count confirmed with the user), wide/short viewport shapes do not overflow, and `pnpm -C apps/web e2e` + `e2e:bdd` + `e2e:prod` all green
- [x] 1.4 Desktop map pane: increase the map's height to bring the pane closer to square (user directive 2026-11-05). Measured baseline on the dev stack: the `.map-canvas` box renders 828×384 (ratio 2.16) at 1280×720, 1060×564 (1.88) at 1512×982, 1468×704 (2.09) at 1920×1080 — all wide rectangles. Also fix the overflow observed at short viewports: the canvas's `min-height: 24rem` (384px) exceeds its own section row (339px at 1280×720), so the pane overflows its grid row instead of clamping. The final target ratio is confirmed with the user inside this change's survey task before implementation lands; the pane must stay viewport-bounded (no whole-page scroll, per this change's row constraint)

## Workflow follow-up

- After all tasks complete: run code review per project policy, resolve findings, then archive this change (`openspec archive`) and verify the archived specs.
