# housing-search-ui Specification

## Purpose
Defines the user-facing display application: available housing units on an interactive map and card list, with slide-over unit detail ending at provider contact information. Covers layout, responsive behavior, accessibility, internationalization readiness, performance, and honest presentation of imperfect data.

## Requirements

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
- **THEN** the map pane is capped near 3:2 (for example roughly 1218×812 at 1920×1080, and roughly 904×651 at 1440×900 with the filter bar compacted to a dense two-row band (~93px)), the map's side dead margin stays small, and the card list's unscrolled window shows several units — around five — rather than around three

#### Scenario: Responsive size classes render their confirmed forms
- **WHEN** the window is resized across the size classes (phone, portrait tablet, landscape tablet, laptop, maximized desktop)
- **THEN** each size renders its confirmed preferred layout form: at and below the 900px breakpoint (phones and portrait tablets) the tabbed list-first form with on-demand map; above it the desktop grid with the 3:2-capped map and a 26–32rem list column — with no broken intermediate states between classes

#### Scenario: Phone map tab renders square-ish in both orientations
- **WHEN** the phone map tab is viewed in portrait or landscape
- **THEN** the map renders as a square-ish pane centered in the tab (near 1:1 in portrait), framed by a small border; in landscape the map tab uses the screen height well enough that the map is never a wide strip (no 8:1 sliver), and the tab bar stays reachable

#### Scenario: Short viewports stay clamped
- **WHEN** the viewport is wide but short (for example 1440×660) or the desktop grid's row is shorter than the map's former fixed minimum
- **THEN** the map pane clamps within its grid row instead of overflowing it, and the page does not scroll as a whole

### Requirement: Unit cards

Each card SHALL present the unit's essential specs (bedrooms, ward, cost, housing type) and the owning provider/program name, plus the confirmed-vs-needs-verification badge where applicable. A zero-bedroom efficiency unit SHALL present as "Studio" rather than "0 bedrooms".

#### Scenario: Card scan
- **WHEN** a returning citizen scans the card list
- **THEN** unit type, location (ward), cost, and provider are readable without opening detail

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

### Requirement: Mobile responsive behavior

On phone-width screens, the app SHALL switch to Map/List tabbed navigation (each view full-screen), a horizontally scrollable filter row with a filter sheet, and a full-screen bottom-sheet unit detail. All functionality available on desktop SHALL remain available on mobile.

#### Scenario: Citizen on a phone
- **WHEN** the app is used at phone width
- **THEN** map and list remain fully operable through tabs, filters through the sheet, and detail through the bottom sheet

### Requirement: Prototype disclosure banner

Every screen SHALL display a persistent, prominent banner identifying the app as a prototype using synthetic data, so no inventory is mistaken for real housing opportunities.

#### Scenario: Synthetic-data notice visible
- **WHEN** any view of the app is displayed
- **THEN** the prototype/synthetic-data banner is visible

### Requirement: Error and loading states

The app SHALL provide: skeleton states for slow loads, a retry affordance when the backend is unreachable (retaining last results where possible), plain-language error pages (e.g., 404) for consumers with diagnostic detail logged rather than exposed, and graceful handling of unknown schema values without crashes.

#### Scenario: Backend down mid-session
- **WHEN** the API becomes unreachable after results loaded
- **THEN** the UI shows a retry banner and retains the last rendered results where possible

#### Scenario: Unknown page
- **WHEN** a user navigates to a nonexistent route
- **THEN** a plain-language 404 page appears; no stack traces or internal errors are exposed

### Requirement: Accessibility

The app SHALL meet WCAG 2.1 AA: keyboard-operable map/list/detail interaction, screen-reader-compatible filter controls and detail content, and AA contrast for all text and interactive elements in the civic clean light theme.

#### Scenario: Keyboard-only usage
- **WHEN** a user operates the app entirely by keyboard
- **THEN** filters, cards, detail open/close, and map pin selection are all reachable and usable

### Requirement: Internationalization readiness

All user-facing strings SHALL be externalized for localization from day one. The prototype ships in English only, but adding a language SHALL require no component rewrites.

#### Scenario: String externalization
- **WHEN** a developer audits the UI code
- **THEN** no user-facing string is hardcoded inside components

### Requirement: Performance

The app SHALL load quickly (light payload, no blocking resources on first render) and keep map navigation at target 60fps with the synthetic dataset size, including filter changes and pin/card interactions.

#### Scenario: Smooth map interaction
- **WHEN** a user pans/zooms the map with the full synthetic dataset loaded
- **THEN** interaction remains smooth without dropped-frame stutter or janky pin re-renders

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
