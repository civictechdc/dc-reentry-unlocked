# Tasks

## 1. Repo scaffold & tooling

- [x] 1.1 Clear the prior `web-app/` implementation in the main worktree (delete the directory; git history preserved), keeping the existing `.bare` + `.worktrees` arrangement intact for the monorepo; verify the directory is gone, `git log` still shows prior history, and the worktree layout is unchanged
- [x] 1.2 Create root `package.json` with `workspaces` (apps/web, apps/api, packages/shared, tools/datagen) + matching committed `pnpm-workspace.yaml` in the main worktree root; verify `pnpm install` succeeds and `pnpm -r ls --depth -1` lists all four workspaces
- [x] 1.3 Add TS configs: strict base tsconfig (bundler resolution, no baseUrl, TS-7-aligned defaults), root `typescript@^7`, `@typescript/typescript6` for apps/web; verify `npx tsc --noEmit` (TS 7 Go-native `tsc` binary) passes on a smoke file in packages/shared and `pnpm -C apps/web exec tsc6 --version` resolves
- [x] 1.4 Configure oxlint (`.oxlintrc.json`), oxfmt (`.oxfmtrc.jsonc`, svelte option enabled with `svelte` dep present), ESLint flat config for JSON files (eslint-plugin-json); verify `pnpm lint` and `pnpm format:check` pass on the scaffold
- [x] 1.5 Set up Vitest with fast-check (`@fast-check/vitest`) and one smoke test per workspace; verify `pnpm test` collects and passes all smoke tests including a trivial property test
- [x] 1.6 Configure dependency-cruiser with the architecture rules (shared imports nothing from apps/tools; each app/tool imports only shared; api routes reach data only via DataSource; the shared `testing` subpath is imported only from test files; no cycles), pinning `@typescript/typescript6` as its TS parser dependency (TS 7 has no compiler API); verify `pnpm arch:check` passes on the scaffold and FAILS on a deliberately violating import added in a scratch branch
- [x] 1.7 Install Git 2.54+ config-based hooks: pre-commit (oxfmt check + oxlint on staged files), pre-push (typecheck + `pnpm arch:check`), commit-msg (commitlint + `@commitlint/config-conventional`), committed via config include + setup doc with git version requirement; verify `git hook list` shows the events, a deliberately lint-failing staged file blocks commit, and a non-conventional commit message is rejected
- [x] 1.8 Add `.gitignore` (node_modules, build output, `.superpowers/`, the entire `.agents/local/` directory — local-only brief and real-provider sample CSV never tracked; the frozen dataset under `data/` IS committed) and README quickstart; verify a fresh clone → install → dev-boot sequence documented in README runs as written
  (verification tail: dev-boot completes with task 7.3 — tick this box only after 7.3 passes its run-as-written check; user decision to keep it unticked until then)
- [x] 1.9 Add `.zed/` and `.vscode/` settings (format-on-save via oxfmt, ESLint integration, recommended extensions, task configs); verify settings parse and the configured tasks reference existing package scripts

## 2. Agentic structure (before product implementation)

> Execution note: run this block in a fresh agent session; when requirements or specifics are unclear, surface questions to the user one at a time (never batched) via the orchestrator relay.

- [x] 2.1 Write the AGENTS.md foundation at repo root (development style, architecture map, verification commands, review guidelines, docs organization) including token-efficiency and context-management rules (curated subagent briefs, fresh session per task block, link-not-paste, deterministic commands first), the Conventional Commits convention with scope examples for agent-written commits, and the test-style doctrine (behavioral-sentence names, Arrange-Act-Assert, philosophical not literal Given/When/Then, externalized domain builders from the shared testing subpath, test bodies read as domain language); plus a rule that a gitignored, machine-local `AGENTS.local.md` at repo root, if present, is read immediately after AGENTS.md (machine-specific paths, local lessons, per-block dispatch notes — never committed; add `AGENTS.local.md` to `.gitignore`); verify AGENTS.md contains the rules section and the AGENTS.local.md reference rule, and that its referenced commands run as written
- [x] 2.2 Create agent hooks for opencode, VS Code, Claude, and Codex as advisory nudges only (context/token discipline, conventional-commit guidance, spec-first reminders, unknown-honesty reminder on inventory/filter edits, run-verification-before-done reminder, read-AGENTS.local.md-if-present nudge) with NO blocking duplicates of the git-hook checks; verify nudges fire at the intended moments on each platform and that no agent hook blocks what git hooks already gate
- [x] 2.3 Create project skills in `.agents/skills/` (universal adapter): project orientation (architecture map, verification commands, domain rules) and data-model reference (sourced from the capability specs now, pointing into packages/shared once it lands); verify each skill loads and answers a smoke question correctly in a fresh agent session
- [x] 2.4 Evaluate dev-workflow MCPs (docs lookup, OpenSpec tooling), record adopt/reject decisions with rationale in AGENTS.md; verify any adopted MCP is configured and listed config validates
- [x] 2.5 Write `docs/glossary.md` consolidating the ubiquitous domain language (provider, program, unit, availability states, location precision, filter schema, control types, verification badge, unknown state); verify every glossary term matches its definition in the capability specs

## 3. Shared contracts (packages/shared)

- [x] 3.1 Define TypeBox schemas for Provider, Program, Unit entities including availability states (available/not/unverified-availability) plus a separate confirmation flag, location precision (exact vs ward-level), and unit size (square footage plus room type: private room / shared room / efficiency / apartment); verify round-trip unit tests pass (`pnpm -C packages/shared test`)
- [x] 3.2 Define flattened UnitCard schema (unit fields + program policies + provider contact, verification badge, schemaVersion); verify a valid sample card passes schema conformance test
- [x] 3.3 Define FilterSchema contract: filter definition (id, label, control, target, options), control enum (boolean, single-select, multi-select), plus the 11 filter definitions as data — pinning the enum taxonomies: housing type = {emergency shelter, transitional, permanent supportive housing, subsidized rental, market-rate}; length of stay = {emergency/nightly, short-term ≤90 days, transitional up to 24 months, permanent/open-ended}; population = {individuals, families, both}; gender = {men, women, all}; verify tests assert control-enum coverage, all 11 filters present with valid targets, and the pinned option lists match the shared definitions
- [x] 3.4 Define API envelopes: units response, filter-schema response, error envelope with stable machine codes; verify envelope schema tests pass
- [x] 3.5 Document the shared-contract module in `docs/shared-contracts.md`; verify each documented import example compiles via a typecheck-included test
- [x] 3.6 Export fluent domain builders from packages/shared as a test-only `testing` subpath (aProvider/aProgram/aUnit with domain-language methods, e.g. `.inWard(5).withUnknownSobrietyPolicy()`); verify a consumer test in apps/api arranges via the builder and that dependency-cruiser rules permit the subpath only from test files

## 4. Synthetic data generator (tools/datagen)

- [x] 4.1 Build DC geography corpus (real street names by ward/quadrant/ZIP with real street geometry and ward boundaries for coordinate derivation, building numbers sampled from plausible per-street ranges — never sourced from real listings) and fictional provider/contact generators (names, 555-style numbers, plausible domains) with a deterministic seeded RNG; verify unit tests assert regeneration determinism and that no fictional name collides with the real-provider exclusion list
- [x] 4.2 Generate the Provider → Program → Unit hierarchy populating all 11 filter fields with realistic distributions including unknown states, all three availability states plus confirmation flags, and both exact and approximate locations across all 8 wards; verify fast-check properties hold for all seeds (every ward 1–8 has units, availability states exist, every record conforms to shared schemas, every unit's coordinates fall within its ward's real boundary, regeneration is byte-identical)
- [x] 4.3 Write deterministic output to `data/units.v1.json` (fixed seed) and commit the frozen dataset; verify `pnpm datagen` then `git diff --exit-code -- data/` proves byte-identical regeneration
- [x] 4.4 Document generation and seed policy in `docs/data-synthetic.md`; verify the documented regenerate command runs as written

## 5. API (apps/api)

- [x] 5.1 Scaffold Fastify app with the DataSource module (loads `data/units.v1.json` at boot, availability gate inside the source, swappable seam) and a `/health` route; verify integration test boots the app and `/health` returns ok
- [x] 5.2 Implement `GET /units` with filter query params derived from the shared FilterSchema, unknown→no matching at filter level, and the units response envelope; verify integration tests cover filter combinations, unknown-mapping inclusion case, and unavailable-unit exclusion, plus fast-check properties for filter algebra (unknown→no mapping, selection idempotence, result-subset invariants, envelope conformance)
- [x] 5.3 Implement `GET /filters` serving the 11-filter schema from packages/shared as single source of truth; verify integration test asserts served schema matches shared definitions exactly
- [x] 5.4 Add stable error envelope, pino structured logging, request-id correlation, and default rate limiting; verify integration tests assert 404/400 response shapes and log correlation ids present
- [x] 5.5 Enforce TypeBox validation on all request params and security headers on responses; verify malformed params are rejected with 400 and headers present in a test response
- [x] 5.6 Document endpoints in `docs/api.md` with curl examples; verify every documented curl command succeeds against a locally booted dev server
- [x] 5.7 Serve a machine-readable OpenAPI document generated from the shared TypeBox route schemas (JSON endpoint only, no UI); declare the shared error-envelope schema on error response status codes so the document covers error shapes; verify the served document validates as OpenAPI 3.x, covers units/filters/health + error responses, and is generated (not hand-maintained) so it cannot drift from the implemented routes

## 6. Frontend (apps/web)

- [x] 6.1 Scaffold SvelteKit (Svelte 5 runes, `@typescript/typescript6` pinned for svelte-check, SPA mode with prerendered 404) with layout shell, synthetic-data disclosure banner, routes, and a plain-language 404 page; verify `pnpm -C apps/web check` passes and dev server boots showing the banner
- [x] 6.2 Build API client + state stores (unit cards, filter schema fetch, selection state) with graceful degradation for unknown control types; verify store unit tests cover unknown-control handling plus a fast-check model-based test of the filter-selection state machine (apply/remove/clear sequences) via `fc.commands`
- [x] 6.3 Build the schema-rendered filter bar: generic renderers for boolean, single-select, multi-select; active-selection chips; clear-all; zero-results panel with chip removal; verify component tests render all three control types from a test schema and chips clear correctly
- [x] 6.4 Build the MapLibre GL map component (OSM tiles with attribution, GeoJSON pin source, ward-fallback placement for approximate locations) with card↔pin cross-highlighting; verify component tests/e2e assert pins render per unit and approximate-location units place within their ward
- [x] 6.5 Build the unit card list (specs, provider/program, verification badge) with skeleton loading and empty/error states; verify component tests cover loading, loaded, error, and zero-results states
- [x] 6.6 Build the unit detail slide-over (specs, policies with "not publicly listed" for unknowns, provider contact block) keeping the map visible; verify component tests assert unknown fields render honestly and contact data is complete
- [x] 6.7 Implement mobile behavior: Map/List tabs, horizontally scrollable filter row with filter sheet, full-screen bottom-sheet detail; verify Playwright mobile-viewport e2e exercises tabs, filters, and detail
- [x] 6.8 Externalize all user-facing strings into Paraglide (inlang) message catalogs; verify an audit test (no hardcoded display strings in components) passes
- [x] 6.9 Meet a11y baseline: keyboard operability, ARIA roles/labels, AA contrast tokens; verify axe-core e2e smoke reports no serious violations
- [x] 6.10 Meet performance envelope: API payload size budget test and map-interaction smoothness e2e (warn-gate until first baseline) against the initial targets (units payload ≤ ~500KB per ~1,000 units, first load < 2s mid-tier, no long task > 50ms during pan/zoom, pin re-render < 100ms per filter change); verify measurements recorded with budgets revisable as evidence accumulates
- [x] 6.11 Add CSP and standard security headers on web responses (D14 web half); verify a response-header test asserts CSP and security headers present on all served pages

## 7. Integration & run

- [x] 7.1 Add docker compose (api + web services, healthchecks, restart policies, env config) ; verify `docker compose up` boots both services and a smoke request to web returns the app with units loaded
- [x] 7.2 Write Playwright e2e golden paths as playwright-bdd Gherkin features derived from the OpenSpec capability scenarios (filter sync, detail, mobile tabs, zero-results, 404, API-down banner); verify `bddgen` generates standard Playwright tests and `pnpm e2e` passes green against the booted stack
- [x] 7.3 Write `docs/runbook.md` (dev without Docker, compose boot, data regeneration) and refresh the README's how-to-run section (concise quickstart + pointer to the runbook — the complete run story lives there once compose exists); verify every documented command runs as written — this verification also completes task 1.8's deferred dev-boot tail (tick 1.8 then)

## 8. CI & project documentation

- [x] 8.1 Create GitHub Actions PR workflow: pnpm install (cached), oxlint + ESLint(JSON), oxfmt format check, typecheck (TS 7 `tsc` for api/shared/datagen; tsc6 + svelte-check for web), `pnpm arch:check` (dependency-cruiser architecture rules), vitest, builds, and commitlint on PR title/messages; verify workflow passes on a test PR (or local equivalent runner) end to end
- [x] 8.2 Add CI e2e job (compose boot + bddgen + Playwright suite across Chromium/WebKit/Firefox desktop + Chromium mobile) and a manually dispatched full-suite workflow (full e2e + `pnpm audit` + datagen determinism diff + StrykerJS mutation run scoped to shared/api/datagen with `typescript-checker` on the pinned TS 6, report-only thresholds initially; no schedule yet); verify both workflow YAMLs validate and the e2e job passes
- [x] 8.3 Write `docs/architecture.md` with a Mermaid system diagram generated from its diagram-as-code source and CI-validated for renderability, finalizing the AGENTS.md architecture map and verification commands against the finished codebase; verify every command listed in AGENTS.md runs as written
- [x] 8.4 Add `openspec validate` gate step to CI; verify it passes for this change's artifacts
- [x] 8.5 Rewrite README.md as a concise, human-facing guide — what the project is (incl. the synthetic-data disclosure), project navigation, how to run the application (concise quickstart only; the full run story links to `docs/runbook.md`, which lands with the compose boot work), and the relevant tests — moving agent-facing and deep detail out to AGENTS.md and docs/ (git-hook setup, AI tooling, data policy, tooling rationale); every documented command must run as written, and the README carries no agent-workflow internals (user directive 2026-10-29; executed early, out of block order)

## Workflow follow-up

- After all tasks complete: run code review + adversarial security review per project policy, resolve findings, then archive this change (`openspec archive`) and verify the archived specs.
- Future change (not this one): migrate apps/web from `@typescript/typescript6` to TypeScript 7.1 content-mapper-based svelte-check once 7.1 is stable and sveltejs/language-tools ships the mapper (per design D15).
