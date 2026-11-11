# Spec Delta

## MODIFIED Requirements

### Requirement: Filtered queries

The API SHALL accept filter selections against the units listing and return only matching available units, with two distinct unknown-at-source semantics by control type: boolean filters match unknown values against "no" selections, and enum filters match unknown values against every value selection while carrying a "policy not listed" marker. In both cases the detail data retains the honest unknown state.

#### Scenario: Boolean filter with unknown source value
- **WHEN** a user filters "referral required = no" and a program's referral policy is unknown at the source
- **THEN** that program's available units are included in results, and their detail view still shows "Unknown"

#### Scenario: Enum filter with unknown source value
- **WHEN** a user filters "population = families" and a program's population served is unknown at the source
- **THEN** the program's available units are included in results, marked "policy not listed" on population, so the case manager knows to confirm with the provider
