# Proposal

## Why

Returning citizens in Washington DC and the case managers helping them have no single place to answer: "where is a housing unit this person is actually eligible for, and who do I call?" Housing information is scattered across provider websites, PDFs, and phone calls. This change builds the first working prototype — an evolvable, display-only web application showing available housing units on an interactive map and card list, filterable by eligibility criteria, on synthetic data that mirrors the real provider → program → unit structure.

## What Changes

- **New greenfield project** — frontend/backend split (Svelte + TypeScript front, TypeScript backend), repo scaffolding, CI, validation gates, pre-commit hooks, IDE settings, agentic rules (per project brief)
- **Housing inventory data model** — versioned, city-agnostic `Provider → Program → Unit` spec with availability states, location precision (exact address vs ward/corridor), and a synthetic data generator (fictional providers, generated addresses on real DC geography spread across all 8 wards, geocoding-accurate)
- **Housing inventory API** — serves flattened available-unit cards and a machine-readable filter schema; the stable seam that lets the data model evolve without frontend disruption
- **Dynamic filtering** — 11 filters rendered from the backend-published schema (boolean / single-select / multi-select renderers); filter changes are backend data changes, not frontend releases; unknown values degrade gracefully
- **Housing search UI** — map + card list layout, slide-over unit detail with provider contact block, mobile Map/List tabs + bottom-sheet detail, civic clean light theme, WCAG AA, i18n-ready, performance targets (fast load, 60fps map)
- **Explicit non-goals:** no accounts, no saved searches, no in-app applications, no provider-submission UI, no analytics, no production ingestion — architecture leaves room for all of these (provider inventory pipeline, ingestion pipeline, web MCP/API, OpenTelemetry analytics, multi-city spec adoption)

## Capabilities

### New Capabilities
- `housing-inventory`: the housing unit data model spec, availability gating (only available units are surfaced), location precision, and synthetic DC data generation
- `housing-inventory-api`: the HTTP API serving available units and the filter schema as the stable frontend/backend contract
- `dynamic-filtering`: schema-driven filter system — backend-published filter definitions, generic frontend renderers, map/card synchronization, graceful degradation on unknown schema values
- `housing-search-ui`: the user-facing display application — map + cards, unit detail with contact information, responsive/mobile behavior, accessibility, i18n readiness, performance

### Modified Capabilities
<!-- None — greenfield project, no existing specs. -->

## Impact

- **Code:** entire new codebase (monorepo layout to be decided in design): backend service, frontend app, data generator, shared types
- **APIs:** new public-facing REST/JSON API (units, filter schema) — future external consumers (web MCP/API, ingestion pipeline) will build on this boundary
- **Dependencies:** Svelte, TypeScript, map library, backend framework, persistence — chosen in design with user, one-by-one
- **Systems:** CI pipeline (PR + merge checks), pre-commit hooks, deployment target — all greenfield, decided in design
- **Docs:** human-facing and agentic documentation structure, system diagrams — created with the scaffold
