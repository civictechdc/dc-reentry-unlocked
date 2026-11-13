import { join } from "node:path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig } from "vitest/config";

/**
 * Component/store test configuration (fast failure surface — the real-map
 * and end-to-end behaviors are proven in the Playwright e2e suite instead).
 * The SvelteKit Vite plugin is deliberately NOT loaded here: route files can
 * still mount directly through a test-only harness (root-layout-disclosure.test.ts)
 * but `$app/*` runtime modules and the real router stay e2e-covered.
 */
export default defineConfig({
  plugins: [
    svelte(),
    svelteTesting(),
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/lib/paraglide",
      emitTsDeclarations: true,
      strategy: ["url", "cookie", "baseLocale"],
    }),
  ],
  resolve: {
    alias: {
      // Mirrors the package.json `imports` entry so test entries resolve
      // identically to app code.
      "#lib": join(__dirname, "src", "lib"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
