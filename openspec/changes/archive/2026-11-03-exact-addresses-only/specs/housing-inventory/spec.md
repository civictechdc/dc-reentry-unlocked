# Spec Delta

## REMOVED Requirements

### Requirement: Location precision as first-class
**Reason**: The product works with exact addresses only (user decision 2026-10-31) — ward-only units are removed from the model, so there is no approximate state to represent. Coordinates are required on every unit.
**Migration**: None needed — no approximate data exists outside the prototype's own generator, which now emits exact-address units only. If future real-data ingestion receives ward-only units, a follow-up change reintroduces precision as an additive contract extension (schemaVersion bump, re-adding the precision field as optional with exact as default).

## MODIFIED Requirements

### Requirement: Versioned, city-agnostic model

The unit data model SHALL be versioned and SHALL keep jurisdiction-specific fields as extension points rather than core fields, so the same spec can be adopted by other cities without breaking existing consumers. Every unit SHALL carry exact coordinates.

#### Scenario: Model revision consumed gracefully
- **WHEN** the data model adds a field or enum value in a new revision
- **THEN** consumers built against the previous revision continue to function without code changes (new fields/enum values are ignorable)

### Requirement: Synthetic prototype data

The prototype SHALL generate synthetic inventory on real Washington DC geography, with fictional providers and generated building numbers whose coordinates fall within their correct ward. Generation provenance guarantees no real listings: building numbers are randomly sampled from plausible per-street ranges, coordinates derived from real street geometry — never copied from any real listing or address source — and no real DC provider organization or contact number appears anywhere. Bedrooms SHALL agree with room type: apartment units carry at least one bedroom, efficiency units are zero-bedroom, private rooms carry one, and shared-room units are zero-bedroom.

#### Scenario: Generated address maps within its ward
- **WHEN** a synthetic unit's address and coordinates are checked
- **THEN** the coordinates fall within the real boundary of the unit's ward, on the real street, quadrant, and ZIP of its address

#### Scenario: Building numbers are generated, not copied
- **WHEN** the generator samples a building number for a street
- **THEN** it draws from a plausible per-street range rather than any real listing or address source

#### Scenario: Ward coverage
- **WHEN** the synthetic dataset is generated
- **THEN** every ward 1–8 contains units

#### Scenario: Bedrooms agree with room type
- **WHEN** a generated unit's bedrooms and room type are checked
- **THEN** the pair is coherent — apartments have at least one bedroom, efficiencies are zero-bedroom, private rooms have one, shared rooms are zero-bedroom

#### Scenario: No real-world confusion
- **WHEN** a user inspects any synthetic provider
- **THEN** the organization is fictional and carries non-real contact details
