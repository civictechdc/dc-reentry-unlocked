import http from "node:http";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { expect, test } from "@playwright/test";

/**
 * Performance envelope measurement for the units payload — measured ON THE
 * WIRE with compression active (user decision 2026-10-29) plus the
 * uncompressed body recorded as the baseline. Raw bytes via node:http
 * (Playwright's fixture auto-decodes). Numbers are logged and attached.
 *
 * Budget semantics: warnings above targets are logged, not failed (see
 * docs/perf-notes.md); the hard bounds catch only gross churn.
 */
const API_ORIGIN = { host: "127.0.0.1", port: 3000, path: "/units" };
const PERF_WIRE_BUDGET_PER_1000 = 500_000;

interface WireMeasurement {
  encoding: string;
  bytesOnWire: number;
  cards: number;
}

/**
 * Raw socket measurement: `accept` governs what the server sends back.
 * `bytesOnWire` counts the encoded BODY chunks only — response headers
 * (content-length framing) are excluded.
 */
function measureWire(accept: string): Promise<WireMeasurement> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      { ...API_ORIGIN, headers: { "accept-encoding": accept } },
      (response) => {
        const encoding = response.headers["content-encoding"] ?? "none";
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          const encoded = Buffer.concat(chunks);
          try {
            const decoded =
              encoding === "br"
                ? brotliDecompressSync(encoded)
                : encoding === "gzip"
                  ? gunzipSync(encoded)
                  : encoded;
            resolve({
              encoding,
              bytesOnWire: encoded.length,
              cards: (JSON.parse(decoded.toString()) as { units: unknown[] }).units.length,
            });
          } catch (cause) {
            reject(cause);
          }
        });
        response.on("error", reject);
      },
    );
    request.end();
  });
}

test("units payload stays within the per-1000-units budget measured on the wire (compression active)", async ({
  request,
}) => {
  // uncompressed baseline (recorded honestly for the budget conversation)
  const uncompressed = await request.get("http://127.0.0.1:3000/units", {
    headers: { "accept-encoding": "identity" },
  });
  expect(uncompressed.ok()).toBeTruthy();
  const uncompressedBytes = (await uncompressed.body()).byteLength;

  // compressed wire payload — what consumers actually pay for
  const wire = await measureWire("gzip, br");
  expect(wire.encoding).toBe("br");
  expect(wire.cards).toBeGreaterThan(1);

  const bytesPer1000 = Math.round((wire.bytesOnWire / wire.cards) * 1000);
  console.log(
    `[perf] units payload: wire ${wire.bytesOnWire} bytes (br) for ${wire.cards} cards → ${bytesPer1000} bytes per 1000 units on the wire (budget ${PERF_WIRE_BUDGET_PER_1000}); uncompressed body ${uncompressedBytes} bytes`,
  );
  await test.info().attach("perf-payload-measurement", {
    body: Buffer.from(
      `wire payload (br): ${wire.bytesOnWire} bytes\ncards: ${wire.cards}\nbytes per 1000 units on the wire: ${bytesPer1000}\nbudget: ${PERF_WIRE_BUDGET_PER_1000}\nuncompressed body: ${uncompressedBytes} bytes\n`,
    ),
    contentType: "text/plain",
  });

  // warn-gate: gross bloat trips the bound; the ~500KB/1,000 wire target warns
  if (bytesPer1000 > PERF_WIRE_BUDGET_PER_1000) {
    console.warn(
      `[perf][warn] wire payload per 1000 units ${bytesPer1000} exceeds ${PERF_WIRE_BUDGET_PER_1000}; record and revisit the budget`,
    );
  }
  expect(wire.bytesOnWire).toBeLessThan(1_000_000);
});
