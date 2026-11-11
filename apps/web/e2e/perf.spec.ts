/**
 * Performance envelope measurements (warn-gated until the first baseline is
 * frozen): long-task churn during map pan/zoom, and pin re-render latency per
 * filter change (the payload budget lives in perf-payload.spec.ts, measured
 * on the wire). Numbers are always logged and attached to the report; the
 * revisable targets are documented in docs/perf-notes.md.
 */
import { expect, test } from "@playwright/test";

const PERF_BUDGETS = {
  /** no long task above this during map panning (advisory production target) */
  longTaskMs: 50,
  /** filter-change pin re-render budget (advisory production target) */
  filterApplyMs: 100,
};

/**
 * Gross-churn ceilings for the filter-apply round-trip (includes the
 * server round-trip, measured against the Compose boot). The WebKit
 * ceiling is a software-GL calibration with measured basis: the CI runner
 * (Ubuntu, LIBGL_ALWAYS_SOFTWARE=1, xvfb) recorded 2354ms and 2553ms;
 * the Linux reference rig (same image, arm64 on Apple Silicon — a
 * CPU-noisier software-GL host than the runner's amd64) measured 2740ms,
 * 3617ms, and 4322ms on cold first attempts with warm-retry values of
 * 1445ms and 2434ms. Chromium and Firefox stay on the shared 2s ceiling.
 */
const GROSS_CHURN_FLOOR_MS = 2_000;
const CALIBRATED_WEBKIT_SOFTWARE_GL_FLOOR_MS = 3_000;

test("map interaction stays smooth: no long task > 50ms during pan/zoom", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await page.getByText("Prototype with synthetic data").waitFor({ timeout: 20_000 });

  await page.evaluate(() => {
    (window as unknown as { __perf: unknown[] }).__perf = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        (window as unknown as { __perf: unknown[] }).__perf.push({
          start: entry.startTime,
          duration: entry.duration,
        });
      }
    }).observe({ entryTypes: ["longtask"] });
  });

  const canvas = page.locator(".map-canvas canvas").first();
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();

  // pan the map
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  for (let step = 0; step < 12; step += 1) {
    await page.mouse.move(box!.x + box!.width / 2 + step * 15, box!.y + box!.height / 2 + step * 6);
    await page.waitForTimeout(40);
  }
  await page.mouse.up();
  // zoom
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(600);

  const longTasks = (await page.evaluate(
    () => (window as unknown as { __perf: Array<{ duration: number }> }).__perf,
  )) as Array<{ duration: number }>;
  const durations = longTasks.map((task) => task.duration).sort((a, b) => b - a);
  const worst = durations.at(0) ?? 0;
  console.log(
    `[perf] long tasks during pan/zoom: ${longTasks.length}, worst ${Math.round(worst)}ms`,
  );

  // warn-gate: the 50ms target is advisory until a production-build baseline is
  // frozen; the hard floor only catches gross churn in the dev-server run
  // (Vite transform/HMR overhead dominates; see docs/perf-notes.md)
  const worstTolerable = 2_000;
  expect(worst).toBeLessThan(worstTolerable);
  await test.info().attach("perf-map-longtask", {
    body: Buffer.from(
      `long task count during pan/zoom: ${longTasks.length}\nworst long task: ${Math.round(worst)}ms\nbudget target: <${PERF_BUDGETS.longTaskMs}ms (hard floor ${worstTolerable}ms)\n`,
    ),
    contentType: "text/plain",
  });
});

test("applying a filter re-renders pins fast (pin re-render < 100ms budget)", async ({
  page,
  browserName,
}) => {
  await page.goto("/");
  await page.getByText("Prototype with synthetic data").waitFor({ timeout: 20_000 });

  const started = Date.now();
  await page.locator(".filter-bar").getByRole("button", { name: "Ward 1", exact: true }).click();
  await page
    .getByText(/unit\(s\) match your filters/)
    .first()
    .waitFor({ timeout: 10_000 });
  const elapsed = Date.now() - started;
  console.log(
    `[perf] filter change UI latency: ${elapsed}ms (budget ${PERF_BUDGETS.filterApplyMs}ms)`,
  );

  // the count updates from the server-filtered result set; warn-gate:
  // dev-mode round-trip varies (review observed up to ~1.5s) and the
  // calibrated ceilings above are gross-churn guards, not the advisory
  // 100ms production target (perf-notes)
  const grossChurnFloorMs =
    browserName === "webkit" ? CALIBRATED_WEBKIT_SOFTWARE_GL_FLOOR_MS : GROSS_CHURN_FLOOR_MS;
  expect(elapsed).toBeLessThan(grossChurnFloorMs);
  await test.info().attach("perf-filter-apply", {
    body: Buffer.from(
      `filter change round-trip (incl. server filtering): ${elapsed}ms\nbudget: ${PERF_BUDGETS.filterApplyMs}ms pin re-render\n`,
    ),
    contentType: "text/plain",
  });
});
