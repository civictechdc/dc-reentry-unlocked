import { defineConfig, devices } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";
import rootConfig from "./playwright.config.ts";

/**
 * CI BDD golden-path suite (used by the GitHub Actions e2e job, after the
 * compose servers are up):
 *
 *   pnpm -C apps/web e2e:bdd:ci
 *   # -> bddgen -c playwright-ci-bdd.config.ts && playwright test --config=playwright-ci-bdd.config.ts
 *
 * Same shape as playwright-bdd.config.ts (features + steps under apps/web/e2e,
 * generated output in .features-gen), but with the CI browser matrix and no
 * dev webServer array — Compose serves the API and the built SPA.
 * Both commands run THIS config so bddgen and the test run always agree.
 * Chromium projects get the same software-GL launch args as
 * playwright.ci.config.ts (see the note there).
 *
 * Mobile is deliberately NOT in this matrix: the golden-path steps assert the
 * desktop-class UI state (e.g. the visible card list, which the phone layout
 * keeps behind the List tab). Phone-class behavior has its own dedicated
 * coverage in the spec-suite matrix (mobile.spec.ts on mobile-chromium).
 */

// Headless Firefox on Linux has no WebGL2 path — every context request is
// refused ("AllowWebgl2:false restricts context creation on this system"),
// MapLibre's map throws at boot, and the route collapses into the app's
// error boundary, so the whole firefox leg times out. Headed Firefox gets
// Mesa's llvmpipe software GL and WebGL2 works; CI wraps the suite in
// `xvfb-run` (the workflow files) to provide the display.
// Gated to Linux CI under an X display (the workflows wrap the suite in
// `xvfb-run`, which sets DISPLAY): local runs, macOS, and display-less
// Linux environments keep headless Firefox.
const firefoxHeadedOnLinuxCi =
  process.env.CI !== undefined && process.platform === "linux" && process.env.DISPLAY !== undefined;

const bddTestDir = defineBddConfig({
  featuresRoot: "./e2e/features",
  steps: "./e2e/steps/**/*.ts",
  outputDir: ".features-gen",
});

const ciProjects = [
  {
    name: "desktop-chromium",
    use: {
      ...devices["Desktop Chrome"],
      launchOptions: {
        args: ["--use-gl=angle", "--use-angle=swiftshader"],
      },
    },
  },
  {
    name: "desktop-firefox",
    use: {
      ...devices["Desktop Firefox"],
      launchOptions: { headless: !firefoxHeadedOnLinuxCi },
    },
  },
  {
    name: "desktop-webkit",
    use: { ...devices["Desktop Safari"] },
  },
];

export default defineConfig({
  ...rootConfig,
  testDir: bddTestDir,
  // compose owns the servers — never boot the dev webServers here
  webServer: [],
  // html alongside list: `open: never` keeps the CLI output unchanged while
  // producing the on-disk report the CI on-failure artifact step uploads
  // (the reporter's default folder — apps/web/playwright-report)
  reporter: [["list"], ["html", { open: "never" }]],
  retries: process.env.CI ? 1 : 0,
  projects: ciProjects,
  use: {
    ...rootConfig.use,
  },
});
