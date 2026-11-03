# Spec Delta

## MODIFIED Requirements

### Requirement: Map + card list layout

The search UI SHALL present a map of unit location pins alongside the card list of the same result set. Pins and cards SHALL render from the same result set and stay consistent with each other. On first load with no filters set, every available unit SHALL have a pin on the map and the full list of available units SHALL be displayed.

#### Scenario: Pin-card cross-highlighting
- **WHEN** a pin or its card is hovered or selected
- **THEN** the corresponding card and pin highlight in both directions

#### Scenario: Unfiltered first load is complete
- **WHEN** the page first loads with no filters set
- **THEN** every available unit's pin appears on the map without requiring any interaction, consistent with the full card list shown alongside it
