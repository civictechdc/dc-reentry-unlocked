# Evidence — filter-area-layout

Screenshots of the final UI for orientation and review. Behavior and geometry
are pinned by the e2e specs in `apps/web/e2e/` (`filter-geometry`,
`desktop-proportions`, `focus-containment`, `popover-layering`,
`mobile-strip`, `feedback-focus`); these images do not replace them.

Captured 2026-11-24 from the dev stack (headless Chromium via Playwright,
`vite dev` on :5173, API on :3000, synthetic dataset, macOS), then losslessly
optimized with ImageOptim. 1x device scale unless the name says `2x`.
Focus-ring shots used real keyboard modality (a key press before focus) so
`:focus-visible` matches.

| Image | Shows |
| --- | --- |
| `desktop-band-empty.png` | 1280×720, no filters: the reserved summary band — "Selected filters (0)", no clear-all, an empty chip row, same height as when active |
| `desktop-band-one-chip.png` | One value applied: heading "(1)", clear-all appears on the heading line, one chip; the band height is unchanged |
| `desktop-overflow-trigger.png` | Ten values: one bounded chip row ending in "+2 more"; clear-all right-aligned on the heading line |
| `desktop-overflow-trigger-focused-2x.png` | The same row with keyboard focus on "+2 more": the full focus ring (3px outline at 2px offset), not clipped by the row |
| `desktop-overflow-popover.png` | The popover opened from the trigger: every applied chip with its removal control, focus moved to the first removal; it overlays the list without moving the map |
| `desktop-detail-covers-band.png` | With a unit detail open, the slide-over covers the band's right-hand controls (clear-all, the trigger) exactly like the cards beneath it |
| `phone-strip-one-filter.png` | 390×844, one filter, sheet closed: "Ward (1 selected)" count chip and "Clear all filters" |
| `phone-strip-five-filters.png` | Five filters: the first chip, "+4 more" at the visible edge, the next chip dissolving under the scroll fade, clear-all fixed outside the scroll |
| `phone-count-chip-focused-2x.png` | Keyboard focus ring on a count chip, not clipped by the strip |

On phone the strip sits at the bottom of the screen, below the map viewport —
its position before this change; the sheet-closed clear-all lives there.
