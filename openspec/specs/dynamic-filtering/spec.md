# dynamic-filtering Specification

## Purpose
Defines the schema-driven filter system spanning backend and frontend: filters are data, not code. The backend publishes filter definitions; the frontend renders them generically and keeps map and card results in sync — the mechanism that lets the filter set change without frontend releases.

## Requirements

### Requirement: Schema-rendered filter UI

The filter UI SHALL be rendered entirely from the backend-published filter schema. No filter SHALL be hardcoded in the frontend. Adding, removing, renaming, reordering, or changing option lists of filters using supported control types SHALL require no frontend code change or redeploy.

#### Scenario: Filter added without redeploy
- **WHEN** the backend schema gains a new filter definition using a supported control type
- **THEN** the frontend filter bar displays it after refresh, with zero frontend changes

#### Scenario: Filter removed
- **WHEN** a filter definition is removed from the schema
- **THEN** it disappears from the filter bar and any active selection for it is discarded gracefully

### Requirement: Generic renderers for supported control types

The frontend SHALL provide generic renderers for each supported control type: boolean (yes/no), single-select, and multi-select (with selected values shown as removable chips). A filter definition needing an unsupported control type (e.g., a numeric range slider) SHALL degrade gracefully — hidden or its value shown raw — and MUST NOT crash or break the rest of the filter bar. Adding a genuinely new control type is a frontend release that then becomes available to all future filters.

#### Scenario: Boolean filter
- **WHEN** a boolean filter definition is rendered
- **THEN** it offers yes/no selection

#### Scenario: Unsupported control type arrives
- **WHEN** the schema contains a control type the frontend does not support
- **THEN** the app continues to function with that filter absent, and remaining filters behave normally

### Requirement: Map and card synchronization

Applying, changing, or clearing any filter SHALL update the map pins and the card list together from the same result set. The two views SHALL never show different filter states.

#### Scenario: Filter applied to both views
- **WHEN** a user selects "Ward 5" and "Transitional"
- **THEN** map pins and card list both reflect exactly the matching units

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
### Requirement: Zero-results state

When filter selections match no units, the UI SHALL show a zero-results state offering chip-by-chip removal and a "clear all" action, rather than an empty page.

#### Scenario: No matches
- **WHEN** the active filters match zero units
- **THEN** a clear empty-state panel appears explaining no units match, with controls to relax the filters

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
