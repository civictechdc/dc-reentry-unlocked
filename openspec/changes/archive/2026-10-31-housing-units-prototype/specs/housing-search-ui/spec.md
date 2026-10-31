# Spec Delta

## Purpose

Defines the user-facing display application: available housing units on an interactive map and card list, with slide-over unit detail ending at provider contact information. Covers layout, responsive behavior, accessibility, internationalization readiness, performance, and honest presentation of imperfect data.

## ADDED Requirements

### Requirement: Map + card list layout

The primary desktop layout SHALL present an interactive map of Washington DC on the left and a scrollable card list of available units on the right, with the schema-driven filter bar above both. Hovering or focusing a card SHALL highlight its map pin, and selecting a pin SHALL highlight its card.

#### Scenario: Pin-card cross-highlighting
- **WHEN** a user hovers a unit card
- **THEN** the corresponding map pin is visually highlighted

### Requirement: Unit cards

Each card SHALL present the unit's essential specs (bedrooms, ward, cost, housing type) and the owning provider/program name, plus the confirmed-vs-needs-verification badge where applicable.

#### Scenario: Card scan
- **WHEN** a returning citizen scans the card list
- **THEN** unit type, location (ward), cost, and provider are readable without opening detail

### Requirement: Unit detail slide-over

Selecting a card or pin SHALL open a detail panel sliding over the card list while the map remains visible, and closing it SHALL return to the list in its prior state. The panel SHALL show the unit's specs, the program's policies, and the provider's contact block, with unknown fields displayed as "not publicly listed" rather than a fabricated value.

#### Scenario: Detail opened from pin
- **WHEN** a user clicks a map pin
- **THEN** the slide-over detail opens for that unit with the map still visible

#### Scenario: Complete detail content
- **WHEN** the detail panel renders for a unit
- **THEN** it shows unit specs (address, bedrooms, size, cost), program policies (referral, sobriety, background check, sex-offense restrictions, treatment, vouchers, population, gender, length of stay), and the provider contact block (organization, program, phone, email, website, application process)

#### Scenario: Honest unknowns in detail
- **WHEN** a policy field is unknown at the source
- **THEN** the detail panel displays "not publicly listed" for that field

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
