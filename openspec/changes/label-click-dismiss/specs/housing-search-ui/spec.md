# Spec Delta

## MODIFIED Requirements

### Requirement: Pin activity label

The map SHALL display a text label on the active pin — a unit hovered or focused via its card, hovered via its pin, or selected — so the highlighted pin is identifiable without relying on colour perception. The label SHALL accompany the colour/size highlight rather than replace it, and exactly one pin SHALL carry a label at a time. Clicking empty map canvas SHALL dismiss the label together with its selection; a click-drag or tap-drag pan SHALL NOT dismiss anything.

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

#### Scenario: Label appears on canvas pin hover, transiently

- **WHEN** a user rests the pointer on a map pin, for an intent delay short enough to feel immediate
- **THEN** that unit's pin displays its address label without selecting the unit or opening the detail
- **AND WHEN** the pointer leaves the pin
- **THEN** the label disappears unless a card hover or an open selection keeps another identity active

#### Scenario: Click off dismisses the label and its selection

- **WHEN** a user clicks empty map canvas away from any pin, with the label (and possibly the detail) showing
- **THEN** the selection clears, the detail slide-over closes, and no pin displays a label or highlight

#### Scenario: Panning does not dismiss

- **WHEN** a user click-drags or tap-drags the map (panning) that starts on empty canvas
- **THEN** the selection, detail, and label state are unchanged

### Requirement: Unit detail slide-over

Selecting a card or pin SHALL open a detail panel sliding over the card list while the map remains visible, and closing it SHALL return to the list in its prior state. The panel SHALL show the unit's specs, the program's policies, and the provider's contact block, with unknown fields displayed as "not publicly listed" rather than a fabricated value. Clicking empty map canvas SHALL close the panel the same way its close control does; a click-drag or tap-drag pan SHALL NOT close it.

#### Scenario: Detail opened from pin
- **WHEN** a user clicks a map pin
- **THEN** the slide-over detail opens for that unit with the map still visible

#### Scenario: Complete detail content
- **WHEN** the detail panel renders for a unit
- **THEN** it shows unit specs (address, bedrooms, size, cost), program policies (referral, sobriety, background check, sex-offense restrictions, treatment, vouchers, population, gender, length of stay), and the provider contact block (organization, program, phone, email, website, application process)

#### Scenario: Honest unknowns in detail
- **WHEN** a policy field is unknown at the source
- **THEN** the detail panel displays "not publicly listed" for that field

#### Scenario: Canvas click closes the detail
- **WHEN** the detail panel is open and the user clicks empty map canvas away from any pin
- **THEN** the panel closes and the list returns in its prior state

#### Scenario: Panning keeps the detail open
- **WHEN** the detail panel is open and the user pans the map with a click-drag or tap-drag
- **THEN** the panel stays open

#### Scenario: Closing returns focus to the trigger
- **WHEN** the detail panel closes by its close button, the Escape key, or an empty-canvas click
- **THEN** keyboard focus returns to the control that opened it — the unit's card button or pin button — rather than dropping to the page
