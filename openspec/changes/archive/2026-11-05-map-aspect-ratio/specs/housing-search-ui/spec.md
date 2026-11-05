# Spec Delta

## MODIFIED Requirements

### Requirement: Map + card list layout

The search UI SHALL present a map of unit location pins alongside the card list of the same result set. Pins and cards SHALL render from the same result set and stay consistent with each other. On first load with no filters set, every available unit SHALL have a pin on the map and the full list of available units SHALL be displayed. On desktop-width viewports (at and above the confirmed 900px breakpoint) the map pane SHALL render with proportions capped near 4:3 — closer to square than to a wide strip — and the card list's visible scroll window SHALL use the viewport height well (several units visible at once on a maximized window). The layout SHALL adapt coherently across window sizes, rendering the confirmed preferred form for each size class without broken intermediate states, and on desktop-width viewports the page SHALL NOT scroll as a whole nor shall the map pane overflow its grid row.

#### Scenario: Pin-card cross-highlighting
- **WHEN** a pin or its card is hovered or selected
- **THEN** the corresponding card and pin highlight in both directions

#### Scenario: Unfiltered first load is complete
- **WHEN** the page first loads with no filters set
- **THEN** every available unit's pin appears on the map without requiring any interaction, consistent with the full card list shown alongside it

#### Scenario: Desktop proportions use the viewport well
- **WHEN** the page is viewed on a maximized desktop-width viewport
- **THEN** the map pane is capped near 4:3 (for example roughly 987×704 at 1920×1080, versus today's roughly 2:1 strip), and the card list's unscrolled window shows several units — around five — rather than around three

#### Scenario: Responsive size classes render their confirmed forms
- **WHEN** the window is resized across the size classes (phone, portrait tablet, landscape tablet, laptop, maximized desktop)
- **THEN** each size renders its confirmed preferred layout form: at and below the 900px breakpoint (phones and portrait tablets) the tabbed list-first form with on-demand map; above it the desktop grid with the 4:3-capped map and a 26–32rem list column — with no broken intermediate states between classes

#### Scenario: Phone map tab renders square-ish in both orientations
- **WHEN** the phone map tab is viewed in portrait or landscape
- **THEN** the map renders as a square-ish pane centered in the tab (near 1:1 in portrait), framed by a small border; in landscape the map tab uses the screen height well enough that the map is never a wide strip (no 8:1 sliver), and the tab bar stays reachable

#### Scenario: Short viewports stay clamped
- **WHEN** the viewport is wide but short (for example 1440×660) or the desktop grid's row is shorter than the map's former fixed minimum
- **THEN** the map pane clamps within its grid row instead of overflowing it, and the page does not scroll as a whole
