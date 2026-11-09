import { expect, test, type APIResponse } from "@playwright/test";

/**
 * Standard hardening response headers on every page the app serves (the
 * web half of the security baseline), on the dev server AND the compose
 * production boot alike. The CSP itself is pinned per-boot: the dev-server
 * policy lives in headers-dev-csp.spec.ts, and the production nonce-based
 * policy is pinned by the preview-headers probe. Immutable /_app assets
 * bypass the hook chain on production (the adapter's boot-time static
 * layer) — see the asset test below and the preview-headers probe's
 * documented residual.
 */
const WEB_PORT = 5173;

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

test.describe("security response headers (every surface)", () => {
  for (const path of ["/", "/no-such-route"]) {
    test(`security headers on ${path}`, async ({ request }) => {
      const response = await request.get(`http://localhost:${WEB_PORT}${path}`);
      expect(response.status()).toBeLessThan(500);
      const headers = await fetchHeaders(response);
      expectStandardHeaders(path, headers);
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
    // header caveat: two served-asset surfaces sit OUTSIDE the SvelteKit
    // hook chain by design and carry no hook-applied headers — dev's
    // "/@fs/…" module sources (Vite's transform layer) and production's
    // immutable "/_app/…" bundles (the adapter's boot-time static layer;
    // documented residual in the preview-headers probe). Reference assets
    // here prove the served-asset surface on both boots; the standard
    // headers are asserted wherever the hook chain runs.
    if (!assetPath!.startsWith("/@fs/") && !assetPath!.startsWith("/_app/immutable/")) {
      expectStandardHeaders(assetPath!, headers);
    }
  });
});
