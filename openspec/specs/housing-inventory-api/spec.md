# housing-inventory-api Specification

## Purpose
Defines the HTTP API that serves available housing units and the filter schema — the stable seam between the evolving data model and the frontend, and the future foundation for external consumers (web MCP/API, ingestion pipeline).

## Requirements

### Requirement: Available units listing

The API SHALL serve currently-available units as flattened unit cards: unit-level fields (id, address, bedrooms, size, cost, ward, quadrant, coordinates, verification badge) joined with the owning program's policy fields and provider's contact fields. Every served card SHALL carry exact coordinates. Unavailable units SHALL be excluded.

#### Scenario: Card payload is self-contained
- **WHEN** a consumer fetches the units listing
- **THEN** each returned unit card carries unit specs, program policies, and provider contact details with no further requests required

### Requirement: Filter schema endpoint

The API SHALL publish a machine-readable filter schema: a list of filter definitions, each with at minimum an id, display label, control type, target field, and option list where applicable. The schema SHALL be the single source of truth for what filters exist.

#### Scenario: Schema drives the UI
- **WHEN** the filter schema endpoint returns the filter definitions
- **THEN** a consumer can render the complete filter UI from the schema alone, with no hardcoded filter knowledge

### Requirement: Controlled control types

The filter schema's control vocabulary SHALL initially include exactly: boolean (yes/no), single-select, and multi-select. Definitions using an unknown control type SHALL be treated as unsupported by consumers (see dynamic-filtering degradation), not as a contract violation.

#### Scenario: Schema adds a boolean filter
- **WHEN** a new filter definition with control type boolean appears in the schema
- **THEN** consumers render it as a filter with no code change or redeploy

### Requirement: Filtered queries

The API SHALL accept filter selections against the units listing and return only matching available units, with two distinct unknown-at-source semantics by control type: boolean filters match unknown values against "no" selections, and enum filters match unknown values against every value selection while carrying a "policy not listed" marker. In both cases the detail data retains the honest unknown state.

#### Scenario: Boolean filter with unknown source value
- **WHEN** a user filters "referral required = no" and a program's referral policy is unknown at the source
- **THEN** that program's available units are included in results, and their detail view still shows "Unknown"

#### Scenario: Enum filter with unknown source value
- **WHEN** a user filters "population = families" and a program's population served is unknown at the source
- **THEN** the program's available units are included in results, marked "policy not listed" on population, so the case manager knows to confirm with the provider

### Requirement: Stable, evolvable contract

The API contract SHALL remain stable across data model evolution: additive changes (new fields, new enum values, new filters using existing control types) MUST NOT break existing frontend consumers. Breaking contract changes SHALL be versioned.

#### Scenario: Additive schema evolution
- **WHEN** the backend adds a new enum value or a new schema-driven filter
- **THEN** a frontend consumer built before the change renders correctly without redeploy

### Requirement: OpenAPI document

The API SHALL publish a machine-readable OpenAPI document generated from the route schemas (the shared TypeBox contracts), at a documented JSON endpoint. The document SHALL be generated from the same schemas that validate and serialize requests and responses, so it stays consistent with the implemented API by construction rather than by manual maintenance. The document SHALL cover the units, filters, and health endpoints, including error-envelope response shapes.

#### Scenario: Consumer fetches the API contract
- **WHEN** a consumer fetches the OpenAPI document endpoint
- **THEN** it receives a valid OpenAPI 3.x document describing the available endpoints, their query parameters, and the success and error response schemas, with no hand-maintained copy to drift from the implementation

### Requirement: Error responses

The API SHALL return standard, distinguishable error responses (including not found and service unavailable) with stable status codes, and SHALL log diagnostic detail server-side rather than exposing internal errors to consumers.

#### Scenario: Service degraded
- **WHEN** the API is temporarily unreachable
- **THEN** it returns a distinguishable error response, and the frontend can present a retry affordance rather than a crash
