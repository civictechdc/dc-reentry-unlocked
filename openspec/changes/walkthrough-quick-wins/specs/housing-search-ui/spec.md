# Spec Delta

## ADDED Requirements

### Requirement: On-screen map camera controls

The map view SHALL provide on-screen zoom controls and a recenter control, each available in a development session only while its candidate-behavior feature flag is enabled. The recenter control SHALL return the camera to the configured locale view (center and initial zoom), so the locale remains a configuration concern rather than a hardcoded place.

#### Scenario: Zoom controls change the map view
- **WHEN** a development session runs with the map-zoom flag enabled and the user activates the on-screen zoom in or zoom out control
- **THEN** the map camera zooms in or out one step respectively, leaving the rest of the view undisturbed

#### Scenario: Recenter returns the configured locale view
- **WHEN** a development session runs with the recenter flag enabled and the camera has been panned or zoomed away from the locale view
- **THEN** activating the recenter control returns the camera to the configured locale's center and initial zoom

#### Scenario: Controls carry accessible names
- **WHEN** the map camera controls render in a development session
- **THEN** each control exposes a localized accessible name and is operable from the keyboard

## MODIFIED Requirements

### Requirement: Unit detail slide-over

Selecting a card or pin SHALL open a detail panel sliding over the card list while the map remains visible, and closing it SHALL return to the list in its prior state. The panel SHALL show the unit's specs, the program's policies, and the provider's contact block, with unknown fields displayed as "not publicly listed" rather than a fabricated value. The panel's close control SHALL present an icon affordance with a localized accessible name, and a listed phone number SHALL render as a `tel:` link.

#### Scenario: Detail opened from pin
- **WHEN** a user clicks a map pin
- **THEN** the slide-over detail opens for that unit with the map still visible

#### Scenario: Complete detail content
- **WHEN** the detail panel renders for a unit
- **THEN** it shows unit specs (address, bedrooms, size, cost), program policies (referral, sobriety, background check, sex-offense restrictions, treatment, vouchers, population, gender, length of stay), and the provider contact block (organization, program, phone, email, website, application process), with a listed phone number rendered as a `tel:` link whose visible text keeps the listed formatting

#### Scenario: Honest unknowns in detail
- **WHEN** a policy field is unknown at the source
- **THEN** the detail panel displays "not publicly listed" for that field

#### Scenario: Unlisted phone stays plain honest text
- **WHEN** the provider phone is not publicly listed
- **THEN** the contact block displays "not publicly listed" as plain text, not a link

#### Scenario: Close affordance is an icon with a localized accessible name
- **WHEN** the detail panel renders
- **THEN** its close control presents a "×" icon glyph and exposes a localized accessible name, leaving every dismissal path and focus-return behavior unchanged
