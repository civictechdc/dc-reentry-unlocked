# Data model reference

> **Generated file — do not hand-edit.** This reference is rendered from
> the TypeBox schemas in `packages/shared`, the contract's source of
> truth; hand edits will be overwritten by the next regeneration.
> Regenerate with `pnpm docgen:model` and commit the result.

Schema version: `0.2`

## Coordinates

Exact street-level coordinates for a unit's location — required and non-null on every unit and card (exact addresses only; the approximate-location representation was removed in the 2026-10-31 revision, user decision).

| Field | Type | Required | Constraints | Description |
| --- | --- | --- | --- | --- |
| `latitude` | number | required |  | Latitude in decimal degrees. |
| `longitude` | number | required |  | Longitude in decimal degrees. |

## Provider

Housing provider: the contact-bearing organization at the top of the Provider → Program → Unit hierarchy. A missing contact field is absent — never fabricated.

| Field | Type | Required | Constraints | Description |
| --- | --- | --- | --- | --- |
| `id` | string | required |  | Stable provider identifier. |
| `organization` | string | required |  | Organization name shown as the contact. |
| `phone` | string | optional |  | Contact phone, when the source states it. |
| `email` | string | optional |  | Contact email, when the source states it. |
| `website` | string | optional | pattern `^https?://` | Contact website URL (http/https), when the source states it. |

## Program

Housing program: the policy-bearing layer between provider and unit. Every eligibility/policy field carries the unknown state ("Unknown") — tri-state for the policy fields, taxonomy + "unknown" for the enumerated eligibility fields. Unknown is never fabricated as yes/no.

| Field | Type | Required | Constraints | Description |
| --- | --- | --- | --- | --- |
| `id` | string | required |  | Stable program identifier. |
| `name` | string | required |  | Program name shown in the detail contact block. |
| `applicationProcess` | string | optional |  | How the application process works, when the source states it. |
| `housingType` | enum | required | `emergency-shelter` (Emergency shelter.) · `transitional` (Transitional housing.) · `permanent-supportive-housing` (Permanent supportive housing.) · `subsidized-rental` (Subsidized rental.) · `market-rate` (Market-rate housing.) · `unknown` (The honest unknown — never a fabricated value.) | Housing type: a taxonomy value, or "unknown" (the honest "Unknown"). |
| `lengthOfStay` | enum | required | `emergency-nightly` (Emergency shelter, priced nightly.) · `short-term-up-to-90-days` (Short-term stay, up to 90 days.) · `transitional-up-to-24-months` (Transitional stay, up to 24 months.) · `permanent-open-ended` (Permanent housing, open-ended.) · `unknown` (The honest unknown — never a fabricated value.) | Length of stay: a taxonomy value, or "unknown" (the honest "Unknown"). |
| `population` | enum | required | `individuals` (Individuals.) · `families` (Families.) · `both` (Both individuals and families.) · `unknown` (The honest unknown — never a fabricated value.) | Population served: a taxonomy value, or "unknown" (the honest "Unknown"). |
| `gender` | enum | required | `men` (Men.) · `women` (Women.) · `all` (All genders.) · `unknown` (The honest unknown — never a fabricated value.) | Gender served: a taxonomy value, or "unknown" (the honest "Unknown"). |
| `referralRequired` | enum | required | `yes` (The policy applies.) · `no` (The policy does not apply.) · `unknown` (Unknown — never fabricated as yes or no.) | Tri-state policy value: known yes / known no / unknown ("Unknown"). |
| `sobrietyRequired` | enum | required | `yes` (The policy applies.) · `no` (The policy does not apply.) · `unknown` (Unknown — never fabricated as yes or no.) | Tri-state policy value: known yes / known no / unknown ("Unknown"). |
| `backgroundCheckRequired` | enum | required | `yes` (The policy applies.) · `no` (The policy does not apply.) · `unknown` (Unknown — never fabricated as yes or no.) | Tri-state policy value: known yes / known no / unknown ("Unknown"). |
| `sexOffenseRestrictions` | enum | required | `yes` (The policy applies.) · `no` (The policy does not apply.) · `unknown` (Unknown — never fabricated as yes or no.) | Tri-state policy value: known yes / known no / unknown ("Unknown"). |
| `treatmentRequired` | enum | required | `yes` (The policy applies.) · `no` (The policy does not apply.) · `unknown` (Unknown — never fabricated as yes or no.) | Tri-state policy value: known yes / known no / unknown ("Unknown"). |
| `housingVouchersAccepted` | enum | required | `yes` (The policy applies.) · `no` (The policy does not apply.) · `unknown` (Unknown — never fabricated as yes or no.) | Tri-state policy value: known yes / known no / unknown ("Unknown"). |

## UnitSize

Physical unit size: square footage plus room type.

| Field | Type | Required | Constraints | Description |
| --- | --- | --- | --- | --- |
| `squareFeet` | number | required |  | Floor area in square feet. |
| `roomType` | enum | required | `private-room` (Private room.) · `shared-room` (Shared room.) · `efficiency` (Efficiency unit.) · `apartment` (Full apartment.) | Room type alongside square footage. |

## Unit

A housing unit in the full inventory — every availability state is representable. Only units whose availability state is `available` surface (that gating happens in the DataSource/API layer, not here).

| Field | Type | Required | Constraints | Description |
| --- | --- | --- | --- | --- |
| `id` | string | required |  | Stable unit identifier. |
| `programId` | string | required |  | Identifier of the owning program. |
| `address` | string | required | minLength 1 | Exact street address (never empty; exact addresses only). |
| `ward` | integer | required | minimum 1 · maximum 8 | DC ward number, 1–8; the synthetic dataset covers every ward. |
| `quadrant` | enum | required | `NW` (Northwest.) · `NE` (Northeast.) · `SW` (Southwest.) · `SE` (Southeast.) | DC address quadrant. |
| `coordinates` | object — see [Coordinates](#coordinates) | required |  |  |
| `bedrooms` | number | required |  | Bedroom count. |
| `size` | object — see [UnitSize](#unitsize) | required |  |  |
| `cost` | number | required |  | Monthly cost to the returning citizen (rent portion). |
| `availabilityState` | enum | required | `available` (The unit is available.) · `not-available` (The unit is not available.) · `unverified-availability` (Availability has not been verified with the source.) | Per-unit availability state. Only `available` units ever surface — that gating is the DataSource/API layer's job, but the schema represents every state. |
| `availabilityConfirmed` | boolean | required |  | Whether availability was confirmed with the source. |

## UnitCard

The flattened self-contained unit card: unit fields joined with the owning program's policy fields and the provider's contact fields, so a consumer needs no further lookups. Carried only by available units (DataSource/API gating); the verification badge exposes source-confirmation status.

| Field | Type | Required | Constraints | Description |
| --- | --- | --- | --- | --- |
| `schemaVersion` | string | required | const "0.2" | The shared-contract schema version this payload speaks. |
| `id` | string | required |  | Stable unit identifier. |
| `programId` | string | required |  | Identifier of the owning program. |
| `address` | string | required | minLength 1 | Exact street address (never empty; exact addresses only). |
| `ward` | integer | required | minimum 1 · maximum 8 | DC ward number, 1–8; the synthetic dataset covers every ward. |
| `quadrant` | enum | required | `NW` (Northwest.) · `NE` (Northeast.) · `SW` (Southwest.) · `SE` (Southeast.) | DC address quadrant. |
| `coordinates` | object — see [Coordinates](#coordinates) | required |  |  |
| `bedrooms` | number | required |  | Bedroom count. |
| `size` | object — see [UnitSize](#unitsize) | required |  |  |
| `cost` | number | required |  | Monthly cost to the returning citizen (rent portion). |
| `availabilityState` | enum | required | `available` (The unit is available.) · `not-available` (The unit is not available.) · `unverified-availability` (Availability has not been verified with the source.) | Per-unit availability state. Only `available` units ever surface — that gating is the DataSource/API layer's job, but the schema represents every state. |
| `availabilityConfirmed` | boolean | required |  | Whether availability was confirmed with the source (1:1 with the badge). |
| `verificationBadge` | enum | required | `confirmed` (Availability was confirmed with the source.) · `needs-verification` (Availability still needs verification.) | Displayable confirmation badge for available units. |
| `program` | object — see [Program](#program) | required |  |  |
| `provider` | object — see [Provider](#provider) | required |  |  |

Worked example:

```json
{
  "schemaVersion": "0.2",
  "id": "u-1001",
  "programId": "p-2001",
  "address": "1234 Example Street NW",
  "ward": 5,
  "quadrant": "NW",
  "coordinates": {
    "latitude": 38.913,
    "longitude": -77.032
  },
  "bedrooms": 1,
  "size": {
    "squareFeet": 350,
    "roomType": "private-room"
  },
  "cost": 850,
  "availabilityState": "available",
  "availabilityConfirmed": true,
  "verificationBadge": "confirmed",
  "program": {
    "id": "p-2001",
    "name": "Example Reentry Housing Program",
    "applicationProcess": "Call the office to schedule an intake interview.",
    "housingType": "transitional",
    "lengthOfStay": "transitional-up-to-24-months",
    "population": "both",
    "gender": "all",
    "referralRequired": "no",
    "sobrietyRequired": "unknown",
    "backgroundCheckRequired": "yes",
    "sexOffenseRestrictions": "yes",
    "treatmentRequired": "no",
    "housingVouchersAccepted": "unknown"
  },
  "provider": {
    "id": "v-3001",
    "organization": "Example Housing Provider DC",
    "phone": "202-555-0100",
    "email": "intake@example.org",
    "website": "https://example.org"
  }
}
```

## FilterControl

The kind of filter control a definition declares.

| Value | Meaning |
| --- | --- |
| `boolean` | Yes/no control (unknown values match "no" selections). |
| `single-select` | One value from the option list. |
| `multi-select` | Multiple values from the option list (chips). |

## FilterOption

Human display pairing for an enumeration option.

| Field | Type | Required | Constraints | Description |
| --- | --- | --- | --- | --- |
| `value` | string | required |  | The machine value the filter matches on. |
| `label` | string | required |  | The display label. |

## FilterTarget

The field a filter definition targets (pinned vocabulary — new fields extend it).

| Value |
| --- |
| `unit.ward` |
| `program.housingType` |
| `program.lengthOfStay` |
| `program.population` |
| `program.gender` |
| `program.referralRequired` |
| `program.sobrietyRequired` |
| `program.backgroundCheckRequired` |
| `program.sexOffenseRestrictions` |
| `program.treatmentRequired` |
| `program.housingVouchersAccepted` |

## FilterDefinition

One published filter definition: id, display label, control type, target field, and option list where applicable.

| Field | Type | Required | Constraints | Description |
| --- | --- | --- | --- | --- |
| `id` | string | required |  | Stable filter identifier. |
| `label` | string | required |  | Display label. |
| `control` | enum | required | `boolean` (Yes/no control (unknown values match "no" selections).) · `single-select` (One value from the option list.) · `multi-select` (Multiple values from the option list (chips).) | The kind of filter control a definition declares. |
| `target` | enum | required | `unit.ward` · `program.housingType` · `program.lengthOfStay` · `program.population` · `program.gender` · `program.referralRequired` · `program.sobrietyRequired` · `program.backgroundCheckRequired` · `program.sexOffenseRestrictions` · `program.treatmentRequired` · `program.housingVouchersAccepted` | The field a filter definition targets (pinned vocabulary — new fields extend it). |
| `options` | array of object — see [FilterOption](#filteroption) | optional |  | Option list for enum controls; absent for boolean filters. |

## Filters

The pinned filter set — exactly these definitions are published by the filter-schema endpoint; renderers stay generic over the control vocabulary.

| Id | Label | Control | Target | Options |
| --- | --- | --- | --- | --- |
| `housing-type` | Housing type | `single-select` | `program.housingType` | `emergency-shelter` → Emergency shelter · `transitional` → Transitional · `permanent-supportive-housing` → Permanent supportive housing · `subsidized-rental` → Subsidized rental · `market-rate` → Market-rate |
| `length-of-stay` | Length of stay | `single-select` | `program.lengthOfStay` | `emergency-nightly` → Emergency (nightly) · `short-term-up-to-90-days` → Short-term (up to 90 days) · `transitional-up-to-24-months` → Transitional (up to 24 months) · `permanent-open-ended` → Permanent (open-ended) |
| `population` | Population served | `single-select` | `program.population` | `individuals` → Individuals · `families` → Families · `both` → Both |
| `gender` | Gender | `single-select` | `program.gender` | `men` → Men · `women` → Women · `all` → All |
| `ward` | Ward | `multi-select` | `unit.ward` | `1` → Ward 1 · `2` → Ward 2 · `3` → Ward 3 · `4` → Ward 4 · `5` → Ward 5 · `6` → Ward 6 · `7` → Ward 7 · `8` → Ward 8 |
| `referral-required` | Referral required | `boolean` | `program.referralRequired` | — |
| `sobriety` | Sobriety required | `boolean` | `program.sobrietyRequired` | — |
| `background-check` | Background check | `boolean` | `program.backgroundCheckRequired` | — |
| `sex-offense-restrictions` | Sex-offense restrictions | `boolean` | `program.sexOffenseRestrictions` | — |
| `treatment` | Treatment required | `boolean` | `program.treatmentRequired` | — |
| `housing-vouchers` | Housing vouchers accepted | `boolean` | `program.housingVouchersAccepted` | — |

## UnitsResponse

Successful units listing (only available units reach this envelope). Both synthetic markers are required on every payload: the API surface is read-only and its data must never be mistakable for real housing inventory.

| Field | Type | Required | Constraints | Description |
| --- | --- | --- | --- | --- |
| `schemaVersion` | string | required | const "0.2" | The shared-contract schema version this payload speaks. |
| `synthetic` | boolean | required | const true | Hard marker: this payload describes fictional data only. |
| `disclosure` | string | required | minLength 1 | The one-sentence synthetic-data disclaimer, verbatim from the dataset. |
| `units` | array of object — see [UnitCard](#unitcard) | required |  | The available unit cards (only available units reach this envelope). |

## FilterSchemaResponse

Successful filter-schema response: the published list of filter definitions.

| Field | Type | Required | Constraints | Description |
| --- | --- | --- | --- | --- |
| `schemaVersion` | string | required | const "0.2" | The shared-contract schema version this payload speaks. |
| `filters` | array of object — see [FilterDefinition](#filterdefinition) | required |  | The published filter definitions — the single source of truth for what filters exist. |

## ErrorEnvelope

Stable error envelope: machine code + human message + correlation id. Internal diagnostic detail is logged server-side, never exposed in the envelope.

| Field | Type | Required | Constraints | Description |
| --- | --- | --- | --- | --- |
| `schemaVersion` | string | required | const "0.2" | The shared-contract schema version this payload speaks. |
| `code` | enum | required | `not-found` (Unknown route (there is no per-unit detail view on this listing API yet).) · `service-unavailable` (The API cannot serve the data right now — safe to retry later.) · `invalid-filter` (A filter name or value the published filter schema does not define.) · `invalid-request` (A malformed request that is not a filter problem.) · `internal-error` (Something failed server-side; detail stays in server logs.) · `rate-limited` (Too many requests — slow down, and honor the Retry-After response header.) | Stable machine-readable error codes — status codes may evolve, these identifiers are the consumer-stable vocabulary. Additive-only: new codes must never break an existing consumer's switch, so unknown codes degrade to a generic failure rendering. |
| `message` | string | required |  | Human-readable error message. |
| `correlationId` | string | optional |  | Correlation id echoed into structured request logs, so bug reports stay traceable. |

Worked example:

```json
{
  "schemaVersion": "0.2",
  "code": "not-found",
  "message": "Unit not found.",
  "correlationId": "req-7f3a9c"
}
```

## Error codes

Stable machine-readable error codes — status codes may evolve, these identifiers are the consumer-stable vocabulary. Additive-only: new codes must never break an existing consumer's switch, so unknown codes degrade to a generic failure rendering.

| Value | Meaning |
| --- | --- |
| `not-found` | Unknown route (there is no per-unit detail view on this listing API yet). |
| `service-unavailable` | The API cannot serve the data right now — safe to retry later. |
| `invalid-filter` | A filter name or value the published filter schema does not define. |
| `invalid-request` | A malformed request that is not a filter problem. |
| `internal-error` | Something failed server-side; detail stays in server logs. |
| `rate-limited` | Too many requests — slow down, and honor the Retry-After response header. |
