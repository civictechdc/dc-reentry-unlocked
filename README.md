# DC Reentry Housing Discovery

A display prototype for exploring reentry-housing options in Washington,
DC: available housing units shown on an interactive map and a card list,
with filterable results and a detail panel that ends at the provider's
contact information.

**Synthetic data notice:** every provider, address, name, and phone number
in this prototype is fabricated — generated deterministically on real DC
geography (street geometry and ward boundaries) but never copied from any
real listing or address source, with no real organization or contact
number appearing anywhere. Suitable for evaluation only: always confirm
availability and eligibility with the provider. See
[docs/data-synthetic.md](docs/data-synthetic.md) for the policy.

## Project navigation

| Path              | What lives there                                                                                                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web`        | The map + card-list application (SvelteKit)                                                                                                                                                                                                      |
| `apps/api`        | The HTTP API that serves units and the published filter schema                                                                                                                                                                                   |
| `packages/shared` | The API contract: schemas and types shared front and back                                                                                                                                                                                        |
| `tools/datagen`   | The deterministic synthetic-data generator                                                                                                                                                                                                       |
| `data/`           | Frozen generated dataset + the DC geography corpus it generates against                                                                                                                                                                          |
| `docs/`           | API notes (`api.md`), contracts (`shared-contracts.md`), synthetic-data policy (`data-synthetic.md`), performance notes (`perf-notes.md`), domain glossary (`glossary.md`), git hooks setup (`git-hooks-setup.md`), the run story (`runbook.md`) |

Contributor and agent conventions (committed conventions, review guidelines,
Svelte AI tooling) live in [AGENTS.md](AGENTS.md).

## Running it

Prerequisites: Node ≥ 22.12, pnpm ≥ 12
(`corepack enable pnpm`), and git ≥ 2.54 (only needed for the optional
project git hooks).

```sh
git clone https://github.com/civictechdc/dc-reentry-unlocked.git
cd dc-reentry-unlocked

pnpm install

# optional, git >= 2.54: staged-file format/lint checks + commit checks
git config --local include.path "$(git rev-parse --show-toplevel)/gitconfig/hooks.config"

pnpm dev
```

`pnpm dev` starts both dev servers: the web app at
[localhost:5173](http://localhost:5173/) and the API at
[localhost:3000](http://localhost:3000/) (`/health`, `/units`, `/filters`).

The same stack also boots with zero local toolchain in a dev container —
VS Code Dev Containers, Zed, or GitHub Codespaces, needing only Docker or
Podman plus a supporting editor. See the runbook's container section and
[docs/dev-container.md](docs/dev-container.md).

The same stack can run from the built images instead of the dev servers:

```sh
docker compose up -d     # API healthcheck + web healthcheck, then localhost:5173
```

The full run story — dev boot, the Compose boot (smoke checks, teardown,
host overrides), and dataset regeneration — lives in
[docs/runbook.md](docs/runbook.md).

## Tests

| Command                                            | What it covers                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| `pnpm test`                                        | Unit and integration tests across all workspaces                   |
| `pnpm -C apps/web e2e`                             | Browser golden paths (map, filters, detail) on the dev server      |
| `pnpm -C apps/web e2e:bdd`                         | The Gherkin golden paths (`e2e/features`) against the booted stack |
| `pnpm -C apps/web e2e:prod`                        | Probes against the production build (headers, asset serving)       |
| `pnpm arch:check`                                  | The architecture rules between the workspaces (the seams)          |
| `pnpm lint`, `pnpm format:check`, `pnpm typecheck` | Code quality, formatting, and type gates                           |

## Contributing

- [AGENTS.md](AGENTS.md) — conventions and review guidelines (the Svelte
  AI-tooling setup for agents is described there).
- [docs/git-hooks-setup.md](docs/git-hooks-setup.md) — the git hook
  setup and what each hook gates.
- [docs/data-synthetic.md](docs/data-synthetic.md) — the synthetic-data
  policy (what is fabricated and how generation stays deterministic).
