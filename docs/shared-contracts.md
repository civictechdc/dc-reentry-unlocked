# Shared contracts — `packages/shared`

`packages/shared` is the API contract: TypeBox schemas that produce both TS
types and JSON Schema, so frontend, API, and the data generator share one
source of truth. Validation runs through `Value` (re-exported from the
package, so consumers take no second dependency): `Value.Check(schema,
value)`. Unit cards and API envelopes carry `schemaVersion` (`SCHEMA_VERSION`,
currently `"1.0"`); contract changes are additive-first — new fields and enum
values must be ignorable by old consumers, and breaking changes are versioned.

## Example 1 — Entity schemas (Provider → Program → Unit)

The inventory is a three-layer hierarchy: every program owns its policy
fields, every provider owns its contact fields, every unit belongs to exactly
one of each.

```ts
import { ProgramSchema, ProviderSchema, UnitSchema, Value } from "@dc-reentry/shared";

Value.Check(ProviderSchema, someProvider); // true when it is a valid provider
Value.Check(ProgramSchema, someProgram); // true when it is a valid program
Value.Check(UnitSchema, someUnit); // true for ANY availability state —
// gating "only available units surface" happens in the API data layer
```

## Example 2 — The flattened unit card

A `UnitCard` joins unit fields with the owning program's policies and the
provider's contacts — a consumer needs no further lookups. Location
precision is first-class: `locationPrecision` is `exact` or `approximate`
("fully representable, never missing" — approximate cards carry
`coordinates: null` and resolve their map placement from the ward). Unit
size is square footage plus room type. The `verificationBadge` carries
confirmed vs needs-verification for available units.

Each card also carries `availabilityState` and `availabilityConfirmed` — a
deliberate additive contract decision: `availabilityState` makes the
only-available-units invariant wire-checkable (a consumer can assert every
served card is `available`), and `availabilityConfirmed` is 1:1 with the
verification badge. Both were added after the first revision, which is safe:
additive fields are ignorable by old consumers.

```ts
import { UnitCardSchema, Value, type UnitCard } from "@dc-reentry/shared";

const validCard: UnitCard = fetchedFromApi();
Value.Check(UnitCardSchema, validCard); // true when the payload conforms
```

## Example 3 — Derived TS types

Every schema ships a `Static`-derived type with the same name.

```ts
import type { Provider, Program, Unit, UnitCard } from "@dc-reentry/shared";
```

## Example 4 — Unknown semantics

Every policy/eligibility field supports unknown: the tri-state policy fields
and the enumerated eligibility fields (housing type, length of stay,
population, gender) all carry the same `"unknown"` literal. Unknown means
"not publicly listed" — never fabricated. Filter matching honors this at the
API layer: boolean filters match unknown against "no" selections; enum
filters match unknown against every value selection. Detail data always
retains the honest unknown — a card's own `"unknown"` value (on a policy
field or an eligibility field) IS the machine-readable "policy not listed"
marker. Unknown is a data state only; the filter option lists stay the
pinned taxonomies.

```ts
import { PolicyStateSchema, Value } from "@dc-reentry/shared";

Value.Check(PolicyStateSchema, "unknown"); // true
Value.Check(PolicyStateSchema, "yes"); // true
Value.Check(PolicyStateSchema, "perhaps"); // false
```

## Example 5 — Taxonomies

The enumerated program taxonomies are exported data; filter option lists are
pinned to them.

```ts
import {
  GENDERS,
  HOUSING_TYPES,
  LENGTHS_OF_STAY,
  POPULATIONS,
  QUADRANTS,
  ROOM_TYPES,
} from "@dc-reentry/shared";

// e.g. HOUSING_TYPES = ["emergency-shelter", "transitional",
//   "permanent-supportive-housing", "subsidized-rental", "market-rate"]
```

## Example 6 — Filter schema contract

The published filter schema is the single source of truth for what filters
exist: 11 definitions over three control types (4 single-select enums, 1
multi-select ward filter, 6 boolean policy filters). Renderers stay generic
over `FILTER_CONTROLS`; definitions use a `FILTER_TARGETS` field reference.

```ts
import { FilterDefinitionSchema, UNIT_FILTERS, Value } from "@dc-reentry/shared";

UNIT_FILTERS.length; // 11
Value.Check(FilterDefinitionSchema, UNIT_FILTERS[0]!); // true
```

## Example 7 — API envelopes

Typed response envelopes with machine-readable error codes (stable across
status-code evolution; the API logs internal detail server-side, never in
the envelope).

```ts
import {
  ErrorCodeSchema,
  ErrorEnvelopeSchema,
  FilterSchemaResponseSchema,
  UnitsResponseSchema,
  Value,
} from "@dc-reentry/shared";

Value.Check(UnitsResponseSchema, payloadFromApi);
Value.Check(FilterSchemaResponseSchema, schemaPayloadFromApi);
Value.Check(ErrorEnvelopeSchema, errorFromApi); // code is one of the ERROR_CODES
```

## Example 8 — Test-only domain builders

Test code arranges fixtures through fluent builders from a test-only subpath
(enforced by `pnpm arch:check` — production code must never import it).

```ts
import { aProvider, aProgram, aUnit } from "@dc-reentry/shared/testing";

const unit = aUnit().inWard(5).withUnknownSobrietyPolicy().build();
```
