import "@testing-library/jest-dom/vitest";
import { FEATURE_FLAGS, flagDefineKey } from "./src/lib/flags/registry.ts";

// Vitest does not apply vite.config.ts `define` entries, so the flag
// machinery's dev-server global defaults to false under test, and every
// registered flag define does too (mirroring any build, where they fold to
// false); guarded-branch tests stub these globals per case (src/lib/flags).
(globalThis as { __DEV_SERVER__?: boolean }).__DEV_SERVER__ ??= false;
for (const name of FEATURE_FLAGS) {
  (globalThis as Record<string, boolean | undefined>)[flagDefineKey(name)] ??= false;
}
