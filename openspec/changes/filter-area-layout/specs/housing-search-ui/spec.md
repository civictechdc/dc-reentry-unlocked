## MODIFIED Requirements

### Requirement: Map + card list layout

The search UI SHALL present a map of unit location pins alongside the card list of the same result set; on first load with no filters set, every available unit SHALL have a pin and the full list SHALL display. Each window size SHALL render its size class's confirmed form (desktop-width: a map pane capped near 3:2, the card list's scroll window using the viewport height well, no whole-page scroll or map-pane overflow). Filter changes SHALL NOT change the desktop map pane's position or size.

#### Scenario: Pin-card cross-highlighting

- **WHEN** a pin or its card is hovered or selected
- **THEN** the corresponding card and pin highlight in both directions

#### Scenario: Unfiltered first load is complete

- **WHEN** the page first loads with no filters set
- **THEN** every available unit's pin appears on the map without requiring any interaction, consistent with the full card list shown alongside it

#### Scenario: Desktop proportions use the viewport well

- **WHEN** the page is viewed on a maximized desktop-width viewport
- **THEN** the map is capped near 3:2 inside its pane (for example roughly 1104×736 at 1920×1080, and roughly 862×574 at 1440×900 — measured with the compacted filter controls above the reserved compact summary band at its ~76px two-line height, identical whether unfiltered or filtered), the map's side dead margin stays small, and the card list's unscrolled window shows several units — around five at 1920×1080 and around four at 1440×900 — rather than around three

#### Scenario: Responsive size classes render their confirmed forms

- **WHEN** the window is resized across the size classes (phone, portrait tablet, landscape tablet, laptop, maximized desktop)
- **THEN** each size renders its confirmed preferred layout form: at and below the 900px breakpoint (phones and portrait tablets) the tabbed map-first form with on-demand list (map tab initially active); above it the desktop grid with the 3:2-capped map and a 26–32rem list column — with no broken intermediate states between classes

#### Scenario: Phone map tab renders square-ish in both orientations

- **WHEN** the phone map tab is viewed in portrait or landscape
- **THEN** the map renders as a square-ish pane centered in the tab (near 1:1 in portrait), framed by a small border; in landscape the map tab uses the screen height well enough that the map is never a wide strip (no 8:1 sliver), and the tab bar stays reachable

#### Scenario: Short viewports stay clamped

- **WHEN** the viewport is wide but short (for example 1440×660) or the desktop grid's row is shorter than the map's former fixed minimum
- **THEN** the map pane clamps within its grid row instead of overflowing it, and the page does not scroll as a whole

#### Scenario: Filter interactions leave the map pane in place

- **WHEN** filters are applied, changed, removed, or cleared on a desktop-width viewport
- **THEN** the map pane's position and size are unchanged, with the applied-selection summary absorbing selection changes inside its reserved space

### Requirement: Mobile responsive behavior

On phone-width screens, the app SHALL switch to Map/List tabbed navigation (each view full-screen), a horizontally scrollable filter summary row with a filter sheet, and a full-screen bottom-sheet unit detail. The summary row SHALL keep a stable height across selection changes and SHALL disclose chip overflow with a visible affordance rather than silent clipping. All functionality available on desktop SHALL remain available on mobile.

#### Scenario: Citizen on a phone

- **WHEN** the app is used at phone width
- **THEN** map and list remain fully operable through tabs, filters through the sheet, and detail through the bottom sheet

#### Scenario: Summary row height is stable

- **WHEN** filters are applied, removed, or cleared at phone width
- **THEN** the summary row's height and the centered map square's position are unchanged

#### Scenario: Overflow is disclosed, not silent

- **WHEN** active filters exceed the visible width of the summary row
- **THEN** a "+N more" affordance is visible and leads to the filter sheet, where every applied value remains reachable
