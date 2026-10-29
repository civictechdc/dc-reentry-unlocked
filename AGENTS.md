# AGENTS.md — dc-reentry-unlocked

The cross-tool agent standard for this repo: opencode, Claude Code, Codex, and
Copilot all read this file. Tool-specific bits stay in their own config dirs
(`.vscode/`, `.zed/`, `.claude/`, `.codex/`, `.github/`). Architecture truth
lives in this repo; **product/spec truth lives in the machine-local OpenSpec
planning workspace** — `../../openspec/changes/housing-units-prototype/`
(specs, design, tasks) — which is intentionally **not part of this repo**
(user decision 2026-10-29): it stays at the container level above the
worktree, is gitignored defensively here, and is never committed. Read it
before product work; run `openspec` commands from the container directory
(and `openspec validate` there before claiming any task block complete).
The CI validate gate for machine-local spec artifacts is deferred pending
that decision being revisited.

## Local overrides first

**If `AGENTS.local.md` exists at the repo root, read it immediately after this
file.** It is gitignored (machine-specific paths, local lessons, per-block
dispatch notes) and is never committed. Anything it says is on top of — not
instead of — the rules here.

## Architecture map

pnpm monorepo (Node ≥ 22.12, pnpm ≥ 12):

| Path                    | Role                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`              | SvelteKit frontend (Svelte 5 runes, SPA mode) — TS via tsc6                                                                       |
| `apps/api`              | Fastify backend, TypeBox validation                                                                                               |
| `packages/shared`       | TypeBox schemas + TS types — THE API CONTRACT (stable seam)                                                                       |
| `tools/datagen`         | Deterministic synthetic dataset generator (fixed seed)                                                                            |
| `data/` (planned)       | Frozen generated dataset — committed once the generator lands, must stay byte-identical. Never hand-edit                          |
| `docs/`                 | Human-facing docs (glossary now; runbook and architecture notes are planned, not yet landed)                                      |
| `openspec/` (container) | Machine-local OpenSpec planning workspace, two levels above this repo — deliberately not repo content, never committed; see intro |

Seams are executable, not prose — `pnpm arch:check` (dependency-cruiser,
`.dependency-cruiser.cjs`) enforces:

- `packages/shared` imports nothing from `apps/*` or `tools/*`.
- Each app/tool imports only `packages/shared`.
- The `testing` subpath of `packages/shared` is imported only from test files.
- Inside `apps/api`, routes reach data only through the `DataSource` module —
  never the dataset file directly (ingestion-pipeline seam).
- No cycles.

## Verification commands (run from repo root)

| Command             | Checks (use before claiming done)                                       |
| ------------------- | ----------------------------------------------------------------------- |
| `pnpm lint`         | oxlint (JS/TS/Svelte) + ESLint (JSON only)                              |
| `pnpm format:check` | oxfmt formatting (run `pnpm format` to fix)                             |
| `pnpm test`         | Vitest in every workspace + repo-tool suite (fast-check props included) |
| `pnpm typecheck`    | tsc for shared/api/datagen + `tsc6` for apps/web                        |
| `pnpm arch:check`   | dependency-cruiser architecture rules                                   |

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
  live in the test-only `testing` subpath of `packages/shared` (planned, not
  yet landed). Do not copy builder logic into individual workspaces.
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
`.claude/agents/*`, `.agents/skills/**`, and `skills-lock.json` inject
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
`pnpm dev` for the web app does not exist yet; the MCP autofixer and docs
server do not depend on it.

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

Final (user confirmed 2026-10-29):

- **Svelte MCP server (local stdio via `@sveltejs/mcp`) — ADOPTED** (user
  request 2026-10-29, restored from the prior prototype): project dev
  tooling giving agents Svelte 5/SvelteKit docs lookup and the
  `svelte-autofixer` code validator. Configured via the root `.mcp.json`
  (VS Code + Claude Code), `.codex/config.toml` (Codex), and the
  `@sveltejs/opencode` plugin (`opencode.jsonc`). A `svelte-file-editor`
  subagent is available to Claude Code (`.claude/agents/`) and Codex
  (`.codex/agents/`); delegate Svelte component/module edits to it. See the
  Svelte tooling section above for the usage instructions.

- **Docs-lookup MCP (Context7-style) — ADOPTED.** Library facts (Fastify,
  Svelte 5 runes, MapLibre, TypeBox) drift; fetching current docs beats
  training-memory claims during product blocks. Zero repo config.
- **OpenSpec tooling — REJECTED as MCP (keep markdown + ad-hoc CLI).**
  Specs are plain markdown files an agent can read directly (machine-local
  at the container level — see intro; run `openspec` commands from there);
  no official OpenSpec MCP exists to adopt, and an MCP would add little
  over reading the spec files directly.
- **Memory/knowledge MCP — REJECTED.** Local lessons live in the
  gitignored `AGENTS.local.md` (mechanism above); a memory DB would fork
  truth and risks committing context meant to stay local.
- **housing-data MCP — REJECTED as dev tooling.** The housing-data web MCP
  is the product's future external surface for case-manager tools, not
  agent tooling. It will appear in the product, not in agent config.

## Docs organization

- OpenSpec specs/designs live in the machine-local container-level workspace
  (two levels above this repo — not in-repo; see intro). Do not edit them
  without an assigned task.
- `docs/` — human-facing: `docs/glossary.md` (ubiquitous domain language —
  keep terms consistent with specs; runbook (`docs/runbook.md`) and
  architecture note (`docs/architecture.md`) are planned, not yet landed).
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
the grep example), comments about tasks.md workflow rules, the machine-local
openspec _folder_ path, legitimate version numbers (Svelte 5.x, Git 2.54,
pinned deps like @0.1.28), and bare `N.N` references like "lands 1.7" — which
the pattern cannot see — are the named categories; bare `N.N` must be
eyeballed manually):

```sh
grep -rIinE "(tasks?|lands?) [0-9]+\.[0-9]+|blocks? [0-9]|design D[0-9]+|\bD1[0-8]\b|housing-units-prototype" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=openspec \
  --exclude-dir=data --exclude-dir=.superpowers --exclude=pnpm-lock.yaml \
  --exclude-dir=packages --exclude-dir=api --exclude-dir=datagen . \
  | grep -vE "AGENTS\.local\.md|\.agents/local/"
```

(`-i` catches `Task 8.4` at sentence start; the extended pattern also catches
bare "lands 1.7" phrasing; partition exclusions for workspaces another agent
owns are temporary and come off when that block is done.)
