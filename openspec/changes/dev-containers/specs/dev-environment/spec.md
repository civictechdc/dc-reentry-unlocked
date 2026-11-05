# Spec Delta

## ADDED Requirements

### Requirement: Containerized development environment

The repo SHALL provide a dev container configuration conforming to the
dev container implementor's spec, so a contributor or agent gets the
full toolchain (Node ≥ 22.12, pnpm ≥ 12.15, Playwright browsers) in one
command from any spec-consuming editor or service, with the repo's gates
runnable inside the container.

#### Scenario: One-command environment boot

- **WHEN** a contributor opens the repo in a dev-container-supporting editor (VS Code, Zed) or GitHub Codespaces
- **THEN** the container builds and provisions the toolchain via its configuration and post-create command, with no machine-specific manual setup

#### Scenario: Dev ports forwarded

- **WHEN** the dev stack or the e2e matrix runs inside the container
- **THEN** the API (3000), web dev (5173), and prod-probe (4317) ports are reachable from the host

#### Scenario: Gates pass in a fresh container

- **WHEN** the deterministic gates (`lint`, `format:check`, `test`, `typecheck`, `arch:check`) and then the e2e matrix (`e2e`, `e2e:bdd`, `e2e:prod`) run against a freshly built container
- **THEN** every gate passes inside the container, including the e2e servers it boots itself

#### Scenario: Onboarding documented

- **WHEN** a new contributor reads the runbook
- **THEN** the container onboarding path sits alongside the existing fresh-clone verification path, with any per-editor notes recorded honestly
