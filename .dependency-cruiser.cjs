/**
 * dependency-cruiser config — executable architecture rules.
 *
 * Seams enforced:
 *  1. packages/shared imports nothing from apps/* or tools/*
 *  2. each app/tool imports only packages/shared among workspace packages
 *     (verified per workspace: web, api, datagen)
 *  3. inside apps/api only the DataSource module reads the dataset file
 *     (forward-looking: the API has no data-serving layer yet — the
 *     DataSource module and the frozen dataset land with that layer)
 *  4. the shared test-only `testing` subpath ships with the shared
 *     contracts. No non-test file may reach it — directly, or transitively
 *     through a test file that re-exports it (the reachability rule below
 *     closes the re-export laundering path)
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
        "Routes reach data only through the DataSource module (the units decoration is the working seam — production route modules have no other data import). This rule is a static-import backstop: it catches statically or dynamically imported dataset paths; a computed fs pathname string is invisible to dependency analysis (which is also why the DataSource module itself reads the file with fs.readFile rather than an import).",
      from: { path: "^apps/api/", pathNot: "[Dd]ata[Ss]ource" },
      to: { path: "(^|/)data/units\\.v\\d+\\.json$" },
    },
    {
      name: "shared-testing-subpath-not-reachable-from-non-test-files",
      severity: "error",
      comment:
        "The domain builders under packages/shared testing are a test-only export: no non-test file may reach them — directly, or transitively through a test file that re-exports them. Matches both layouts: packages/shared/testing/** and packages/shared/src/testing/**. Exception: helper modules inside a workspace's test/ directory (fixture builders etc.) take part in the tested suite; they stay unreachable from production code because production modules never live under test/.",
      from: {
        pathNot: [
          "\\.(test|spec)\\.(?:[cm]?[jt]s)$",
          "^packages/shared/(src/)?testing(/|$)",
          "^apps/api/test/",
        ],
      },
      to: {
        path: "^packages/shared/(src/)?testing(/|$)",
        reachable: true,
      },
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
    // `build/` covers app build outputs (gitignored; the adapter-node build is
    // materialized by the production e2e probe and must not be cruised)
    doNotFollow: { path: "node_modules|(^|.*/)(build|dist|coverage|\\.svelte-kit|test-results)/" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
    },
  },
};
