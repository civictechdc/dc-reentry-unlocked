# Spec Delta

## MODIFIED Requirements

### Requirement: Map + card list layout

The search UI SHALL present a map of unit location pins alongside the card list of the same result set. On first load with no filters set, every available unit SHALL have a pin and the full list SHALL display. Across window sizes the layout SHALL render each size class's confirmed form: on desktop-width viewports a map pane capped near 3:2 with the card list's scroll window using the viewport height well, and no whole-page scroll or map-pane overflow anywhere.

#### Scenario: Pin-card cross-highlighting
- **WHEN** a pin or its card is hovered or selected
- **THEN** the corresponding card and pin highlight in both directions

#### Scenario: Unfiltered first load is complete
- **WHEN** the page first loads with no filters set
- **THEN** every available unit's pin appears on the map without requiring any interaction, consistent with the full card list shown alongside it

#### Scenario: Desktop proportions use the viewport well
- **WHEN** the page is viewed on a maximized desktop-width viewport
- **THEN** the map pane is capped near 3:2 (for example roughly 1218×812 at 1920×1080, and roughly 904×651 at 1440×900 with the filter bar compacted to one row), the map's side dead margin stays small, and the card list's unscrolled window shows several units — around five — rather than around three

#### Scenario: Responsive size classes render their confirmed forms
- **WHEN** the window is resized across the size classes (phone, portrait tablet, landscape tablet, laptop, maximized desktop)
- **THEN** each size renders its confirmed preferred layout form: at and below the 900px breakpoint (phones and portrait tablets) the tabbed list-first form with on-demand map; above it the desktop grid with the 3:2-capped map and a 26–32rem list column — with no broken intermediate states between classes

#### Scenario: Phone map tab renders square-ish in both orientations
- **WHEN** the phone map tab is viewed in portrait or landscape
- **THEN** the map renders as a square-ish pane centered in the tab (near 1:1 in portrait), framed by a small border; in landscape the map tab uses the screen height well enough that the map is never a wide strip (no 8:1 sliver), and the tab bar stays reachable

#### Scenario: Short viewports stay clamped
- **WHEN** the viewport is wide but short (for example 1440×660) or the desktop grid's row is shorter than the map's former fixed minimum
- **THEN** the map pane clamps within its grid row instead of overflowing it, and the page does not scroll as a whole
