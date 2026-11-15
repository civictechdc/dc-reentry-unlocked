# Spec Delta

## MODIFIED Requirements

### Requirement: Versioned, city-agnostic model

The unit data model SHALL be versioned and SHALL keep jurisdiction-specific fields as extension points rather than core fields, so the same spec can be adopted by other cities without breaking existing consumers. Every unit SHALL carry exact coordinates.

#### Scenario: Model revision consumed gracefully
- **WHEN** the data model adds a field or enum value in a new revision
- **THEN** consumers built against the previous revision continue to function without code changes (new fields/enum values are ignorable)

#### Scenario: Future taxonomy value is not the honest unknown
- **WHEN** a model revision adds a taxonomy value and a consumer built against the previous revision receives a payload carrying it
- **THEN** the value stays the published value — it is not rewritten to "unknown", which remains reserved for facts the source did not publish
