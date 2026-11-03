# Spec Delta

## MODIFIED Requirements

### Requirement: Available units listing

The API SHALL serve currently-available units as flattened unit cards: unit-level fields (id, address, bedrooms, size, cost, ward, quadrant, coordinates, verification badge) joined with the owning program's policy fields and provider's contact fields. Every served card SHALL carry exact coordinates. Unavailable units SHALL be excluded.

#### Scenario: Card payload is self-contained
- **WHEN** a consumer fetches the units listing
- **THEN** each returned unit card carries unit specs, program policies, and provider contact details with no further requests required
