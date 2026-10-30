import { execSync, spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

/**
 * Production-build probe (runs in its own `prod` project / `e2e:prod` script):
 * `vite build` (adapter-node output) is served by a real Node server on a
 * scratch port, and the root page's CSP is parsed and asserted — production
 * script-src must carry NO blob: (workers carry it) and NO eval/inline.
 */

const APP_DIR = import.meta.dirname;
const PROD_PORT = 4317;
const PROD_URL = `http://localhost:${PROD_PORT}`;

let server: ChildProcess | null = null;

function parseCsp(policy: string): Record<string, string[]> {
  const parsed: Record<string, string[]> = {};
  for (const directive of policy.split(";")) {
    const [name, ...sources] = directive.trim().split(/\s+/);
    if (!name) continue;
    parsed[name.toLowerCase()] = sources.map((source) => source.replace(/^'|'$/g, ""));
  }
  return parsed;
}

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    try {
      const probe = await fetch(PROD_URL);
      if (probe.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error("production server did not come up");
}

test.beforeAll(async () => {
  execSync("pnpm build", { cwd: APP_DIR, stdio: "inherit" });
  server = spawn("node", [join(APP_DIR, "..", "build", "index.js")], {
    env: { ...process.env, PORT: String(PROD_PORT) },
    stdio: "inherit",
  });
  server.on("error", (cause) => {
    throw new Error(`production server failed to spawn: ${String(cause)}`);
  });
  server.on("exit", (code) => {
    // signal exits carry code === null — a clean teardown, not an early crash
    if (code !== null && code !== 0) {
      throw new Error(`production server exited early with code ${code}`);
    }
  });
  await waitForServer();
});

test.afterAll(async () => {
  if (!server) return;
  const exited = new Promise<unknown>((resolve) => server?.once("exit", resolve));
  server.kill("SIGTERM");
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 2_000))]);
  if (server.exitCode === null && !server.killed) server.kill("SIGKILL");
});

// serial: one probe against the single production server.
test.describe.configure({ mode: "serial" });

test("production build serves the app with a hardened CSP", async () => {
  const response = await fetch(PROD_URL);
  expect(response.ok).toBeTruthy();
  const headers = response.headers;

  const csp = parseCsp(headers.get("content-security-policy") ?? "");
  // EXACT enumerated source lists (mirrors src/lib/security/csp.ts production
  // shape — extras like blob:/https: passed sources would be drift):
  expect(csp["default-src"]).toEqual(["self"]);
  // kit's `mode: "auto"` injects a per-request nonce for the shell's inline
  // bootstrap script — the exact list is [self, one nonce source]
  expect(csp["script-src"]).toEqual(["self", expect.stringMatching(/^nonce-/)]);
  // The MapLibre worker is a same-origin bundled asset: bare 'self', no blob:.
  expect(csp["worker-src"]).toEqual(["self"]);
  expect(csp["style-src"]).toEqual(["self", "unsafe-inline"]);
  expect(csp["img-src"]).toEqual(
    expect.arrayContaining(["self", "data:", "blob:", "https://tile.openstreetmap.org"]),
  );
  expect(csp["connect-src"]).toEqual(
    expect.arrayContaining([
      "self",
      "https://tile.openstreetmap.org",
      process.env.VITE_API_URL ?? "http://localhost:3000",
    ]),
  );
  // standard hardening set — exact values
  expect(headers.get("x-content-type-options")).toBe("nosniff");
  expect(headers.get("x-frame-options")).toBe("SAMEORIGIN");
  expect(headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  expect(headers.get("permissions-policy")).toBe(
    "geolocation=(), camera=(), microphone=(), payment=()",
  );
});

test("the production error route carries the same headers", async () => {
  const response = await fetch(`${PROD_URL}/no-such-route`);
  expect(response.ok).toBeFalsy();
  expect(response.status).toBeLessThan(500);
  const headers = response.headers;
  expect(headers.get("x-content-type-options")).toBe("nosniff");
  expect(headers.get("x-frame-options")).toBe("SAMEORIGIN");
  expect(headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  const csp = parseCsp(headers.get("content-security-policy") ?? "");
  // kit's `mode: "auto"` injects a per-request nonce for the shell's inline
  // bootstrap script — the exact list is [self, one nonce source]
  expect(csp["script-src"]).toEqual(["self", expect.stringMatching(/^nonce-/)]);
});

/**
 * Adapter-node residual (documented in hooks.server.ts too): immutable
 * `/_app/…` assets are served by the adapter's static layer — the file map
 * is decided at boot and these responses do NOT run the SvelteKit hook
 * chain, so the hooks-applied standard headers are an HTML-delivery
 * contract, not an asset-header contract. The evidence check here asserts
 * the asset surface is reachable exactly as referenced by the shell.
 */
test("the production shell's referenced assets are served (static-layer residual documented)", async () => {
  const page = await fetch(PROD_URL);
  expect(page.ok).toBeTruthy();
  const html = await page.text();
  const assetPath = html.match(/(?:src|href)="(\.?\/_app\/[^"]+)"/)?.[1];
  expect(assetPath, "the production shell references an _app asset").toBeTruthy();
  const normalized = assetPath!.startsWith("./") ? assetPath!.slice(1) : assetPath!;
  const asset = await fetch(`http://localhost:${PROD_PORT}${normalized}`);
  expect(asset.ok).toBeTruthy();
  expect(asset.status).toBe(200);
  // response streams body + content-type; the hook-applied headers apply to
  // the HTML delivery (asserted above), not to the static layer (residual)
});

/**
 * Browser-level production probe (the gap that hid the map-worker defect:
 * header-level CSP assertions alone never exercised the map). Drives a real
 * browser against the production server: the map canvas mounts, pins render
 * from the bundled worker (a 200 on `_app/immutable/workers/*`), and the
 * page runs with zero console errors under the hardened CSP.
 */
test("the production build renders the map in a real browser with no console errors", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));

  const workerResponses: number[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/_app/immutable/workers/"))
      workerResponses.push(response.status());
  });

  await page.goto(PROD_URL);
  await page.getByText("Prototype with synthetic data").waitFor({ timeout: 30_000 });
  await page.getByTestId("map-view").waitFor();

  // The bundled map worker chunk is a real same-origin asset, fetched with
  // the tightened worker-src 'self' policy.
  expect(workerResponses.length, "the map worker chunk was requested").toBeGreaterThan(0);
  expect(
    workerResponses.every((status) => status === 200),
    "the map worker chunk loads (no 404/CSP rejection)",
  ).toBe(true);

  // The GL map actually painted its canvas and the pins render for units.
  await expect(page.locator(".map-canvas canvas")).toHaveCount(1);
  await expect(page.getByTestId("map-pin-list").locator("button").first()).toBeAttached();

  // Give tile/source loading a beat to surface late errors, then assert a
  // clean console: no worker failures, no CSP rejections, no stack traces.
  await page.waitForTimeout(3_000);
  expect(consoleErrors, "the page console is clean").toEqual([]);

  await context.close();
});
