import { defineConfig, devices } from "@playwright/test";
import rootConfig from "./playwright.config.ts";

/**
 * CI e2e matrix config (used by the GitHub Actions e2e job):
 *
 *   pnpm -C apps/web e2e:ci
 *
 * Differences from the dev config (playwright.config.ts):
 * - `webServer: []` overrides the dev webServer array — CI boots the API and
 *   the production-built SPA with Docker Compose (compose.yaml) before the
 *   suite starts, reusing the same 3000/5173 ports in complete form.
 * - Runs the regular spec suite (not the `prod` build probe — that stays in
 *   `e2e:prod`, which builds and serves the adapter-node output itself) on a
 *   browser matrix. Every project carries the dev suite's match rules.
 * - Chromium gets software-GL launch args so the MapLibre canvas renders on
 *   runner hosts without a GPU; the software-GL vars for Firefox/WebKit are
 *   set in CI workflow env (mesa fallthrough). WebKit/Firefox still exercise
 *   their own GL pipeline for the canvas assertions.
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

// The CI compose boot serves the production build, so the dev-server CSP
// spec is excluded from every project here: its inline-script relaxation is
// a dev-only HMR need and cannot hold against the production nonce-based
// CSP by design (the production policy is pinned by the preview-headers
// probe). Remove this exclusion when a compose/production CSP variant spec
// lands.
const ciProjects = [
  {
    name: "desktop-chromium",
    testMatch: /.*\.spec\.ts/,
    testIgnore: /\/(?:headers-dev-csp|preview-headers)\.spec\.ts$/,
    use: {
      ...devices["Desktop Chrome"],
      launchOptions: {
        // software GL (SwiftShader) so MapLibre's WebGL2 canvas renders on
        // headless runners without a GPU
        args: ["--use-gl=angle", "--use-angle=swiftshader"],
      },
    },
  },
  {
    name: "desktop-firefox",
    testMatch: /.*\.spec\.ts/,
    testIgnore: /\/(?:headers-dev-csp|preview-headers)\.spec\.ts$/,
    use: {
      ...devices["Desktop Firefox"],
      launchOptions: { headless: !firefoxHeadedOnLinuxCi },
    },
  },
  {
    name: "desktop-webkit",
    testMatch: /.*\.spec\.ts/,
    testIgnore: /\/(?:headers-dev-csp|preview-headers)\.spec\.ts$/,
    use: { ...devices["Desktop Safari"] },
  },
  {
    name: "mobile-chromium",
    testMatch: /.*\.spec\.ts/,
    testIgnore: /\/(?:headers-dev-csp|preview-headers)\.spec\.ts$/,
    // The phone layout renders no results-count line and keeps the filter
    // options behind the sheet — three desktop-layout-coupled tests would
    // only ever time out on this project (they wait for a text or control
    // the phone layout does not expose). Three more desktop-canvas proofs
    // also descope from the phone project: the label composite paints at a
    // different offset under phone emulation, canvas hover paints nothing
    // under touch emulation, and the click-off dismissal does not fire.
    // Phone-class behavior keeps its dedicated coverage in the phone-native
    // specs (mobile.spec.ts tabs/sheet/cards/detail, the map-label phone
    // remount, map-focus phone, tap-drag pan).
    grepInvert:
      /axe scan reports no serious violations|keyboard-only usage reaches filters|pin re-render < 100ms budget|clicking empty canvas with the detail open|selecting a unit keeps its address label painted|hovering a canvas pin paints/,
    use: {
      ...devices["Pixel 7"],
      launchOptions: {
        args: ["--use-gl=angle", "--use-angle=swiftshader"],
      },
    },
  },
];

export default defineConfig({
  ...rootConfig,
  // compose owns the servers — never boot the dev webServers here
  webServer: [],
  // html alongside list: `open: never` keeps the CLI output unchanged while
  // producing the on-disk report the CI on-failure artifact step uploads
  // (the reporter's default folder — apps/web/playwright-report)
  reporter: [["list"], ["html", { open: "never" }]],
  // axe-core scans under software rendering need wall-clock margin; two
  // workers keep matrix projects from starving each other's heavy scans
  timeout: 90_000,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  projects: ciProjects,
  use: {
    ...rootConfig.use,
  },
});
