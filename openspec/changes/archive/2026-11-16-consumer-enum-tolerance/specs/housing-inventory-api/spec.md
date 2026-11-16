# Spec Delta

## MODIFIED Requirements

### Requirement: Stable, evolvable contract

The API contract SHALL remain stable across data model evolution: additive changes (new fields, new enum values, new filters using existing control types) MUST NOT break existing frontend consumers. Breaking contract changes SHALL be versioned.

#### Scenario: Additive schema evolution
- **WHEN** the backend adds a new enum value or a new schema-driven filter
- **THEN** a frontend consumer built before the change renders correctly without redeploy

#### Scenario: Future taxonomy value served verbatim
- **WHEN** a unit card's program carries a taxonomy value that postdates a consumer's compiled vocabulary
- **THEN** the API serves the value verbatim in the payload — it does not rewrite it to "unknown" — leaving tolerance to the consumer
