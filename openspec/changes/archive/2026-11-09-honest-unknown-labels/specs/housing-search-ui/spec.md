# Spec Delta

## MODIFIED Requirements

### Requirement: Unit cards

Each card SHALL show bedrooms, ward, cost, housing type, provider/program name, and the confirmed-vs-needs-verification badge where applicable. Known taxonomy values SHALL show their display labels, consistent with detail; unknown values SHALL show "Unknown". Zero-bedroom efficiencies SHALL read "Studio"; zero-bedroom shared rooms SHALL read "Bed available", not a numeric bedroom count.

#### Scenario: Card scan
- **WHEN** a returning citizen scans the card list
- **THEN** unit type, location (ward), cost, and provider are readable without opening detail

#### Scenario: Zero-bedroom presentation scan
- **WHEN** a returning citizen scans cards for zero-bedroom units
- **THEN** efficiencies read as studio offers ("Studio") and shared-rooms read as bed offers ("Bed available") — neither reads as a missing or forgotten bedroom count

#### Scenario: Known housing type shows its label
- **WHEN** a card's program has the known housing type transitional
- **THEN** its housing-type row reads "Housing type: Transitional", consistent with the label shown in detail, rather than "Housing type: Unknown"

#### Scenario: Unknown housing type stays honest
- **WHEN** a card's program has an unknown housing type
- **THEN** its housing-type row reads "Housing type: Unknown" rather than inventing a taxonomy label

### Requirement: Unit detail slide-over

Selecting a card or pin SHALL open a detail panel over the card list while the map remains visible; closing SHALL restore the list's prior state. The panel SHALL show unit specs, program policies, and provider contacts, with unknown fields shown as "Unknown" rather than fabricated. Its close control SHALL have an icon and localized accessible name; a known phone SHALL render as a `tel:` link.

#### Scenario: Detail opened from pin
- **WHEN** a user clicks a map pin
- **THEN** the slide-over detail opens for that unit with the map still visible

#### Scenario: Complete detail content
- **WHEN** the detail panel renders for a unit
- **THEN** it shows unit specs (address, bedrooms, size, cost), program policies (referral, sobriety, background check, sex-offense restrictions, treatment, vouchers, population, gender, length of stay), and the provider contact block (organization, program, phone, email, website, application process), with a known phone number rendered as a `tel:` link whose visible text keeps the source formatting

#### Scenario: Honest unknowns in detail
- **WHEN** a policy field is unknown at the source
- **THEN** the detail panel displays "Unknown" for that field

#### Scenario: Unlisted phone stays plain honest text
- **WHEN** the provider phone is unknown at the source
- **THEN** the contact block displays "Unknown" as plain text, not a link

#### Scenario: Close affordance is an icon with a localized accessible name
- **WHEN** the detail panel renders
- **THEN** its close control presents a "×" icon glyph and exposes a localized accessible name, leaving every dismissal path and focus-return behavior unchanged
