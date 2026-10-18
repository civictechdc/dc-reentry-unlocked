# D.C. Reentry Unlocked — Housing Program Discovery

A small Svelte 5 + TypeScript + Vite app for exploring reentry housing
programs in Washington, D.C.: filter programs by classification, housing
category, ward, eligibility and cost, and see the results stay in parity
across a Leaflet map, a table and a live count badge.

> **Synthetic data notice:** all programs are generated sample data using real
> provider names — program details, locations, costs, and vacancies are
> simulated. Discovery only — not eligibility determination or verified
> availability. Do not rely on them for any housing decision.

## Setup

```sh
npm install
```

## Scripts

| Script           | What it does                                  |
| ---------------- | --------------------------------------------- |
| `npm run dev`    | Start the Vite dev server                     |
| `npm run test`   | Run the Vitest suite once                     |
| `npm run check`  | Type-check with `svelte-check` and `tsc`      |
| `npm run build`  | Production build into `dist/`                 |
| `npm run preview`| Serve the production build locally            |

## Verification

Before considering any change done, all of the following must pass:

```sh
npm run test    # all tests green
npm run check   # zero type errors
npm run build   # build succeeds
```

## Data

- **Sample programs** are generated deterministically at startup by
  `src/lib/data/generate.ts` using a seeded Faker instance — **seed `2026`** — so
  every run produces the exact same 75 programs. Placement uses rejection
  sampling: candidates are drawn from a bounding rectangle and kept only when
  they also fall inside the D.C. boundary polygon.
- **D.C. boundary** is a simplified DC diamond polygon; synthetic data only.

## Map tiles

Map imagery and data © [OpenStreetMap](https://www.openstreetmap.org/copyright)
contributors, served via the `tile.openstreetmap.org` tile layer.

## AI tooling

The [Svelte MCP server](https://svelte.dev/docs/ai) (docs lookup +
`svelte-autofixer`) is configured for:

- **OpenCode** — via the `@sveltejs/opencode` plugin in `opencode.jsonc`
- **VS Code + Claude Code** — via the shared `.mcp.json` at the app root
- **Codex** — via `.codex/config.toml`

Skills are committed under `.agents/skills/` (installed from `sveltejs/ai-tools`
via `bunx skills add sveltejs/ai-tools -a universal -s svelte-code-writer
svelte-core-bestpractices --copy`).

One-time enablement: OpenCode — restart, the plugin auto-loads; VS Code — trust
the workspace and servers start (manage via `MCP: List Servers`); Claude Code —
approve the project server when prompted or via `/mcp`; Codex — trust the
project so `.codex/config.toml` loads. Start each client with `web-app/` as the
project/workspace root (open VS Code on the `web-app` folder; run
`claude`/`codex`/`opencode` from inside `web-app/`) so these project-scope
configs load. See https://svelte.dev/docs/ai for the full docs.

### Subagents

The `svelte-file-editor` subagent (creates/edits/reviews `.svelte` and
`.svelte.ts`/`.svelte.js` files, fetches docs, runs the autofixer) is
available in:

- **OpenCode** — provided by the `@sveltejs/opencode` plugin
- **Claude Code, VS Code, Cursor, GitHub Copilot CLI** — via the shared
  `.claude/agents/svelte-file-editor.md` (Claude agent format, which those
  clients also read)
- **Codex** — via `.codex/agents/svelte-file-editor.toml`

Invoke it explicitly ("use the svelte-file-editor agent to …") or let clients
delegate automatically based on the agent's description.
