import { defineConfig } from "vitest/config";

// Root-level tests are for repo tooling that lives outside the workspaces
// (e.g. scripts/agent-hooks). Workspace tests keep running via `pnpm -r run
// test`; this config only picks up the out-of-workspace suite.
export default defineConfig({
  test: {
    include: ["scripts/agent-hooks/*.test.mjs"],
  },
});
