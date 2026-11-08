import "@testing-library/jest-dom/vitest";

// Vitest does not apply vite.config.ts `define` entries, so the flag
// machinery's dev-server global defaults to false under test; the flag
// tests stub it per case (src/lib/flags).
(globalThis as { __DEV_SERVER__?: boolean }).__DEV_SERVER__ ??= false;
