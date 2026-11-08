import { expect, test, type APIResponse } from "@playwright/test";

/**
 * These assertions pin the production/compose CSP — the nonce-based policy
 * (inline scripts are the dev-server-only HMR relaxation, asserted by the
 * dev-CSP spec). Runs in the CI compose matrix on every PR; the dev suite
 * ignores this file (see playwright.config.ts).
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

test.describe("production CSP (compose boot)", () => {
  for (const path of ["/", "/no-such-route"]) {
    test(`exact production CSP on ${path}`, async ({ request }) => {
      const response = await request.get(`http://localhost:${WEB_PORT}${path}`);
      expect(response.status()).toBeLessThan(500);
      const headers = await fetchHeaders(response);

      const csp = parseCsp(headers["content-security-policy"] ?? "");
      // production script-src: 'self' plus kit's per-request nonce — the
      // generator's shape with allowInlineScripts unset (csp.ts), no
      // inline/eval/blob anywhere in the script domain
      expect(csp["script-src"]).toEqual(["self", expect.stringMatching(/^nonce-/)]);
      expect(csp["script-src"] ?? []).not.toContain("unsafe-inline");
      expect(csp["script-src"] ?? []).not.toContain("unsafe-eval");
      expect(csp["script-src"] ?? []).not.toContain("blob:");
      // directory structure: default domain confined to self
      expect(csp["default-src"]).toEqual(["self"]);
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
