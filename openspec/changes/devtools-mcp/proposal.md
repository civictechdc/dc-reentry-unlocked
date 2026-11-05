# Proposal

## Why

Browser-adjacent debugging by agents is currently ad hoc: this session's
desktop-layout measurement needed a throwaway Playwright script because no
browser-inspection MCP is wired into the repo's agent surface. The two
vendor-sanctioned devtools MCP servers would give every agent in this repo
live DOM inspection, console/network visibility, and screenshots against the
dev servers — the same capability the walkthrough-harness change wants, and
the standard tooling for layout/visual bug reports like the one this session
handled (2026-11-05: desktop map sizing, verified by measured preview).

## What Changes

- Install and pin `chrome-devtools-mcp` (ChromeDevTools/chrome-devtools-mcp,
  Apache-2.0, npm `chrome-devtools-mcp`) as an MCP server across the repo's
  agent configs — pinned version, NOT `@latest`, and started with
  `--no-usage-statistics` (Google telemetry is default-on)
- Install and pin `@mozilla/firefox-devtools-mcp-moz` (Mozilla's
  firefox-devtools-mcp; requires Node ≥ 20.19 and a system Firefox) the same
  way
- Wire both into the repo's agent config surfaces following the Svelte MCP
  precedent (`.mcp.json`, `.codex/config.toml`, opencode config — exact
  opencode wiring verified against current docs at implementation time)
- AGENTS.md MCP-decisions section gains both entries with trust notes
  (browser-content exposure, telemetry opt-out, pin/no-auto-update policy)
- Config diffs reviewed as security-sensitive surfaces per AGENTS.md

## Capabilities

### New Capabilities

### Modified Capabilities

(No spec delta: agent dev tooling, no product behavior — `skip_specs` per
the repo's established pattern for non-behavioral changes.)

## Impact

- **Code:** none (no product code) — agent-surface config only:
  `.mcp.json`, `.codex/config.toml`, opencode config, `AGENTS.md`
- **APIs / Dependencies:** two pinned npm MCP server packages run via npx;
  no product dependencies change
- **Docs:** AGENTS.md MCP decisions section
- **Sequencing:** independent; implementation deliberately deferred (user
  decision 2026-11-05: plan now, install in a later session)

## Non-goals

- No CI usage of either server (dev-session tooling only; the e2e suites
  keep their existing Playwright setup)
- No change to the product app, its dependencies, or the walkthrough harness
- No auto-updating installs (`@latest`) — version pins, deliberate bumps
