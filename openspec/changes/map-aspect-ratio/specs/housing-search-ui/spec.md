# Spec Delta

## MODIFIED Requirements

### Requirement: Map + card list layout

The search UI SHALL present a map of unit location pins alongside the card list of the same result set. Pins and cards SHALL render from the same result set and stay consistent with each other. On first load with no filters set, every available unit SHALL have a pin on the map and the full list of available units SHALL be displayed. On desktop-width viewports the map pane SHALL render with proportions closer to square than to a wide strip, and the card list's visible scroll window SHALL use the viewport height well (several units visible at once on a maximized window). The layout SHALL adapt coherently across window sizes, rendering the confirmed preferred form for each size class without broken intermediate states.

#### Scenario: Pin-card cross-highlighting
- **WHEN** a pin or its card is hovered or selected
- **THEN** the corresponding card and pin highlight in both directions

#### Scenario: Desktop proportions use the viewport well
- **WHEN** the page is viewed on a maximized desktop-width viewport
- **THEN** the map pane is not a wide strip (its aspect ratio is closer to square than today's roughly 2:1), and the card list's unscrolled window shows several units rather than around three

#### Scenario: Responsive size classes render their confirmed forms
- **WHEN** the window is resized across the size classes (phone, tablet widths, laptop, maximized desktop)
- **THEN** each size renders its confirmed preferred layout form, with no broken intermediate states between classes
