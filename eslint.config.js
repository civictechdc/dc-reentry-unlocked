import json from "eslint-plugin-json";

// ESLint is scoped to plain JSON files only (oxlint lints JS/TS, oxfmt only
// formats JSON). Flat config; JS files are intentionally not matched.
// No comments allowed in .json files (jsonc configs use the .jsonc extension).
const ignores = [
  "**/node_modules/**",
  "**/dist/**",
  "**/coverage/**",
  "data/**",
  ".superpowers/**",
  ".agents/local/**",
];

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores,
  },
  {
    files: ["**/*.json"],
    ...json.configs["recommended"],
  },
];
