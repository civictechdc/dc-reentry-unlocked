## MODIFIED Requirements

### Requirement: Active selections as removable chips

Active filter selections SHALL be presented in an applied-selection summary whose region reserves identical geometry whether empty, active, or cleared: per-value chips individually removable on desktop-width viewports, count chips with an explicit selected-count word on phone-width screens, chip overflow bounded with a visible "+N more" disclosure affordance, and a single "Clear all filters" control on the summary's top line outside any scrolling chip content.

#### Scenario: Chip removal narrows scope

- **WHEN** a user removes one chip while several are active
- **THEN** results update to reflect the remaining selections only

#### Scenario: Summary geometry is reserved

- **WHEN** the selection changes among empty, active, and cleared states
- **THEN** the applied-selection summary region keeps identical height, and the clear-all control's appearance absorbs no additional space

#### Scenario: Overflow keeps every value removable

- **WHEN** more chips are active than the bounded presentation shows
- **THEN** a "+N more" affordance is visible and discloses every applied value, each individually removable through the disclosure surface

#### Scenario: Mobile count chip is unambiguous and non-destructive

- **WHEN** a phone-width count chip for a filter with three selected values is rendered and activated
- **THEN** its label reads with an explicit count word rather than as a single value, and the filter sheet opens with the selection unchanged

#### Scenario: Clear-all lives on the top line with the sheet closed

- **WHEN** a selection is active on a phone-width screen with the filter sheet closed
- **THEN** "Clear all filters" is operable from the summary without opening the sheet, and activating it clears every selection

#### Scenario: Removal is named and focus-preserving

- **WHEN** a chip's removal control is activated
- **THEN** its accessible name identifies the filter and the value, and focus moves to a logical neighbor — another removal control or the summary — not the page body

## ADDED Requirements

### Requirement: Filter result feedback

Applying, changing, removing, or clearing filters SHALL announce the matching-unit count through a status region, concisely and without moving focus.

#### Scenario: Matching count announced on apply

- **WHEN** a filter is applied or changed
- **THEN** a concise matching-unit count is announced via the status region and focus remains where the user left it

#### Scenario: Clearing announces the unfiltered count

- **WHEN** all filters are cleared
- **THEN** the status region announces the count for the unfiltered result set

#### Scenario: Zero matches announced consistently

- **WHEN** the active filters match no units
- **THEN** the status announcement and the zero-results state agree that no units match
