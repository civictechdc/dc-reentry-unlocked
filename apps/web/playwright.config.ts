import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * E2E suite: boots the housing API and the web dev server (documented
 * Playwright `webServer` array support — readiness URLs gate each server).
 */
const repoRoot = join(import.meta.dirname, "..", "..");

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  webServer: [
    {
      command: "pnpm -C apps/api dev",
      cwd: repoRoot,
      url: "http://127.0.0.1:3000/health",
      name: "housing-api",
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      // The prod project's browser probe loads the SPA from the adapter-node
      // server on port 4317 — bless that origin so its cross-origin unit
      // fetches pass the API's fail-closed CORS allow list.
      env: {
        ...process.env,
        API_CORS_ORIGINS: "http://localhost:5173,http://localhost:4317",
      },
    },
    {
      command: "pnpm dev",
      url: "http://localhost:5173",
      name: "housing-web",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
  use: {
    baseURL: "http://localhost:5173",
  },
  projects: [
    {
      name: "desktop-chrome",
      testMatch: /.*\.spec\.ts/,
      testIgnore: /preview-headers\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // production-build probe: `pnpm e2e:prod` (vite build + adapter-node server)
      name: "prod",
      testMatch: /preview-headers\.spec\.ts/,
      // the build itself is part of the suite
      timeout: 300_000,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
