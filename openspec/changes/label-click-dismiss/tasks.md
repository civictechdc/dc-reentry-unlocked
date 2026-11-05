# Tasks

## 1. Web (apps/web)

- [ ] 1.1 Implement the click-off dismissal in `MapView.svelte`: a map-wide click handler that clears `hoveredCardUnitId`, `hoveredPinUnitId`, and `selectedUnitId` ONLY when no pin feature is hit at the click point (pin hits keep the existing layer-handler path; clicks pass through the label bubble to the pin beneath — prototype-verified), relying on MapLibre's native click-after-drag suppression for panning safety (add an explicit drag guard only if the e2e drag tests falsify it); cover with jsdom tests — click-off clears all three ids and the label filter goes no-match, pin hit does not clear, drag sequence does not clear
- [ ] 1.2 Clear the stale pin-hover id on non-pin selections (card click, keyboard card activation, keyboard pin-button activation paths clear `hoveredPinUnitId`; canvas pin click keeps setting both) and cover with the precedence test: pin A clicked, card B selected, hover on/off card C — the label returns to the selected unit B, never to A
- [ ] 1.3 Prove in a real browser: click-off dismisses label + detail on desktop, tap-off dismisses on the phone viewport, click-drag and tap-drag pans never dismiss, and the pin A → card B → hover-off precedence holds; `pnpm -C apps/web e2e` + `e2e:bdd` + `e2e:prod` + `pnpm -C apps/web test` + root `pnpm typecheck` + `pnpm lint` + `pnpm format:check` pass

## Workflow follow-up

- After all tasks complete: run code review per project policy, resolve findings, then archive (`openspec archive`) — re-run `openspec validate --all --strict` first: `housing-search-ui` is also modified by active `map-aspect-ratio`, so sync order matters.
