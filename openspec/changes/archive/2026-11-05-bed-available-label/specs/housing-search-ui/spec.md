# Spec Delta

## MODIFIED Requirements

### Requirement: Unit cards

Each card SHALL present the unit's essential specs (bedrooms, ward, cost, housing type) and the owning provider/program name, plus the confirmed-vs-needs-verification badge where applicable. A zero-bedroom efficiency unit SHALL present as "Studio" rather than "0 bedrooms". A zero-bedroom shared-room unit SHALL present its bedroom line as bed availability ("Bed available") rather than a numeric bedroom count, so the offering is readable as a bed in a shared room.

#### Scenario: Card scan
- **WHEN** a returning citizen scans the card list
- **THEN** unit type, location (ward), cost, and provider are readable without opening detail

#### Scenario: Zero-bedroom presentation scan
- **WHEN** a returning citizen scans cards for zero-bedroom units
- **THEN** efficiencies read as studio offers ("Studio") and shared-rooms read as bed offers ("Bed available") — neither reads as a missing or forgotten bedroom count
