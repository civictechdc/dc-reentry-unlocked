# AGENTS.md — dc-reentry-unlocked

The cross-tool agent standard for this repo: opencode, Claude Code, Codex, and
Copilot all read this file. Tool-specific bits stay in their own config dirs
(`.vscode/`, `.zed/`, `.claude/`, `.codex/`, `.github/`). Architecture truth
lives in this repo; **product/spec truth lives in the in-repo OpenSpec
planning workspace** — the `openspec/` directory (its `changes/` and
`specs/` subtrees hold the specs, design, and tasks; the active change is
listed by `openspec list`, run from the repo root). It is **part of this
repo** (user decision 2026-10-31, moved from the previously machine-local
container-level workspace so the CI gate can validate it and archived
specs stay reviewable). Read it before product work; run `openspec`
commands from the repo root (and `openspec validate` there before
claiming any task block complete). The CI validate gate runs on it
(`.github/workflows/`).

## Local overrides first

**If `AGENTS.local.md` exists at the repo root, read it immediately after this
file.** It is gitignored (machine-specific paths, local lessons, per-block
dispatch notes) and is never committed. Anything it says is on top of — not
instead of — the rules here.

## Architecture map

pnpm monorepo (Node ≥ 22.12, pnpm ≥ 12):

| Path                 | Role                                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`           | SvelteKit frontend (Svelte 5 runes, SPA mode) — TS via tsc6                                                                      |
| `apps/api`           | Fastify backend, TypeBox validation                                                                                              |
| `packages/shared`    | TypeBox schemas + TS types — THE API CONTRACT (stable seam)                                                                      |
| `tools/datagen`      | Deterministic synthetic dataset generator (fixed seed)                                                                           |
| `data/`              | Frozen generated dataset (`data/units.v2.json`, committed) — regeneration must stay byte-identical. Never hand-edit              |
| `compose.yaml`       | The Compose boot: API + production-built web images, healthchecked (build story in `docs/runbook.md`)                            |
| `.devcontainer/`     | Dev container config (VS Code/Zed/Codespaces) — see docs/dev-container.md                                                        |
| `docs/`              | Human-facing docs: glossary, runbook, api, data-synthetic, shared-contracts, `architecture.md` (system diagram + seams)          |
| `openspec/`          | In-repo OpenSpec planning workspace (`openspec/changes/`, `openspec/specs/`) — validated by the CI `openspec validate` gate      |
| `.github/workflows/` | CI: PR gate (`pr.yml`), full suite on manual dispatch (`full.yml`) — e2e compose matrix, mutation runs, openspec + diagram gates |

Seams are executable, not prose — `pnpm arch:check` (dependency-cruiser,
`.dependency-cruiser.cjs`) enforces:

- `packages/shared` imports nothing from `apps/*` or `tools/*`.
- Each app/tool imports only `packages/shared`.
- The `testing` subpath of `packages/shared` is imported only from test files.
- Inside `apps/api`, routes reach data only through the `DataSource` module —
  never the dataset file directly (ingestion-pipeline seam).
- No cycles.

## Verification commands

Run from the repo root unless noted. The deterministic repo gates come
first; e2e commands boot their own servers (stop stray servers first), and
the `-C apps/web` matrix variants assume a running Compose boot ([runbook
recipes](docs/runbook.md)).

| Command                                  | Checks (use before claiming done)                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm lint`                              | oxlint (JS/TS/Svelte) + ESLint (JSON only)                                           |
| `pnpm format:check`                      | oxfmt formatting (run `pnpm format` to fix)                                          |
| `pnpm test`                              | Vitest in every workspace + repo-tool suite (fast-check props included)              |
| `pnpm typecheck`                         | tsc for shared/api/datagen + `tsc6` for apps/web                                     |
| `pnpm arch:check`                        | dependency-cruiser architecture rules                                                |
| `pnpm -C apps/web e2e`                   | Spec e2e against the dev servers (self-boots them; stop other servers first)         |
| `pnpm -C apps/web e2e:bdd`               | Generated-BDD golden paths against the self-booted dev servers                       |
| `pnpm -C apps/web e2e:prod`              | Production-build probe (`vite build` + adapter-node server; also builds the web app) |
| `pnpm -C apps/web e2e:ci` / `e2e:bdd:ci` | Spec/BDD matrix against the Compose boot (start: `docker compose up -d --wait`)      |
| `pnpm datagen`                           | Regenerate the frozen dataset — `git diff --exit-code -- data/` must stay empty      |
| `node scripts/check-diagrams.mjs`        | Renderability of every committed mermaid diagram (docs/ + README)                    |
| `node scripts/run-mutation.mjs`          | Stryker mutation runs over shared/api/datagen (report-only; minutes-long)            |
| `openspec validate --all --strict`       | The OpenSpec gate: all changes + specs, strict mode                                  |

Deterministic commands first — never assert code behavior you have not run.
The task verification for your block's task must pass before you report done.

## Development style

- Spec-first: work from an OpenSpec change's `tasks.md`, never improvise
  scope. Adding behavior outside the spec = stop and ask.
- Minimal, scoped changes. No speculative abstractions, no drive-by refactors.
- Honest unknowns (see Unknown honesty below).
- Conventional Commits for agent-written commits: `type(scope): subject` —
  type from the conventional enum (`feat`, `fix`, `chore`, `ci`, `docs`, …);
  scope optional, aligned to workspace names (`api`, `web`, `shared`,
  `datagen`); workspace names are scopes, never types — `shared: foo` is
  rejected because `shared` is not a type; body lines ≤ 100 chars.
  Examples: `feat(shared): add unit availability schema`,
  `fix(api): reject unknown filter ids`, `docs: add domain glossary`.

## Test style doctrine

- Behavioral-sentence test names: `includes units with unknown referral
  policy when filtering no-referral` — a behavior claim, not a method name.
- Arrange-Act-Assert bodies. Given/When/Then is philosophical, not literal —
  no keyword ceremony outside the e2e/Gherkin layer.
- Fluent domain builders (`aUnit().inWard(5).withUnknownSobrietyPolicy()`)
  live in the test-only `testing` subpath of `packages/shared`. Do not copy
  builder logic into individual workspaces.
- Test bodies read as domain language, not as schema plumbing.
- Gherkin keywords appear only in the acceptance/e2e layer.

## Unknown honesty

Unknown is a representable state meaning "not publicly listed" — never a
fabricated yes/no. When touching inventory/filter code: boolean filters match
unknown against "no" selections; enum filters match unknown against every
value selection while carrying a "policy not listed" marker; detail views
always render the honest unknown ("not publicly listed"). If a source value
would need inventing, surface unknown.

## Agent hooks — nudges, not gates

Deterministic enforcement lives ONLY in the git hooks (config-based:
`gitconfig/hooks.config` → `scripts/hooks/{pre-commit,pre-push,commit-msg}`:
format/lint on staged files, typecheck+arch on push, commitlint). Agent hooks
are advisory text only — they must never block, deny, or duplicate a git-hook
check. Nudge delivery per platform (mechanisms verified against current docs
2026-08+):

| Platform | Delivery                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| opencode | No advisory-prose channel exists for nudge moments (plugin hooks can mutate arguments or throw; event observers cannot inject prose) → fallback: this file, which opencode loads natively as project rules                                                                                                                                                                                                                                                                                                                                                         |
| VS Code  | `.github/hooks/agent-nudges.json` (Copilot harness, `sessionStart`+`postToolUse`, top-level `additionalContext` output). Note: the Copilot harness also reads `.claude/settings.json`, but those entries are Claude exec-form (`command:"node"` + `args`), and Copilot's docs tie `args` to `exec`-type hooks only — so the cross-tool read most likely never executes the script (nudge silently absent is the harmless failure mode; `.github/hooks/agent-nudges.json` is authoritative for Copilot). See the security-sensitive section for the residual caveat |
| Claude   | `.claude/settings.json` → `SessionStart`/`UserPromptSubmit`/`PostToolUse`, resolved via `${CLAUDE_PROJECT_DIR}`, hookSpecificOutput `additionalContext`, no decision fields                                                                                                                                                                                                                                                                                                                                                                                        |
| Codex    | `.codex/hooks.json` → `SessionStart`/`UserPromptSubmit`/`PostToolUse`, commands resolved from the git root (`git rev-parse --show-toplevel`); trust once via `/hooks`                                                                                                                                                                                                                                                                                                                                                                                              |

All share one script, `scripts/agent-hooks/nudge.mjs`, which only prints
advisory context JSON and **exits 0 on all paths** — unparsable input,
oversized stdin (capped at 1 MiB, treated as a no-op), stream errors (EPIPE
handlers installed), and even uncaught exceptions (swallowed by a process
handler that keeps `exitCode = 0`). Token discipline is built into the
payload: `SessionStart` carries the full base nudge once per session;
`UserPromptSubmit` carries a single pointer line; `PostToolUse` emits only
the unknown-honesty line, and only when the edited path matches
`inventory|filter|schema|glossary` — everything else returns `{}` (no
context). Dispatch is by structural payload cues (`hook_event_name` →
Claude/Codex shape; `toolName`/`sessionId` → Copilot top-level
`additionalContext`). Copy-paste of tool output into the nudge is forbidden
by construction; the script emits only fixed strings. Machine-specific paths
stay out of all hook configs.

## Security-sensitive agent-surface files

`scripts/agent-hooks/nudge.mjs`, `.claude/settings.json`, `.codex/hooks.json`,
`.codex/config.toml`, `.codex/agents/*`, `.mcp.json`, `opencode.jsonc`,
`.opencode/svelte.json`, `.github/hooks/agent-nudges.json`,
`.claude/agents/*`, `.agents/skills/**`, `.devcontainer/**`, and
`skills-lock.json` inject
executable configuration or agent instructions into every agent session
in this repo. Treat changes to any of them as security-sensitive: review
them as you would review a shell hook — no input ever reaches the emitted
context, no executable content, no blocking fields. PRs touching them
merit extra scrutiny.

## Svelte tooling

Per the Svelte AI docs (https://svelte.dev/docs/ai/instructions) — include
the following prompt so agents use the Svelte MCP server and skills
correctly. The Svelte AI tooling is merged from the prior prototype
(restored 2026-10-29, content kept current with upstream):

```
You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available Svelte MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
```

Skills live at `.agents/skills/svelte-code-writer` and
`.agents/skills/svelte-core-bestpractices` (pinned in `skills-lock.json`).
The Svelte MCP package and the `@sveltejs/opencode` plugin are version-pinned
(npm-verified 2026-10-29; `.opencode/svelte.json` additionally disables the
plugin's auto-update) — bumps are deliberate, reviewed changes.
Because Svelte file work is atomic, prefer delegating it to the
`svelte-file-editor` subagent where the harness supports it — the subagent
fetches docs and iterates with `svelte-autofixer` in its own context window.
`pnpm -C apps/web dev` boots the SvelteKit dev server (port 5173; the API dev
server runs on port 3000); the MCP autofixer and docs server do not depend on it.

Provenance and trust notes:

- `skills-lock.json` hashes are **drift metadata** (content provenance vs
  upstream), not authenticity guarantees — a malicious commit can swap skill
  content and recompute hashes. Changes to skill content and to the lock are
  therefore reviewed **together**, and upstream skill updates go through
  review (report differences, never auto-trust). The two Svelte skills stay
  byte-identical upstream content; that content contains its own unpinned
  npm/CLI invocations (e.g. the `svelte-code-writer` skill's `@sveltejs/mcp`
  CLI usage) which the repo-level version pins do not cover — the controls
  for that surface are the byte-identity contract (skills stay
  upstream-verbatim, drift detected via `skills-lock.json` and an upstream
  diff on every update) plus review of skill-content changes.
- The opencode plugin boundary: accepting this repo's `opencode.jsonc`
  authorizes third-party plugin JS execution at startup with user
  privileges. The plugin version is pinned and its auto-update disabled
  here; opening untrusted branches should happen in isolated environments
  rather than a configured workspace.

Residual cross-tool caveat (documented per current Copilot docs, assessment
continued here because the docs are ambiguous): Copilot reads repository
`.claude/settings.json` hooks cross-tool, but its command-hook docs tie
`args` to `exec`-type hooks only and do not define how a Claude exec-form
entry (`command: "node"` + `args`) is interpreted. Two behaviors are
conceivable and neither is a security win for an attacker: (a) the entry is
not executed (nudge absent — likely, benign); (b) a runner executes
`command` while ignoring `args` — bare `node` would then read the piped
hook JSON payload as JavaScript. That payload is an object literal starting
with a quoted key (`{ "hook_event_name": … }`), which is a guaranteed
SyntaxError (string labels are illegal) as a standalone script: node exits 1
without executing anything. Command-hook error behavior for non-preToolUse
events is not precisely documented; we treat it as undefined and flag it
here rather than fabricating a mitigation. If a runner ever changes this
behavior, re-verify against the Copilot hooks reference first.

## MCP decisions — dev workflow tooling

Decision log (per-entry provenance dates below):

- **Svelte MCP server (local stdio via `@sveltejs/mcp`) — ADOPTED** (user
  request 2026-10-29, restored from the prior prototype): project dev
  tooling giving agents Svelte 5/SvelteKit docs lookup and the
  `svelte-autofixer` code validator. Configured via the root `.mcp.json`
  (VS Code + Claude Code), `.codex/config.toml` (Codex), and the
  `@sveltejs/opencode` plugin (`opencode.jsonc`). A `svelte-file-editor`
  subagent is available to Claude Code (`.claude/agents/`) and Codex
  (`.codex/agents/`); delegate Svelte component/module edits to it. See the
  Svelte tooling section above for the usage instructions.

- **chrome-devtools-mcp (local stdio, ChromeDevTools org) — ADOPTED** (user
  decision 2026-11-05): live Chrome inspection for agents against the dev
  servers — DOM, console, network, screenshots, performance traces. Pinned
  `chrome-devtools-mcp@1.12.0` (npm-verified 2026-11-05; never `@latest` —
  bumps are deliberate, reviewed changes). Started with Google telemetry
  off: `--no-usage-statistics` (usage-statistics collection),
  `--no-performance-crux` (CrUX trace-URL lookups),
  `CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS=1` (npm update checks). Runs with
  `--isolated`: a session-scoped Chrome profile, cleaned when the browser
  closes — no persistent cross-session state. Runs with
  `CHROME_DEVTOOLS_MCP_NO_CONFIG_DISCOVERY=1`: disables discovered config
  files (`$PLUGIN_DATA/cd4a.config.json`, `~/.config/cd4a/config.json`)
  that could otherwise alter posture. Trust: the server exposes everything
  in the browser instance it launches (pages, cookies, storage) to the
  agent — it launches its own isolated Chrome, never the user's browsing
  profile; `evaluate_script` is exposed, and page content read through the
  server is untrusted input (prompt-injection surface). Wired via
  `.mcp.json`, `.codex/config.toml`, and `opencode.jsonc` (`mcp.servers`).

- **@mozilla/firefox-devtools-mcp (local stdio, Mozilla) — ADOPTED** (user
  decision 2026-11-05): Firefox inspection for agents — navigation,
  snapshot, screenshot, console, network, debugging, profiler, script
  evaluation — via an explicit `--tools` list (least-surface; no preset).
  Pinned `@mozilla/firefox-devtools-mcp@0.10.7` (npm-verified 2026-11-05).
  This is Mozilla's PUBLIC npm build: it strips the
  privileged-context/prefs/launch/bidi modules that exist only in the
  internal `-moz` build — never swap to `-moz` or rely on its env expansion
  without security review. Requires Node ≥ 20.19 and a system Firefox (100+).
  Always started with `--profile-path .scratch` so Firefox runs in the
  isolated, gitignored `.scratch/firefox_devtools_mcp_profile` (path
  resolves against the server's working directory, the repo root; treat
  any committed `.scratch` content as suspect) — never the user's real
  Firefox profile. The scratch profile persists across sessions and restarts
  (unlike Chrome's session-scoped `--isolated`), and a marked profile is
  reused as-is — delete `.scratch/` to reset it. Under the pinned path jail
  (`UNRESTRICTED_SAVE_PATHS=0`), `screenshot_page` cannot `saveTo` repo
  paths — consume the returned base64 image instead. Risk switches are
  pinned off in the server env
  (`CONNECT_EXISTING=0`, `ACCEPT_INSECURE_CERTS=0`,
  `UNRESTRICTED_SAVE_PATHS=0`, `ENABLE_PRIVILEGED_CONTEXT=0`,
  `MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=0`, `NODE_ENV=production`).
  `evaluate_script` is exposed — browse only local dev servers or trusted
  pages. Bumps are deliberate,
  reviewed changes; re-scan dependency advisories at bump time (0.10.7's
  transitive MCP SDK carries HTTP/OAuth advisories that are unreachable
  over local stdio).

- **Docs-lookup MCP (Context7-style) — ADOPTED.** Library facts (Fastify,
  Svelte 5 runes, MapLibre, TypeBox) drift; fetching current docs beats
  training-memory claims during product blocks. Zero repo config.
- **OpenSpec tooling — REJECTED as MCP (keep markdown + ad-hoc CLI).**
  Specs are plain markdown files an agent can read directly (in-repo at
  `openspec/` — see intro; run `openspec` commands from the repo root);
  no official OpenSpec MCP exists to adopt, and an MCP would add little
  over reading the spec files directly.
- **Memory/knowledge MCP — REJECTED.** Local lessons live in the
  gitignored `AGENTS.local.md` (mechanism above); a memory DB would fork
  truth and risks committing context meant to stay local.
- **housing-data MCP — REJECTED as dev tooling.** The housing-data web MCP
  is the product's future external surface for case-manager tools, not
  agent tooling. It will appear in the product, not in agent config.

## Docs organization

- OpenSpec specs/designs live in the in-repo `openspec/` workspace
  (see intro). Do not edit them
  without an assigned task.
- `docs/` — human-facing: `docs/glossary.md` (ubiquitous domain language —
  keep terms consistent with specs), `docs/runbook.md` (dev/Compose/
  data-regeneration run story), and `docs/architecture.md` (system
  diagram + seams).
- `README.md` — repo overview, current dev-boot status.
- Human considerations → `docs/`; agent instructions → this file +
  `.agents/skills/`; tool config → tool dirs; local only → `AGENTS.local.md`.

## Context / token discipline

- Fresh session per task block; open the block's brief, not the whole repo.
- Curated subagent briefs: pass the context needed for the task, not
  everything you know. Include target paths, binding decisions, and the exact
  verification commands.
- Link/point to documents instead of pasting file contents into context.
- Prefer deterministic commands over asking a model to guess
  (lint/formatters/dep-cruiser already know).
- Budget context per task: one task block ≈ one session; avoid loading
  specs you are not implementing against.

## Review guidelines

When reviewing changes (yours or others'):

- Re-verify with the commands table above — evidence, not impressions.
- Check seams first: shared stays dependency-free, DataSource unused directly,
  testing subpath imported only from tests.
- Check unknown-honesty on any inventory/filter touch.
- Check the contract stability rule: additive-first API changes; breaking
  changes must be versioned.
- Verify new docs/commands referenced by AGENTS.md, README, or skills still
  run as written — stale commands rot trust in every agent session.
- Give extra scrutiny to the security-sensitive agent-surface files listed
  above — they inject context and executable configuration into every agent
  session in this repo.

### No OpenSpec-internal tracking references in committed files

Committed code/config/docs must read self-contained: flag and require
removal of any comment or doc text in committed files that references
OpenSpec-internal tracking — task numbers (e.g. `6.1`, `task 4.3`), block
numbers (e.g. `block 2`, `blocks 4–5`), design-doc decision IDs (e.g.
`design D18`, `(D17)`), or the change name (`housing-units-prototype`) —
anywhere outside openspec folders. Such refs dangle for fresh clones and go
stale on renumber. Date-based decision provenance (e.g. "user decision
2026-10-29") is fine; only the internal tracking references go. Exemptions:
git history/commit messages (immutable) and machine-local files
(`AGENTS.local.md`, `.agents/local/`). Express future-landing marks
honestly without numbers ("planned, not yet landed") and state reasons
inline instead of pointing at decision IDs.

Starter grep (judge false positives by eye — this rule's own text (including
the grep example), comments about tasks.md workflow rules, the in-repo
openspec folder and its internal paths (excluded by `--exclude-dir=openspec`),
legitimate version numbers (Svelte 5.x, Git 2.54,
pinned deps like @0.1.28), and bare `N.N` references like "lands 1.7" — which
the pattern cannot see — are the named categories; bare `N.N` must be
eyeballed manually):

```sh
grep -rIinE "(tasks?|lands?) [0-9]+\.[0-9]+|blocks? [0-9]|design D[0-9]+|\bD1[0-8]\b|housing-units-prototype" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=openspec \
  --exclude-dir=data --exclude-dir=.superpowers --exclude=pnpm-lock.yaml . \
  | grep -vE "AGENTS\.local\.md|\.agents/local/"
```

(`-i` catches `Task 8.4` at sentence start; the extended pattern also catches
bare "lands 1.7" phrasing.)
