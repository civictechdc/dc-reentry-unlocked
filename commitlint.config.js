// Conventional Commits enforcement (commit-msg git hook).
// config-conventional accepts any scope (it constrains TYPES, not scopes:
// build/chore/ci/docs/feat/fix/perf/refactor/revert/style/test); project docs
// recommend keeping scopes aligned to the workspace names (api, web, shared,
// datagen) but that is documentation, not an enforced rule.
export default {
  extends: ["@commitlint/config-conventional"],
};
