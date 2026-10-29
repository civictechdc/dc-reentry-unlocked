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
Task 8.4's CI validate gate is deferred pending that decision being
revisited.

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
| `data/`                 | Frozen generated dataset, lands with task 4.3 — committed, must stay byte-identical. Never hand-edit                              |
| `docs/`                 | Human-facing docs (glossary now; runbook lands 7.3, architecture notes land 8.3)                                                  |
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
  live in the test-only `testing` subpath of `packages/shared` (lands with
  task 3.6). Do not copy builder logic into individual workspaces.
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
and `.github/hooks/agent-nudges.json` inject context into every agent session
in this repo. Treat changes to any of them as security-sensitive: review
them as you would review a shell hook — no input ever reaches the emitted
context, no executable content, no blocking fields. PRs touching them
merit extra scrutiny.

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
- **housing-data MCP — REJECTED as dev tooling.** It is the _product's_
  future external API surface for case-manager tools, not dev tooling
  (per design D17). It will appear in the product, not in agent config.

## Docs organization

- OpenSpec specs/designs live in the machine-local container-level workspace
  (two levels above this repo — not in-repo; see intro). Do not edit them
  without an assigned task.
- `docs/` — human-facing: `docs/glossary.md` (ubiquitous domain language —
  keep terms consistent with specs; runbook (`docs/runbook.md`) lands task
  7.3, architecture note (`docs/architecture.md`) lands task 8.3).
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
  above (nudge script + the three hook configs) — they inject into every
  agent session.
