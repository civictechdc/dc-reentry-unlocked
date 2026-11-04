# Spec Delta

## ADDED Requirements

### Requirement: Card selection focuses the map

Selecting a unit from the card list SHALL center the map on the selected unit's pin and set the map zoom to the configured card-focus zoom level. The focus placement SHALL be the pin's own placement (the unit's exact coordinates), so the focused camera and the highlighted pin always agree. The card-focus zoom SHALL be a single configuration constant whose value is chosen by experimentation and tunable without structural change.

#### Scenario: Card click centers and zooms the map
- **WHEN** a user clicks a unit card in the list
- **THEN** the map centers on that unit's pin at the configured card-focus zoom

#### Scenario: Keyboard selection focuses identically
- **WHEN** a keyboard user activates a unit card (or the unit's pin button in the map's keyboard pin list)
- **THEN** the map focuses on that unit exactly as a mouse card click does — same center, same zoom

#### Scenario: Mobile map mounts on the focused view
- **WHEN** a card is selected while the mobile List tab is active (the map is not mounted) and the user then switches to the Map tab
- **THEN** the map mounts already centered on the selected unit at the card-focus zoom, and selecting the card did not force a tab switch
