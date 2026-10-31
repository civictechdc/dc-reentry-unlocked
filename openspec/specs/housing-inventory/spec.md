# housing-inventory Specification

## Purpose
Defines the housing inventory data model — the versioned, city-agnostic `Provider → Program → Unit` hierarchy, availability states, location precision, and the rules governing synthetic prototype data for Washington DC.

## Requirements

### Requirement: Three-layer inventory hierarchy

The inventory SHALL model housing as a three-layer hierarchy: Provider (contact-bearing organization) → Program (policy-bearing housing program) → Unit (individually displayable housing unit). Every unit SHALL be associated with exactly one program, and every program with exactly one provider.

#### Scenario: Unit resolved through hierarchy
- **WHEN** a unit is displayed or served
- **THEN** its program's policy fields and its provider's contact fields are reachable from the unit without additional lookups by the consumer

### Requirement: Availability gating

The data model SHALL capture two distinct concepts: a per-unit **availability state** (available, not available, unverified-availability) and, for available units, a separate **confirmation flag**. Only units whose availability state is available SHALL be surfaced to the search UI and API listings.

#### Scenario: Unavailable unit hidden
- **WHEN** the inventory contains a unit whose availability state is not available
- **THEN** that unit is absent from API listings, map pins, and card lists

#### Scenario: Unverified availability hidden
- **WHEN** a unit's availability state is unverified (the source has not established whether the unit is available at all)
- **THEN** that unit is absent from API listings, map pins, and card lists

#### Scenario: Unconfirmed-but-available unit shown with badge
- **WHEN** an available unit's availability has not been confirmed with the source
- **THEN** the unit is still listed (it is available), and the confirmed-vs-needs-verification distinction is carried as a displayable badge field

### Requirement: Location precision as first-class

The unit location SHALL carry a precision concept distinguishing exact street address from approximate location (ward or corridor level). Approximate locations SHALL remain fully representable in the inventory and displayable on the map (e.g., placed within the correct ward), not treated as missing data.

#### Scenario: Approximate unit still mappable
- **WHEN** a unit has only ward-level location precision
- **THEN** the unit appears in listings and is placed on the map within its ward rather than being dropped

### Requirement: Unknown is a representable state

Every policy/eligibility field in the data model SHALL support an unknown ("not publicly listed") state distinct from yes and no. Consumer-facing detail views SHALL display unknown honestly as "not publicly listed" rather than rendering a fabricated yes/no.

#### Scenario: Unknown policy displayed honestly
- **WHEN** a unit's program has no known sobriety policy
- **THEN** the detail view shows "not publicly listed" for that field, not "no"

### Requirement: Versioned, city-agnostic model

The unit data model SHALL be versioned and SHALL keep jurisdiction-specific fields as extension points rather than core fields, so the same spec can be adopted by other cities without breaking existing consumers.

#### Scenario: Model revision consumed gracefully
- **WHEN** the data model adds a field or enum value in a new revision
- **THEN** consumers built against the previous revision continue to function without code changes (new fields/enum values are ignorable)

### Requirement: Synthetic prototype data

The prototype SHALL generate synthetic inventory on real Washington DC geography, with fictional providers and generated building numbers whose coordinates fall within their correct ward. Generation provenance guarantees no real listings: building numbers are randomly sampled from plausible per-street ranges, coordinates derived from real street geometry — never copied from any real listing or address source — and no real DC provider organization or contact number appears anywhere.

#### Scenario: Generated address maps within its ward
- **WHEN** a synthetic unit's address and coordinates are checked
- **THEN** the coordinates fall within the real boundary of the unit's ward, on the real street, quadrant, and ZIP of its address

#### Scenario: Building numbers are generated, not copied
- **WHEN** the generator samples a building number for a street
- **THEN** it draws from a plausible per-street range rather than any real listing or address source

#### Scenario: Ward coverage
- **WHEN** the synthetic dataset is generated
- **THEN** every ward 1–8 contains units

#### Scenario: No real-world confusion
- **WHEN** a user inspects any synthetic provider
- **THEN** the organization is fictional and carries non-real contact details
