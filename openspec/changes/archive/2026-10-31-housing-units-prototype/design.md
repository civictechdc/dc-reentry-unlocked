# Design

## Context

The repo uses a bare-repo + worktree arrangement (`.bare` + `.worktrees/`) which is **preserved as-is** — the monorepo scaffolds into the existing main worktree. A prior single-package Vite+Leaflet prototype lives in `web-app/` on main; it is cleared by task 1.1 (history preserved), superseded by this design. Requirements live in the proposal and the four capability specs; the approved product design is `docs/superpowers/specs/2026-10-28-dc-reentry-housing-prototype-design.md`. This document covers how: stack, repo architecture, data flow, and the build/validation/CI configuration the project brief demands.

All stack decisions below were walked through with the user one-by-one during planning (question rounds recorded in the planning session) and are settled unless marked otherwise; the product design doc's Stack section is synced to point here. Facts verified against current docs (pnpm workspaces, oxfmt beta status, Git 2.54 config-based hooks, TypeScript 7/7.1 native compiler status, dependency-cruiser/StrykerJS/ArchUnitTS parser dependencies, playwright-bdd, fast-check Vitest integration).

## Goals / Non-Goals

**Goals:**
- A display prototype: map + cards of available synthetic DC housing units, schema-driven filtering, detail panel ending at provider contact info
- The API boundary as the stable seam: data model and filter set can change without frontend releases
- Project infrastructure from day one: CI gates, validation, hooks, IDE settings, agentic rules, docs structure
- Cheap replacement points for every piece the future roadmap replaces (ingestion pipeline, real data, analytics, MCP/API, other cities)

**Non-Goals:**
- Production data ingestion, accounts, saved searches, application flows, analytics, provider UI (see proposal non-goals)
- Cloud deployment (compose-local only, deployable later)
- Publishing packages to any registry

## Decisions

### D1 — Monorepo: standard workspaces, pnpm canonical
Repo layout:
```
apps/web          # SvelteKit frontend
apps/api          # Fastify backend
packages/shared   # types + schemas: unit card, filter schema, API contracts
tools/datagen     # synthetic data generator (writes dataset JSON)
docs/             # human-facing docs; openspec/ holds agentic spec workflow
```
Root `package.json` declares `workspaces` (npm + bun native); a committed `pnpm-workspace.yaml` with identical patterns makes pnpm deterministic (pnpm reads only `pnpm-workspace.yaml`, and auto-creates it from `workspaces` when absent). **One canonical lockfile: pnpm** — CI installs with pnpm; npm/bun work locally.
*Alternatives:* npm-only (slower CI), bun-only (newer lockfile risk), Turborepo (build orchestration overkill at this size).

**Module organization note (brief asked for "vertical modules"):** workspaces split by technical layer, and within each app modules are organized capability-aligned (the four spec capabilities map to module boundaries inside web/api). Strict vertical feature-slicing is deferred until a second feature domain arrives (provider portal, analytics) — at this size, layer workspaces + capability-aligned internal modules + dependency-cruiser seam rules (D18) deliver the same boundary discipline with less ceremony. Recorded as a documented supersession of the brief's wording.

### D2 — Frontend: SvelteKit 2, Svelte 5 runes, SPA mode
SvelteKit with adapter-node, **SPA mode** (`ssr = false`, prerendered error/404 routes) — static shell served fast, all data fetched client-side from the API; no server-template rendering dependency. Svelte 5 runes ($state/$derived) only — no legacy stores.
*Alternative:* SSR on (better first paint + SEO, but every request hits the Node server and loading states get more complex) — revisit if SEO/first-paint requirements ever matter for a display prototype.

### D3 — Backend: Fastify + TypeBox
Fastify with TypeBox schemas for request validation and response typing. TypeBox is the bridge: shared types in `packages/shared` are written as TypeBox schemas, producing both TS types and JSON Schema for Fastify validation — single source of truth for the API contract. The same route schemas feed a served, generated OpenAPI 3.x document (JSON endpoint) — the machine-readable contract for future external consumers (web MCP/API, ingestion pipeline), consistent with the implemented routes by construction (added at apply time, user request 2026-10-29).
*Alternatives:* Hono (lighter, more hand-assembly), Express (older patterns, validation glue), NestJS (heavyweight for a display API).

### D4 — Data serving: generated versioned JSON, in-memory query, swappable source
`tools/datagen` generates a versioned dataset file (e.g. `data/units.v1.json`) — providers → programs → units with joined card payloads. The API loads it at boot and filters in-memory (dataset is ≤ a few thousand units — trivial). All reads go through a `DataSource` module: the single seam the future ingestion pipeline/SQLite/Postgres replaces. Availability gating happens in this layer — only units whose availability state is `available` leave the data source (unverified-availability and not-available never surface).
**Filter-level unknown semantics (user decision):** boolean filters map unknown → "no"; enum filters (population, gender, housing type, length of stay) match unknown-valued units against every value selection, carrying a "policy not listed" marker — unlisted leads are never silently lost to a filter, and the marker keeps the list honest.
*Alternatives:* SQLite from day one (more moving parts, no benefit at this scale), Postgres (needs a service).

### D5 — Map: MapLibre GL JS rendering OpenStreetMap raster tiles
WebGL engine (60fps pan/zoom with many pins, free, no API key) rendering **OSM raster tiles** with required attribution, per user decision; tile source is a one-line swap (e.g., self-hosted Protomaps PMTiles when offline/production matters — engine unchanged). Svelte integration via a thin component wrapping maplibre-gl (no heavyweight wrapper lib). Pin perf: use GeoJSON source + symbol/circle layers rather than per-pin DOM markers; hover/click map to unit cards through the store.
*Alternative:* Leaflet — DOM markers jank past a few hundred pins; fails the 60fps requirement.

### D6 — Shared contract package
`packages/shared` exports TypeBox schemas + derived TS types for: unit card, filter schema (definition + control types enum), API request/response envelopes, error codes. `apps/web`, `apps/api`, `tools/datagen` all import it; contract drift is a compile error. API versioning field in payloads (`schemaVersion`).

### D7 — Lint/format: oxlint + oxfmt, ESLint for JSON
- **oxlint**: JS/TS linting (Svelte files linted via `<script>` blocks)
- **oxfmt**: formatter (beta, Prettier-compatible, 30× faster; formats JSON/JSONC/Markdown/Svelte — Svelte formatting needs the `svelte` package present and the option enabled)
- **ESLint + eslint-plugin-json**: plain JSON linting (oxlint does not lint JSON; oxfmt only formats it)
*Alternative:* ESLint + Prettier everywhere — the incumbent stack; user chose the Rust toolchain with the JSON exception.

### D8 — Hooks: native Git 2.54+ config-based hooks, no hook runner
Git 2.54 (Apr 2026) defines hooks in git config: `[hook "<name>"] event/command` entries, multiple commands per event, enable/disable per level. No Lefthook/husky dependency. Project checks in `git config` (distributed via a checked-in config include + setup docs): pre-commit runs oxfmt check + oxlint on staged files; pre-push runs typecheck; **commit-msg enforces Conventional Commits** (commitlint with `@commitlint/config-conventional`): messages take the `type(scope): subject` form — types from the conventional enum (`feat`, `fix`, `chore`, `ci`, `docs`, …), scope optional and aligned to workspace names (`api`, `web`, `shared`, `datagen`), e.g. `feat(shared): add unit card schema`, `chore(api): scaffold fastify app`. Requirements: git ≥ 2.54 locally — CI uses a modern runner image and verifies the version. Note: 2.54 runs hooks sequentially per event (2.55 brings parallel runs) — fine for this scale.
*Alternative:* Lefthook — no longer needed; user selected native.

### D9 — CI: GitHub Actions, PR + merge + manual full-suite workflow
Remote: the existing GitHub repo `civictechdc/dc-reentry-unlocked` (origin already configured; verify Actions is enabled on the org repo before first run). Playwright matrix: Chromium + WebKit + Firefox on desktop viewport plus Chromium mobile viewport (MapLibre is WebGL — cross-engine rendering matters). Full-suite workflow (complete e2e + `pnpm audit` + datagen determinism diff + StrykerJS mutation run) runs via **manual dispatch only** until the prototype stabilizes; a schedule can be added later without structural change.
- **PR checks:** install (pnpm, cached) → oxlint + ESLint(JSON) → oxfmt format-check → typecheck (all packages) → unit/integration tests (Vitest) → build (web + api) → OpenSpec validation (`openspec validate`)
- **PR e2e (Playwright):** boots compose stack (api + web), runs golden paths: load+map+cards, filter+sync, detail panel, mobile tabs, zero-results state
- **Merge to main:** same + build/push local docker images artifacts
- **Full-suite workflow (manual dispatch):** full e2e + `pnpm audit` dependency scan + link/data integrity check (dataset regeneration diff) + StrykerJS mutation run (per D10); schedule can be added later once the prototype stabilizes

### D10 — Testing: layered strategy — Vitest + fast-check + Playwright(+BDD) + StrykerJS
- **Vitest**: unit tests per package; API integration tests against the real Fastify instance (in-memory dataset); shared-schema round-trip tests (dataset validates against TypeBox schema)
- **fast-check (property-based, via `@fast-check/vitest`)**: properties where invariants matter — datagen (for-all-seeds: ward coverage, determinism, no real-provider collisions, schema conformance), API filter algebra (unknown→no mapping, filter idempotence, results-subset invariants, envelope conformance), shared contracts (schema round-trips). **Model-based testing** (`fc.commands` + `fc.modelRun`) for the filter-selection state machine (apply/remove/clear chips) — the behavioral core of the UI store. No TS-compiler-API runtime dependency; TS 7 safe
- **Playwright + playwright-bdd (behavioral/domain-driven)**: golden paths as **Gherkin feature files derived from the OpenSpec capability scenarios** (WHEN/THEN → Given/When/Then), `bddgen` generating standard Playwright tests — spec scenarios become executable acceptance tests with direct spec↔test traceability. Plus error paths (404, API-down banner), mobile viewport, a11y smoke (axe-core)
- **StrykerJS (mutation testing, nightly)**: `@stryker-mutator/vitest-runner` + `typescript-checker` (checker runs the TS compiler programmatic API → pinned to `@typescript/typescript6`, same caveat as D18). Scoped to `packages/shared`, `apps/api`, `tools/datagen` — the contract-bearing code agentic implementers touch most. Motivation per the mutation-testing-in-the-age-of-AI-agents argument: agentic code needs tests whose *quality* is verified, not just presence. Report-only initially; `thresholds.break` gate ratchets in once a baseline mutation score exists
- **Test-style doctrine (all layers):** tests read as domain language, not infrastructure. Unit/integration tests use **behavioral-sentence names** ("includes units with unknown referral policy when filtering no-referral"), bodies follow **Arrange-Act-Assert**, and the Given/When/Then structure is *philosophical, not literal* — no keyword ceremony outside Gherkin. Arrange is externalized: fluent domain builders (`aUnit().inWard(5).withUnknownSobrietyPolicy()`) live in a **test-only `testing` subpath export of packages/shared** so every workspace shares one set of domain-language fixtures with no drift; test bodies then read mostly as domain actions and observable outcomes. Gherkin keywords exist only in the e2e/acceptance layer, where they map OpenSpec scenarios 1:1.
- **Perf smoke**: scripted map interaction e2e asserting no long tasks / dropped-frame stall — **initial targets set now, measured and evaluated as development proceeds** (user decision): initial units payload ≤ ~500KB for ~1,000 units; first load (JS + shell + data) < 2s on a mid-tier connection; no long task > 50ms during map pan/zoom; pin re-render < 100ms per filter change. Budgets are revisable with evidence — every adjustment recorded alongside measurements. Warn-gate until the first baseline lands, then ratchets to a hard CI gate

### D11 — i18n readiness: externalized strings, English only
Strings externalized from day one via **Paraglide (inlang)** — compiler-based, tree-shaken messages, Svelte-native, no runtime cost per added language. No component-hardcoded user-facing strings; adding a language = adding a message catalog.

### D12 — Run: docker compose, local
`compose.yaml`: `api` (Fastify, node image), `web` (SvelteKit adapter-node image), optional `datagen` one-shot. `pnpm dev` runs native dev servers (Vite + Fastify dev) with hot reload for development without Docker. Deploy config (env vars, healthchecks, restart policies) written so any target (Fly/Render/VPS) is a later copy-paste.
*Alternative:* cloud deploy now — rejected (prototype scope).

### D13 — Error handling & observability (prototype level)
- API: stable error envelope (machine code + message), structured request logs (pino), no internal detail to clients
- Web: SvelteKit 404/500 pages in plain language; API-down banner + retry, retains last results; skeleton loaders
- Errors logged with correlation ids (passed through from API responses) so bug reports are traceable — the seed of the future OpenTelemetry story without adopting OTLP now

### D14 — Security posture (display-only prototype)
- No auth (by scope) but: strict input validation on all API query params (TypeBox), CSP + standard security headers on web responses, no secrets in repo, dependency audit in CI, rate-limit middleware on API (sane default), dataset served read-only
- Threat note: synthetic data must never be mistakable for real listings — enforced by the disclosure banner + fictional providers (spec requirement)

### D15 — TypeScript strategy: 7 as the standard, 6 pinned for Svelte, 7.1 migration later
TypeScript 7.0 (GA July 2026) is the Go-native compiler — 8-12x faster typecheck, less memory, parallel `--checkers`/`--builders`, shipped as the standard `typescript@^7` npm package. Verified status:
- **Works now** for pure-TS workspaces — `apps/api` (Fastify/TypeBox), `packages/shared`, `tools/datagen`. Typecheck gate runs the TS 7 `tsc` binary (the Go-native compiler itself; the preview-era `tsgo` binary name was dropped at GA).
- **Does not work for Svelte yet**: Svelte language tooling (svelte-check, Volar editor support) embeds the TS compiler via programmatic API, which TS 7.0 does not ship. Official guidance: Svelte projects stay on TS 6.0 via the side-by-side `@typescript/typescript6` package (`tsc6` binary + re-exported 6.0 API) until the ecosystem catches up.
- **TS 7.1 Beta (Oct 2026) ships the new API + content mappers** — Volar's model becomes first-class, and a Svelte content mapper is already prototyped in sveltejs/language-tools (tsconfig `contentMappers` + `tsc --runExternalCode`). 7.1 RC ~Nov 2026, GA expected ~Dec 2026.

Repo standard: root `typescript@^7`; `apps/web` pins `@typescript/typescript6` for svelte-check/editor support, with tsconfig defaults aligned to 7.0's expectations (strict, no `baseUrl`, `moduleResolution: bundler`) so the later 7.1 migration is mechanical. A dedicated follow-up task migrates web to TS 7.1 (content-mapper svelte-check) once 7.1 is stable and Svelte language-tools ship it.
*Alternatives:* TS 6 everywhere (forgoes the speedup and pins new code to the last JS-based release), TS 7.1 beta for web now (beta-grade toolchain in a fresh prototype — no).

### D16 — Scaffolding details
- `.zed/` and `.vscode/` settings (format-on-save via oxfmt, ESLint integration, recommended extensions list, task configs)
- `AGENTS.md` at root: dev style, architecture map, verification commands, review guidelines, docs organization — the cross-tool agent standard (opencode/codex/claude all read it); tool-specific bits stay in their own config dirs, local-only vs shared decided per file
- Docs: `docs/` human-facing (architecture diagram (Mermaid, generated), runbook, data model spec); agentic = `openspec/` + AGENTS.md; deterministically checkable docs (commands, diagrams, API examples) validated in CI where possible
- `.gitignore` covers node_modules, build output, `.superpowers/`, the entire `.agents/local/` directory, and the machine-local root file `AGENTS.local.md` (local-only brief + real-provider sample CSV + machine-local agent overrides — never tracked; if the local files were previously committed, task 1.8 also removes them from tracking); the frozen dataset under `data/` IS committed for reproducible CI (regeneration is deterministic with fixed seed)

### D17 — Agentic structure (hooks, skills, MCPs, token discipline, glossary)

Agent-facing scaffolding is part of this change, not a later add-on. **Execution order (user decision at apply time): the agentic-structure block is implemented immediately after repo scaffold, before product implementation**, so the agent sessions that build product code run with the hooks, skills, and rules already in place. AGENTS.md is created in that block (foundation + token rules + test-style doctrine) and finalized in the CI & documentation block once the codebase is complete:

- **Agent hooks (opencode, VS Code, Claude, Codex) — nudges, not gates:** deterministic enforcement lives ONLY at the git hook layer (D8: pre-commit, pre-push, commit-msg) — agent hooks deliberately do NOT duplicate those blocking checks (no double-running, no wasted tokens, no drift between two enforcement layers). What agent hooks carry instead is advisory, non-blocking nudges git cannot express: context/token discipline reminders (link-not-paste, tight subagent briefs), Conventional Commits guidance when drafting commit messages, spec/tasks-first reminders before improvising, the unknown-honesty rule when touching inventory/filter code, and a "run the task verification before claiming done" reminder. Nudges are delivered per platform via `writing-agent-hooks` conventions (PreToolUse/PostToolUse advisory message injection where supported: OpenCode plugin/config, VS Code tasks/settings, `.claude/settings.json`, Codex config), falling back to AGENTS.md rules where a platform can't carry prose. Editor format-on-save (VS Code, Zed) is editor UX, not an agent hook. Agents write commits in Conventional Commits format (D8 commit-msg gate enforces it); the convention with examples lives in AGENTS.md. Local-only vs shared: hooks live in version-controlled config files; machine-specific paths stay out.
- **Machine-local overrides:** a gitignored root `AGENTS.local.md`, if present, is read immediately after AGENTS.md — machine-specific paths, local lessons, per-block dispatch notes. AGENTS.md carries the reference rule and an agent-hook nudge points agents to it; nothing local is ever committed.
- **Project skills:** a project-orientation skill (architecture map, verification commands, domain rules) + a data-model reference skill, installed to `.agents/skills/` (universal adapter per project rules), so any agent gets on-context without re-reading the repo.
- **MCPs:** evaluate and document which dev-workflow MCPs are worth enabling (e.g. docs lookup, OpenSpec tooling); decisions recorded in AGENTS.md with the housing-data web MCP noted as a *product* future feature, not dev tooling.
- **Token-efficiency rules (in AGENTS.md):** curated subagent briefs (context needed, not exhaustive), fresh session per task block, link/point to docs instead of pasting files, deterministic commands over LLM guesswork, context budget per task.
- **Domain glossary:** `docs/glossary.md` — ubiquitous language (provider, program, unit, availability states, location precision, filter schema, control types, verification badge, unknown state), kept consistent with the specs.

### D18 — Architectural validation: dependency-cruiser as the ArchUnit equivalent
Architecture rules are executable checks, not prose. **dependency-cruiser** encodes the declared seams as declarative rules run via `pnpm arch:check`: `packages/shared` imports nothing from `apps/*`/`tools/*`; each app/tool imports only `packages/shared`; the shared test-only `testing` subpath (D10 domain builders) is imported only from test files; inside `apps/api`, routes reach data only through the `DataSource` module (never the dataset file directly — protects the future ingestion-pipeline seam); no cycles. Gate runs in pre-push hooks and CI alongside typecheck.
**TypeScript 7 caveat (verified):** dependency-cruiser's TS parsing uses the TypeScript compiler programmatic API (as does the ArchUnitTS alternative), which TS 7.0 does not ship — so arch tooling pins `@typescript/typescript6` as its parser dependency until the tools adopt TS 7.1's new API. Implementation note: dependency-cruiser 18.7 declares no `typescript` dependency (it requires it ad hoc at runtime), so the pin is a pnpm `packageExtensions` alias — `dependency-cruiser.optionalDependencies.typescript = npm:@typescript/typescript6@6.0.2` — resolving its runtime `typescript` to the pinned 6.x (pnpm overrides cannot rewrite undeclared deps); the cruise must run as `dependency-cruiser .` from repo root so rule paths stay anchored. Rule checking is unaffected: it validates the graph, not the typecheck.
*Alternatives:* **ArchUnitTS** (LukasNiessen — actively maintained, fluent rules-as-code, richer metrics: LCOM, cyclomatic, coupling, slices, PlantUML — revisit post-7.1 if code-quality gates are wanted; same TS7 parser caveat), eslint-plugin-boundaries (editor hints, no graph view), tsc project references (compile-time boundaries but no custom rules), Sherif (monorepo hygiene — would flag the intentional dual TypeScript versions).

## Risks / Trade-offs

- [oxfmt is beta] → pin exact version; oxfmt is Prettier-compatible so a fallback swap is mechanical; format-check gate catches drift
- [Git 2.54 hook configs are new] → require git ≥ 2.54 in setup docs + CI version check; if a contributor's git is older, hooks silently absent — document, and CI still enforces everything hooks do
- [In-memory dataset bounds scale] → acceptable by design; DataSource seam isolates the swap to SQLite/Postgres/ingestion without touching API or web
- [OSM tile usage policy] → prototype traffic is trivial; tile provider is a one-line swap if needed
- [MapLibre + Svelte 5 interop edge cases] → thin wrapper component, store-driven pin data, e2e coverage on the golden paths
- [Sequential config hooks (pre-2.55)] → hooks are fast (lint staged files only); typecheck lives on pre-push/CI
- [Playwright e2e needs compose boot] → CI job starts stack via compose; fallback to direct process boot if compose-in-CI is flaky

- [TypeScript split (7 for non-Svelte, 6 for web) drifts] → root and web tsconfigs are deliberately aligned (same strictness, bundler resolution); a CI task typechecks web with `tsc6` + svelte-check and everything else with tsgo, so drift surfaces at gate time; D16's migration task closes the split when 7.1 lands

## Migration Plan

Greenfield — no migration. Rollback = `git revert`; compose images tagged by commit SHA. Dataset changes are regenerations (deterministic, fixed seed) — no data migration until the real ingestion pipeline exists, which will bring its own plan.

## Open Questions

- None material — remaining unknowns (specific OSM tile URL, exact perf budget numbers, Stryker break-threshold value) are implementation-time values with their decision points already tasked (D5, task 6.10, D10)
