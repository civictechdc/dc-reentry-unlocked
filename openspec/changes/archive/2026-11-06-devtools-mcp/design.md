# Design

## Context

The repo already runs one adopted MCP server (Svelte docs + autofixer,
version-pinned, wired via `.mcp.json`, `.codex/config.toml`, and the
`@sveltejs/opencode` plugin) and documents adopt/reject decisions in
AGENTS.md "MCP decisions". Both candidate servers are vendor-sanctioned:

- `chrome-devtools-mcp` — ChromeDevTools org; npm package run via
  `npx chrome-devtools-mcp@<version>`; launches/attaches Chrome via
  puppeteer; requirements: Node LTS, Chrome stable. Documented caveats:
  exposes the browser instance's content to MCP clients; Google usage
  statistics collected by default (`--no-usage-statistics` opts out,
  `CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS` env also disables); periodic
  npm update checks by default (`CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS`
  disables); performance tools may query Google CrUX
  (`--no-performance-crux` disables).
- `@mozilla/firefox-devtools-mcp` (PUBLIC npm build; Mozilla's
  firefox-devtools-mcp — user decision 2026-11-05: the `-moz` name is
  the internal build and was rejected at review) — run via npx; drives
  Firefox over WebDriver BiDi (Classic fallback);
  requirements: Node ≥ 20.19.0 and a system Firefox (any channel). Options
  include `--headless`, `--viewport`, `--firefox-path`, `--profile-path`,
  `--tools`. The public build strips the privileged-context/prefs/launch/bidi
  modules that exist only in the internal `-moz` build (verified from the
  published artifact at implementation time).

## Decisions

**D1 — Pin versions, never `@latest`.** Both servers are invoked as
`npx <pkg>@<exact-version>`. Both upstreams default to drifting
(`@latest` in every example; chrome-devtools-mcp additionally polls npm
for updates). Repo policy (established for the Svelte MCP): bumps are
deliberate, reviewed changes. Pinning an npx invocation means no lockfile
entry — the pin lives in the agent config files, which are
security-sensitive and reviewed as such.

**D2 — Start chrome-devtools-mcp with telemetry and update checks off.**
Args: `--no-usage-statistics` (and set
`CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS=1` in the server env if the client
config supports per-server env; else document the accepted residual). If
performance-tool CrUX lookups are a concern at review time, add
`--no-performance-crux`.

**D3 — Config surface: follow the Svelte MCP wiring exactly.** Same files
(`.mcp.json` for VS Code + Claude Code, `.codex/config.toml` for Codex) so
one review pattern covers all servers. For opencode, verify the current
native MCP config mechanism in opencode's docs at implementation time
(opencode config supports MCP servers directly; do not assume the plugin
path used for Svelte). Do not install into user-global scopes — repo-local
only, so a fresh clone reviews before trusting.

**D4 — Document both in AGENTS.md MCP decisions** with trust notes:
chrome-devtools-mcp exposes browser content to the agent and launches a
local Chrome (no network ingress); telemetry explicitly disabled here;
Firefox server drives a local Firefox via WebDriver — pin the PUBLIC
build (`@mozilla/firefox-devtools-mcp`), whose internal-only
privileged-context/prefs/launch/bidi modules are stripped at the source
level (the `-moz` internal build was rejected at review, user decision
2026-11-05); prefer `--profile-path` isolation so the agent never touches
the user's real Firefox profile.

**D5 — Verified boot, not just config.** Acceptance: each server starts
from the repo config and completes one trivial live inspection (navigate
to the dev boot URL, read a page title, take a screenshot) in its
respective browser. If a server cannot run headless in the implementer's
environment, record the constraint in AGENTS.md rather than dropping
verification.

## Risks / Trade-offs

- Security-sensitive surface: both servers execute local browser control
  with agent privileges. Mitigated by: repo-local install, version pins,
  review of the config diff, profile isolation for Firefox, and the
  existing AGENTS.md trust-note pattern.
- npx-pinned servers re-resolve from the npm registry on cache miss —
  same residual supply-chain trust as the Svelte MCP today; documented,
  accepted.
- Firefox server requires a system Firefox; absent machines get a
  documented prerequisite rather than a hard failure elsewhere.
