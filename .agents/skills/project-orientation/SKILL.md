---
name: project-orientation
description: >
  Orientation for agents working in the dc-reentry-unlocked repository —
  architecture map, verification commands, seam rules, and domain pointer.
  Use when starting a session in this repo or when unsure where things live.
---

# DC Reentry Housing Discovery — project orientation

Display prototype: MapLibre map + card list of available synthetic DC
reentry-housing units, schema-driven filtering, slide-over detail ending at
provider contact info. The API boundary is the stable seam. Full product
truth: the machine-local OpenSpec planning workspace at the container level
(run `openspec` commands from there — this repo intentionally carries no
spec folder).

## Monorepo layout

| Path               | Role                                                                   |
| ------------------ | ---------------------------------------------------------------------- |
| `apps/web`         | SvelteKit frontend (Svelte 5 runes, SPA mode), typechecked with `tsc6` |
| `apps/api`         | Fastify backend, TypeBox validation                                    |
| `packages/shared`  | TypeBox schemas + TS types — THE API CONTRACT                          |
| `tools/datagen`    | Deterministic synthetic dataset generator (fixed seed)                 |
| `data/`            | Frozen generated dataset, committed — never hand-edit                  |
| `docs/glossary.md` | Ubiquitous domain language (provider, program, unit, …)                |

## Architecture seams (enforced by `pnpm arch:check`, not good intentions)

- `packages/shared` imports nothing from `apps/*` or `tools/*`.
- Each app/tool imports only `packages/shared`.
- `packages/shared`'s `testing` subpath (fluent domain builders) is imported
  only from test files.
- `apps/api` routes reach data only through the `DataSource` module, never
  the dataset file directly.
- No dependency cycles.

## Verification commands (repo root)

```sh
pnpm lint          # oxlint + ESLint (JSON)
pnpm format:check  # oxfmt (pnpm format to fix)
pnpm test          # Vitest every workspace (incl. fast-check property tests)
pnpm typecheck     # tsc (TS 7) for shared/api/datagen; tsc6 for apps/web
pnpm arch:check    # dependency-cruiser seam rules
```

Run the relevant subset before claiming any task done; the pre-push git hook
runs typecheck + arch:check regardless. Conventional Commits only:
`type(scope): subject` — scopes are workspace names (`api`, `web`, `shared`,
`datagen`), body lines ≤ 100 chars; the commit-msg hook enforces it.

## Domain rules that trip agents

- Unknown ("not publicly listed") is a representable state — never fold it
  into yes/no. See `docs/glossary.md` and AGENTS.md "Unknown honesty".
- Only **available** units surface; not-available and unverified-availability
  units are hidden from listings, map pins, and card lists.
- The dataset is synthetic by contract: fictional providers, generated
  building numbers — no real listing anywhere.
- TypeScript is dual-version by design (TS 7 standard, TS 6 pinned for
  Svelte tooling) — do not "fix" the split.
- Dev servers (`pnpm dev`, compose) do not exist yet; they are planned, not
  yet landed.
