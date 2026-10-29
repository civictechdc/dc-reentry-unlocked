/**
 * dependency-cruiser config — executable architecture rules (design D18).
 *
 * Seams enforced:
 *  1. packages/shared imports nothing from apps/* or tools/*
 *  2. each app/tool imports only packages/shared among workspace packages
 *     (verified per workspace: web, api, datagen)
 *  3. inside apps/api only the DataSource module reads the dataset file
 *     (rule is forward-looking: DataSource + dataset arrive in blocks 4–5)
 *  4. the shared test-only `testing` subpath is imported only from test files
 *     (forward-looking: subpath arrives in task 3.6)
 *  5. no circular dependencies
 *
 * NOTE: paths matched here are cwd-relative — the regexes only match when
 * dependency-cruiser runs with the repo root as working directory. Always
 * invoke via `pnpm arch:check` from the repo root (single `.` argument) —
 * running from a subdirectory silently disables the rules. Cross-workspace
 * imports must use package-style imports (@dc-reentry/*) or resolvable
 * relative paths; the shared `exports` field makes those resolve
 * consistently.
 */
module.exports = {
  forbidden: [
    {
      name: "shared-imports-nothing-from-apps-or-tools",
      severity: "error",
      comment:
        "packages/shared is the contract package: it must not depend on any consumer (apps/web, apps/api, tools/datagen).",
      from: { path: "^packages/shared/" },
      to: { path: "^(apps|tools)/" },
    },
    {
      name: "web-imports-only-shared",
      severity: "error",
      comment:
        "apps/web may reach other workspace packages only via @dc-reentry/shared; web/api imports are forbidden (the API boundary is the seam).",
      from: { path: "^apps/web/" },
      to: {
        path: "^(apps|tools)/|^packages/[^/]*/",
        pathNot: ["^apps/web/", "^packages/shared/"],
      },
    },
    {
      name: "api-imports-only-shared",
      severity: "error",
      comment:
        "apps/api may reach other workspace packages only via @dc-reentry/shared; direct api→web (or api→any sibling app) imports are forbidden.",
      from: { path: "^apps/api/" },
      to: {
        path: "^(apps|tools)/|^packages/[^/]*/",
        pathNot: ["^apps/api/", "^packages/shared/"],
      },
    },
    {
      name: "datagen-imports-only-shared",
      severity: "error",
      comment: "tools/datagen may reach other workspace packages only via @dc-reentry/shared.",
      from: { path: "^tools/datagen/" },
      to: {
        path: "^(apps|tools)/|^packages/[^/]*/",
        pathNot: ["^tools/datagen/", "^packages/shared/"],
      },
    },
    {
      name: "api-route-must-not-read-dataset-directly",
      severity: "error",
      comment:
        "Routes reach data only through the DataSource module; the frozen dataset file is never loaded by route code directly (protects the ingestion-pipeline seam). Active once apps/api has routes (block 5).",
      from: { path: "^apps/api/", pathNot: "[Dd]ata[Ss]ource" },
      to: { path: "(^|/)data/units\\.v\\d+\\.json$" },
    },
    {
      name: "shared-testing-subpath-imported-only-from-test-files",
      severity: "error",
      comment:
        "The domain builders under packages/shared testing are a test-only export; production code must never import them. Matches both layouts: packages/shared/testing/** and packages/shared/src/testing/**. Active once the subpath ships (task 3.6).",
      from: { pathNot: "\\.(test|spec)\\.(?:[cm]?[jt]s)$" },
      to: { path: "^packages/shared/(src/)?testing(/|$)" },
    },
    {
      name: "no-circular-dependencies",
      severity: "error",
      comment: "No cycles anywhere in the graph.",
      from: {},
      to: { circular: true },
    },
  ],
  required: [],
  options: {
    // catch type-only and unused imports — the contract seams are in types
    tsPreCompilationDeps: true,
    doNotFollow: { path: "node_modules" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
    },
  },
};
