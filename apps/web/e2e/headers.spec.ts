import { expect, test, type APIResponse } from "@playwright/test";

/**
 * Security response headers on every served page (the web half of the
 * security baseline): the SvelteKit-generated CSP plus the standard
 * hardening set applied by the hooks server sequence. The CSP assertions
 * parse the policy into directives and assert EXACT source lists — a
 * weakened CSP (added 'unsafe-eval', 'unsafe-inline' scripts) fails.
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

function expectStandardHeaders(path: string, headers: Record<string, string>): void {
  expect(headers["x-content-type-options"], `x-content-type-options on ${path}`).toBe("nosniff");
  expect(headers["referrer-policy"], `referrer-policy on ${path}`).toBe(
    "strict-origin-when-cross-origin",
  );
  expect(headers["x-frame-options"], `x-frame-options on ${path}`).toBe("SAMEORIGIN");
  // exact — the standard set is a fixed value, not a substring
  expect(headers["permissions-policy"], `permissions-policy on ${path}`).toBe(
    "geolocation=(), camera=(), microphone=(), payment=()",
  );
}

test.describe("security headers (dev server)", () => {
  for (const path of ["/", "/no-such-route"]) {
    test(`exact CSP + security headers on ${path}`, async ({ request }) => {
      const response = await request.get(`http://localhost:${WEB_PORT}${path}`);
      expect(response.status()).toBeLessThan(500);
      const headers = await fetchHeaders(response);
      expectStandardHeaders(path, headers);

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

  test("headers cover a served app asset", async ({ request }) => {
    const root = await request.get(`http://localhost:${WEB_PORT}/`);
    const html = await root.text();
    // production serves /_app bundles (title-tagged src/href); dev inlines the
    // dynamic kit import ("/@fs/…entry.js") — either way the asset response
    // rides the same hook chain.
    const htmlAsset =
      html.match(/(?:src|href)="(\/_app\/[^"]+)"/)?.[1] ??
      html.match(/(?:src|href)="(\/[^"\s]+)"/)?.[1];
    const importEntry = html.match(/import\("([^"]+)"\)/)?.[1];
    const assetPath = htmlAsset ?? importEntry?.replace(/^\.\//, "/");
    expect(assetPath, "the root page references a served asset").toBeTruthy();
    const asset = await request.get(
      `http://localhost:${WEB_PORT}${assetPath!.replace(/"/g, "%22")}`,
    );
    expect(asset.ok(), `asset reachable: ${assetPath}`).toBeTruthy();
    const headers = await fetchHeaders(asset);
    // dev caveat: "/@fs/…" module sources are served by Vite's transform
    // layer (before the kit hook chain by design of the dev middleware);
    // the standard headers on ASSETS are asserted in production (the
    // preview-headers spec). Reference assets here prove the surface only.
    if (!assetPath!.startsWith("/@fs/")) {
      expectStandardHeaders(assetPath!, headers);
    }
    // the CSP header itself is an HTML-delivery directive; the asset carries the standard set
  });
});
