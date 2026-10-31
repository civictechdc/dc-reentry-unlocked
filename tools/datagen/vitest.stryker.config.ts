// @ts-nocheck
import { defineConfig } from "vitest/config";

/**
 * Vitest config used only by Stryker's mutation runs (see
 * stryker.config.json → vitest.configFile). Mutation instrumentation slows
 * the property-based dataset invariants ~10×, faster-check timeouts first at
 * the default 5s; a generous per-test window keeps the dry run green without
 * weakening the real suite (this file is not picked up by plain `vitest`).
 */
export default defineConfig({
  test: {
    testTimeout: 60_000,
  },
});
