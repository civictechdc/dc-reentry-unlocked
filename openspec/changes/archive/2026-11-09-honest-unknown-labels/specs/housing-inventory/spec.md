# Spec Delta

## MODIFIED Requirements

### Requirement: Unknown is a representable state

Every policy/eligibility field in the data model SHALL support an unknown state, meaning the source has not publicly supplied the value, distinct from yes and no. Consumer-facing detail views SHALL display unknown honestly as "Unknown" rather than rendering a fabricated yes/no.

#### Scenario: Unknown policy displayed honestly
- **WHEN** a unit's program has no known sobriety policy
- **THEN** the detail view shows "Unknown" for that field, not "no"
