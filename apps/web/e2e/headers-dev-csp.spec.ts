import { expect, test, type APIResponse } from "@playwright/test";

/**
 * These assertions pin the DEV-server CSP — inline scripts are the
 * documented dev-only HMR relaxation; the production nonce-based CSP is
 * pinned by the preview-headers probe. The CI compose matrix therefore
 * ignores this file (see the CI config testIgnore).
 *
 * Stray-server hazard: with `reuseExistingServer` outside CI, running the
 * dev suite while the compose boot still serves 5173 reuses the production
 * server and fails this spec (nonce CSP ≠ dev 'unsafe-inline') — stop
 * stray servers first (runbook practice).
 */
const WEB_PORT = 5173;

/** Parse `a 'b'; c d` → { a: ['b'], c: ['d'] }. */
function parseCsp(policy: string): Record<string, string[]> {
  const parsed: Record<string, string[]> = {};
  for (const directive of policy.split(";")) {
    const [name, ...sources] = directive.trim().split(/\s+/);
    if (!name) continue;
    parsed[name.toLowerCase()] = sources.map((source) => source.replace(/^'|'$/g, ""));
  }
  return parsed;
}

async function fetchHeaders(response: APIResponse): Promise<Record<string, string>> {
  // Playwright APIResponse.headers() returns the lowercase header map.
  return (await response.headers()) as Record<string, string>;
}

test.describe("dev-server CSP", () => {
  for (const path of ["/", "/no-such-route"]) {
    test(`exact dev CSP on ${path}`, async ({ request }) => {
      const response = await request.get(`http://localhost:${WEB_PORT}${path}`);
      expect(response.status()).toBeLessThan(500);
      const headers = await fetchHeaders(response);

      const csp = parseCsp(headers["content-security-policy"] ?? "");
      // directory structure: default domain confined to self
      expect(csp["default-src"]).toEqual(["self"]);
      // inline scripts are a DEV-only need (Vite HMR); no eval anywhere
      expect(csp["script-src"] ?? []).toEqual(["self", "unsafe-inline"]);
      expect(csp["script-src"] ?? []).not.toContain("blob:");
      // The MapLibre worker is a same-origin bundled asset (setWorkerUrl) —
      // bare 'self', no blob: anywhere in worker-src.
      expect(csp["worker-src"]).toEqual(["self"]);
      // tiles and the cross-origin housing API stay reachable
      expect(csp["img-src"]).toContain("https://tile.openstreetmap.org");
      expect(csp["connect-src"]).toContain("https://tile.openstreetmap.org");
      expect(csp["connect-src"]).toContain("http://localhost:3000");
      // deny-by-default edges
      expect(csp["object-src"]).toEqual(["none"]);
      expect(csp["frame-ancestors"]).toEqual(["self"]);
    });
  }
});
