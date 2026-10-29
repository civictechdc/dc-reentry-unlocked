# Git hooks setup (config-based, Git >= 2.54)

This project ships its git hooks through a checked-in git config file
(`gitconfig/hooks.config`) — no hook runner (husky/lefthook) is used.

**Requirement: git >= 2.54** (hooks-in-config support). Check yours with
`git --version`. CI (planned, not yet landed) will use a modern runner and verify
the version; on older git the hooks silently don't exist — CI will still
enforce everything the hooks do, but local feedback will skip them.

## One-time setup (per worktree)

```sh
git config --local include.path "$(git rev-parse --show-toplevel)/gitconfig/hooks.config"
```

Then confirm registration:

```sh
git hook list pre-commit
# expect: dc-fmt-lint-staged
```

## What runs when

| Event      | Script (`scripts/hooks/`) | Checks                                                  |
| ---------- | ------------------------- | ------------------------------------------------------- |
| pre-commit | `pre-commit`              | `oxfmt --check` + `oxlint` on staged files only         |
| pre-push   | `pre-push`                | `pnpm typecheck` + `pnpm arch:check`                    |
| commit-msg | `commit-msg`              | `commitlint` (Conventional Commits, conventional types) |

Commit messages follow Conventional Commits: `type(scope): subject`.

- **Type** is one of the conventional enum values: `build`, `chore`, `ci`,
  `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test`.
- **Scope** is optional; the project convention is to align it to the
  workspace names (`api`, `web`, `shared`, `datagen`).
- `scope: subject` without a valid type is **rejected** by the commit-msg hook.

Examples that pass the gate: `feat(shared): add unit card schema`,
`chore(api): scaffold fastify app`.

Notes:

- Hooks run with the repository root as working directory; the committed
  scripts resolve `pnpm` from your PATH (run `pnpm install` before).
- Git 2.54 runs config-hook commands sequentially; 2.55+ runs them in
  parallel — both are fine at this scale.
- Hook-script changes commit like any file — nothing to reinstall.
