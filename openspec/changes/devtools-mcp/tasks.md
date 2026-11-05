# Tasks

## 1. Verify and wire (agent tooling)

- [ ] 1.1 Re-verify install facts against the primary sources at implementation time (chrome-devtools-mcp: GitHub README/npm for the current pinned version, flags `--no-usage-statistics` / `--no-performance-crux`, env `CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS`, config-shape examples; @mozilla/firefox-devtools-mcp-moz: Mozilla's firefox-devtools-mcp docs for version, Node ≥ 20.19 requirement, system-Firefox prerequisite, and flags) — record exact versions chosen and any drift from this change's design notes
- [ ] 1.2 Wire both servers, version-pinned per design, into the repo agent configs following the Svelte MCP precedent (`.mcp.json`, `.codex/config.toml`; opencode via its current native MCP config mechanism, verified against current opencode docs — no user-global installs); chrome-devtools-mcp started with telemetry off; firefox server started with an isolated `--profile-path` scratch profile
- [ ] 1.3 Add both to AGENTS.md "MCP decisions" with trust notes (browser-content exposure, telemetry-disabled, pin/no-auto-update policy, Firefox scratch-profile rule, privileged-context tools out of scope for web-app debugging); treat the config diff as security-sensitive per AGENTS.md and have it explicitly reviewed as such
- [ ] 1.4 Verify each server boots from the repo config and completes one trivial live inspection against the dev boot (navigate, read title, screenshot) in Chrome and Firefox respectively; document any environment constraint (e.g. headless unavailability) in AGENTS.md; run `pnpm lint`, `pnpm format:check`, and `openspec validate devtools-mcp --strict`

## Workflow follow-up

- After all tasks complete: run code review per project policy (security-sensitive-surface scrutiny for the config files), resolve findings, then archive this change (`openspec archive`) and verify the archived specs.
