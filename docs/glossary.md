# Domain glossary — dc-reentry-unlocked

The ubiquitous language of this project. Definitions are consolidated from
the capability specs in the in-repo OpenSpec planning workspace
(`openspec/`; run `openspec` commands from the repo root);
every term must stay consistent with them. Change a definition by changing
the spec first, then this file.

## Provider

The contact-bearing organization at the top of the inventory hierarchy. A
provider owns contact fields (organization, program, phone, email, website,
application process) reachable from its units. In the synthetic prototype,
providers are fictional and never carry real contact details
(housing-inventory: "Provider (contact-bearing organization) … every program
with exactly one provider"; housing-inventory: "the organization is fictional
and carries non-real contact details").

## Program

The policy-bearing housing program — middle layer of the
Provider → Program → Unit hierarchy. A program owns the policy fields
(housing type, length of stay, population, gender, referral, sobriety,
background check, sex-offense restrictions, treatment, vouchers) displayed in
unit detail. Every unit belongs to exactly one program
(housing-inventory: "three-layer hierarchy: Provider … → Program
(policy-bearing housing program) → Unit"; housing-search-ui: "program
policies (referral, sobriety, background check, sex-offense restrictions,
treatment, vouchers, population, gender, length of stay)").

## Unit

The individually displayable housing unit — leaf of the hierarchy. A unit
carries id, address, bedrooms, size, cost, ward, quadrant, coordinates,
availability state, confirmation flag, and verification badge
(housing-inventory: "Unit (individually displayable housing unit)";
housing-inventory-api: "unit-level fields (id, address, bedrooms, size,
cost, ward, quadrant, coordinates, verification badge)"). Coordinates are
required and non-null on every unit — exact street addresses only.

## Availability state

The per-unit data concept — one of **available**, **not available**,
**unverified-availability** — distinct from the confirmation flag. Only
units whose availability state is available surface in API listings, map
pins, and card lists (housing-inventory: "a per-unit **availability state**
(available, not available, unverified-availability) … Only units whose
availability state is available SHALL be surfaced").

## Confirmation flag

For available units: whether availability was confirmed with the source.
Available-but-unconfirmed units remain listed, with the
confirmed-vs-needs-verification distinction carried as a displayable badge
field (housing-inventory: "for available units, a separate **confirmation
flag** … the confirmed-vs-needs-verification distinction is carried as a
displayable badge field").

## Verification badge

The display field carrying that confirmed-vs-needs-verification distinction
on unit cards and listings (housing-inventory-api: "unit-level fields (…,
verification badge)"; housing-search-ui: "the confirmed-vs-needs-verification
badge where applicable").

## Ward

The administrative DC geography carrying unit ward memberships (wards 1–8;
the synthetic dataset covers every ward, and ward is a multi-select filter
over the 8 wards) (housing-inventory: "every ward 1–8 contains units";
dynamic-filtering: select "Ward 5" scenario).

## Filter schema

The machine-readable, backend-published list of filter definitions — each
with at minimum an id, display label, control type, target field, and option
list where applicable. It is the single source of truth for what filters
exist; the frontend renders filters entirely from it, with no hardcoded
filter knowledge (housing-inventory-api: "a machine-readable filter schema:
a list of filter definitions, each with at minimum an id, display label,
control type, target field, and option list"; dynamic-filtering: "The filter
UI SHALL be rendered entirely from the backend-published filter schema").

## Control type

The kind of filter control a filter definition declares. The initial
supported vocabulary is exactly: **boolean** (yes/no), **single-select**,
**multi-select** (chips). Definitions with unsupported control types
degrade gracefully — hidden or value shown raw — never a crash
(housing-inventory-api: "The filter schema's control vocabulary SHALL
initially include exactly: boolean (yes/no), single-select, and
multi-select"; dynamic-filtering: "A filter definition needing an
unsupported control type … SHALL degrade gracefully").

## Unknown state

**Unknown** — a representable state on every policy/eligibility field,
meaning the source has not publicly supplied the value, distinct from yes
and no, never fabricated into either. Detail views display it honestly. On
**boolean** filters unknown matches "no" selections; on **enum** filters
unknown matches every value selection while carrying a "**policy not
listed**" **marker** on the result so the case manager knows to confirm
with the provider (housing-inventory: "an unknown state, meaning the
source has not publicly supplied the value, distinct from yes and no";
housing-inventory-api: "boolean filters match unknown values against \"no\"
selections, and enum filters match unknown values against every value
selection while carrying a \"policy not listed\" marker").

## Synthetic data

The inventory content: generated on real Washington DC geography with
fictional providers and generated building numbers — coordinates fall within
the correct ward, on its real street, quadrant, and ZIP; never copied from
any real listing or address source; every ward 1–8 contains units. The
prototype banner keeps synthetic data unmistakable
(housing-inventory: "Synthetic prototype data … Generation provenance
guarantees no real listings"; housing-search-ui: "Persistent … banner
identifying the app as a prototype using synthetic data").
