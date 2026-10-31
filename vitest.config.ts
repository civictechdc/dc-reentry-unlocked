import { defineConfig } from "vitest/config";

// Root-level tests cover the repo tooling that lives outside the workspaces:
// the agent hooks and the gate-critical CI scripts. Workspace tests keep
// running via `pnpm -r run test`; this config picks up the out-of-workspace
// suites.
export default defineConfig({
  test: {
    include: ["scripts/*.test.mjs", "scripts/agent-hooks/*.test.mjs"],
  },
});
