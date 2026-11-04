# Spec Delta

## ADDED Requirements

### Requirement: Pin activity label

The map SHALL display a text label on the active pin — a unit hovered or focused via its card, hovered via its pin, or selected — so the highlighted pin is identifiable without relying on colour perception. The label SHALL accompany the colour/size highlight rather than replace it, and exactly one pin SHALL carry a label at a time.

#### Scenario: Label appears on card hover or keyboard focus

- **WHEN** a user hovers or keyboard-focuses a unit card
- **THEN** that unit's pin displays its street address and ZIP code as a text label inside a speech-bubble shape whose tail points at the pin just above the pin icon, alongside its highlight

#### Scenario: Label text derives from the address structurally

- **WHEN** a unit's address ends in a `<street>, <city>, <state> <ZIP>` shape
- **THEN** the label shows the street part and the ZIP code only, with no city or state name hardcoded into the derivation
- **AND** an address without that shape renders as its full text rather than blank

#### Scenario: Label persists while the unit's detail is open

- **WHEN** a unit is selected and its detail panel is open, including after focus moves into the panel
- **THEN** that unit's pin keeps its bubble-contained address label and highlight until the detail is closed or the selection changes

#### Scenario: Label disappears when the unit is no longer active

- **WHEN** a hovered or focused card is unfocused, hover moves off the unit, or the detail panel closes and the selection clears
- **THEN** no pin displays a label

#### Scenario: Hover takes precedence over selection for the single label

- **WHEN** a different unit's card is hovered while another unit is selected
- **THEN** the hovered unit's pin carries the label, and the selected unit's label returns when hover ends
