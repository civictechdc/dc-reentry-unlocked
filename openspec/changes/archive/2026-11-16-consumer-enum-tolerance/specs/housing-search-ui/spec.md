# Spec Delta

## ADDED Requirements

### Requirement: Future taxonomy values stay distinct from the honest unknown

The web client SHALL accept unit payloads whose taxonomy fields carry values newer than its compiled vocabulary, and SHALL render them with a presentation derived from the published value — never the honest "Unknown" marker, which stays reserved for facts the source did not publish.

#### Scenario: Intake tolerates a future taxonomy value
- **WHEN** the /units payload carries a taxonomy value the client was not built with (for example a housing type added after the client shipped)
- **THEN** the client accepts the payload and renders the unit — intake does not reject the envelope

#### Scenario: Future value renders distinctly on the card
- **WHEN** a card's program carries a future taxonomy value
- **THEN** its row shows a presentation derived from the published value, never the "Unknown" marker used for unpublished facts

#### Scenario: Future value renders distinctly in detail
- **WHEN** the detail slide-over shows a field carrying a future taxonomy value
- **THEN** it shows the same presentation the card shows, never the honest "Unknown" marker
