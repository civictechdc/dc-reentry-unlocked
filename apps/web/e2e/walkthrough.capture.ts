import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Frame,
  type Page,
  type Request,
  type Response,
} from "@playwright/test";

/**
 * Walkthrough capture harness — a headed, user-directed browser session
 * against the self-booted dev stack, emitting a timestamped structured
 * event log of what the session surfaced. Dev tooling only: it is NOT
 * matched by any Playwright suite (filename is not `*.spec.ts` and it is
 * outside the BDD `testDir`), it is never shipped in a production build,
 * and it instruments nothing in the app — everything is observed from the
 * session (clicks via a capture-phase listener injected into the page,
 * everything else via Playwright's page/network events).
 *
 * Usage (from `apps/web`):
 *
 *   node e2e/walkthrough.capture.ts            # live session: headed
 *                                              # browser for a user to
 *                                              # direct; Ctrl+C ends it
 *   node e2e/walkthrough.capture.ts --dry-run  # self-driving synthetic
 *                                              # session (headless by
 *                                              # default) that asserts a
 *                                              # well-formed log with real
 *                                              # events, then exits
 *
 * Requires Node >= 22.18 (TypeScript type-stripping is default-on from
 * there; on an older 22.x: `node --experimental-strip-types
 * e2e/walkthrough.capture.ts`).
 *
 * Flags: `--headless` / `--headed` override the mode default (live is
 * headed, dry-run is headless); `--out <path>` overrides the log file.
 *
 * Environment (all optional):
 *
 *   WALKTHROUGH_WEB_PORT   web dev-server port  (default 5173)
 *   WALKTHROUGH_API_PORT   API dev-server port  (default 3000)
 *   WALKTHROUGH_SKIP_BOOT  =1 attaches to already-running servers instead
 *                          of booting the stack (the ports above then only
 *                          locate them — set them to whatever is running)
 *   WALKTHROUGH_HEADLESS   =1 same as the `--headless` flag
 *
 * Ports move together: the harness derives every coupled value from the
 * two port env vars — the web dev server's `--port` (strict, fail-fast),
 * the client's API base + CSP blessing via `VITE_API_URL` for the web
 * process, and the API's `PORT`, `HOST`, and a fail-closed
 * `API_CORS_ORIGINS` allow list blessing exactly this web origin. Any
 * mismatch would fail closed (CORS rejection or unreachable API), so the
 * harness never lets a partial override through.
 *
 * Captured events (all timestamped, JSON): navigations, clicks on
 * interactive elements (best-effort label: data-testid, then aria-label /
 * name, then visible text), unit-query applications with result counts
 * (observed on `/units` network responses), zero-result encounters,
 * console errors/warnings, page errors, failed requests (network failure
 * or HTTP >= 400), and slow requests (>500ms, wall-clock best effort).
 *
 * The log lands in the gitignored `.scratch/walkthrough/` directory at the
 * repo root (session logs are machine-local, never committed) and is
 * rewritten atomically on every event (write to a `.tmp` file, then
 * rename), so even a hard kill mid-session leaves a complete, parseable
 * log up to the last recorded event.
 */

const repoRoot = join(import.meta.dirname, "..", "..", "..");
const SLOW_REQUEST_MS = 500;

/** Session end signal — `reason` keeps the end label honest (Ctrl+C vs browser close vs SIGTERM). */
const interrupted = { value: false, reason: "SIGTERM" };
process.on("SIGINT", () => {
  interrupted.value = true;
  interrupted.reason = "user interrupt (Ctrl+C)";
});
process.on("SIGTERM", () => {
  interrupted.value = true;
  interrupted.reason = "SIGTERM";
});
/** First async spawn failure (e.g. ENOENT) — readiness polling fails fast on it. */
const bootError = { value: undefined as Error | undefined };
/** Live refs so an out-of-flow crash (uncaught exception/rejection) can still tear the stack down. */
const active = { browser: undefined as Browser | undefined, stack: [] as ChildProcess[] };

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const headless =
  args.includes("--headless") ||
  process.env.WALKTHROUGH_HEADLESS === "1" ||
  (dryRun && !args.includes("--headed"));

function portFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    console.error(`${name} must be an integer port (1-65535), got: ${raw}`);
    process.exit(2);
  }
  return value;
}

const webPort = portFromEnv("WALKTHROUGH_WEB_PORT", 5173);
const apiPort = portFromEnv("WALKTHROUGH_API_PORT", 3000);
const webOrigin = `http://localhost:${webPort}`;
const apiOrigin = `http://localhost:${apiPort}`;
const apiHealthUrl = `http://127.0.0.1:${apiPort}/health`;
const attachToRunningStack = process.env.WALKTHROUGH_SKIP_BOOT === "1";

const outArgIndex = args.indexOf("--out");
let outOverride: string | undefined;
if (outArgIndex >= 0) {
  const next = args[outArgIndex + 1];
  if (next === undefined || next.startsWith("--")) {
    console.error(`--out requires a file path (got: ${next ?? "nothing"})`);
    process.exit(2);
  }
  outOverride = next;
}
const outPath =
  outOverride ??
  join(
    repoRoot,
    ".scratch",
    "walkthrough",
    `walkthrough-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );

type WalkthroughEventKind =
  | "session-start"
  | "navigation"
  | "click"
  | "filter-applied"
  | "zero-results"
  | "console"
  | "page-error"
  | "request-failed"
  | "slow-request"
  | "session-end";

type WalkthroughEvent = {
  at: number;
  iso: string;
  type: WalkthroughEventKind;
  label?: string | undefined;
  detail?: Record<string, unknown> | undefined;
};

class EventLog {
  private readonly events: WalkthroughEvent[] = [];
  private endedAt: string | undefined;
  private writeFailed = false;

  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    mkdirSync(join(filePath, ".."), { recursive: true });
  }

  add(event: Omit<WalkthroughEvent, "at" | "iso"> & { at?: number | undefined }): void {
    const at = event.at ?? Date.now();
    this.events.push({ ...event, at, iso: new Date(at).toISOString() });
    this.flush();
  }

  /** Resolves with the first logged event matching the predicate. */
  waitFor(
    predicate: (event: WalkthroughEvent) => boolean,
    timeoutMs: number,
  ): Promise<WalkthroughEvent> {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
      const poll = (): void => {
        if (interrupted.value) {
          reject(new Error(`wait interrupted (${interrupted.reason})`));
          return;
        }
        const found = this.events.find(predicate);
        if (found) {
          resolve(found);
          return;
        }
        if (Date.now() > deadline) {
          reject(new Error("no matching event within the timeout"));
          return;
        }
        setTimeout(poll, 100);
      };
      poll();
    });
  }

  all(): readonly WalkthroughEvent[] {
    return this.events;
  }

  countByType(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const event of this.events) {
      counts[event.type] = (counts[event.type] ?? 0) + 1;
    }
    return counts;
  }

  finish(reason: string): void {
    this.endedAt = new Date().toISOString();
    this.add({
      type: "session-end",
      label: reason,
      // +1: the session-end event itself is part of the total it reports
      detail: { totalEvents: this.events.length + 1 },
    });
  }

  private flush(): void {
    const session = {
      logFormat: 1,
      startedAt: this.events[0]?.iso,
      endedAt: this.endedAt,
      mode: dryRun ? ("dry-run" as const) : ("live" as const),
      headless,
      stack: {
        bootedByHarness: !attachToRunningStack,
        webOrigin,
        apiOrigin,
        corsAllow: webOrigin,
      },
    };
    const payload = `${JSON.stringify({ session, events: this.events }, null, 2)}\n`;
    try {
      // atomic rewrite: a hard kill mid-write leaves the previous complete
      // file, never a truncated one
      writeFileSync(`${this.filePath}.tmp`, payload);
      renameSync(`${this.filePath}.tmp`, this.filePath);
      this.writeFailed = false;
    } catch (error) {
      // a log-write failure must never crash the session — events stay in
      // memory and the write retries on the next event
      if (!this.writeFailed) {
        this.writeFailed = true;
        console.error(
          `Walkthrough log write failed (${String(error)}) — continuing; events stay in memory and the write retries on the next event.`,
        );
      }
    }
  }
}

/**
 * Capture-phase click listener injected into every page load: records
 * interactive-element clicks with a best-effort label. It must never
 * throw into the page — every failure is swallowed by design.
 */
const clickCaptureScript = (): void => {
  const w = window as unknown as {
    __walkthroughClickInstalled?: boolean;
    __walkthroughClick?: (label: string) => void;
  };
  if (w.__walkthroughClickInstalled) return;
  w.__walkthroughClickInstalled = true;
  const INTERACTIVE =
    'button, a, input, select, textarea, [role="button"], [role="tab"], [role="switch"], label';
  const labelFor = (element: Element): string => {
    const testid = element.closest("[data-testid]")?.getAttribute("data-testid");
    if (testid) return testid;
    const named = element.getAttribute("aria-label") ?? element.getAttribute("name");
    if (named) return named;
    const text = (element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
    return text.length > 0 ? text : element.tagName.toLowerCase();
  };
  document.addEventListener(
    "click",
    (event) => {
      try {
        const target = event.target instanceof Element ? event.target : null;
        const interactive = target?.closest(INTERACTIVE);
        if (!interactive) return; // plain-text clicks are session noise
        w.__walkthroughClick?.(labelFor(interactive));
      } catch {
        // capture must never break the page
      }
    },
    { capture: true, passive: true },
  );
};

async function instrument(
  context: BrowserContext,
  page: Page,
  log: EventLog,
  observedApiOrigin: string,
): Promise<void> {
  await context.exposeBinding("__walkthroughClick", (source: { frame: Frame }, label: unknown) => {
    log.add({
      type: "click",
      label: typeof label === "string" ? label : "(unknown target)",
      detail: { frame: source.frame.url() },
    });
  });
  await page.addInitScript(clickCaptureScript);

  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      log.add({ type: "navigation", label: frame.url() });
    }
  });

  page.on("console", (message) => {
    const severity = message.type();
    if (severity === "error" || severity === "warning") {
      log.add({
        type: "console",
        label: severity,
        detail: { text: message.text(), location: message.location() },
      });
    }
  });

  page.on("pageerror", (error) => {
    log.add({
      type: "page-error",
      label: error.name,
      detail: { message: error.message, stack: error.stack },
    });
  });

  const pendingRequests = new Map<Request, number>();
  page.on("request", (request) => {
    pendingRequests.set(request, Date.now());
  });

  const onResponse = async (response: Response): Promise<void> => {
    const request = response.request();
    const startedAt = pendingRequests.get(request);
    pendingRequests.delete(request);
    const durationMs = startedAt === undefined ? undefined : Date.now() - startedAt;
    if (durationMs !== undefined && durationMs > SLOW_REQUEST_MS) {
      log.add({
        type: "slow-request",
        label: request.url(),
        detail: { durationMs, method: request.method() },
      });
    }
    if (response.status() >= 400) {
      log.add({
        type: "request-failed",
        label: response.url(),
        detail: { status: response.status(), method: request.method(), durationMs },
      });
    }
    let unitsUrl: URL;
    try {
      unitsUrl = new URL(response.url());
    } catch {
      return;
    }
    if (unitsUrl.origin !== observedApiOrigin || unitsUrl.pathname !== "/units") return;
    let resultCount: number | null = null;
    try {
      const payload = (await response.json()) as { units?: unknown };
      if (Array.isArray(payload.units)) resultCount = payload.units.length;
    } catch {
      resultCount = null; // unreadable body — still record the application
    }
    log.add({
      type: "filter-applied",
      label: unitsUrl.search === "" ? "(all units)" : unitsUrl.search,
      detail: { resultCount, durationMs, status: response.status() },
    });
    if (resultCount === 0) {
      log.add({ type: "zero-results", label: unitsUrl.search, detail: { durationMs } });
    }
  };
  page.on("response", (response) => {
    void onResponse(response).catch(() => {
      // observation must never break the session
    });
  });

  page.on("requestfailed", (request) => {
    const startedAt = pendingRequests.get(request);
    pendingRequests.delete(request);
    log.add({
      type: "request-failed",
      label: request.url(),
      detail: {
        failure: request.failure()?.errorText,
        method: request.method(),
        durationMs: startedAt === undefined ? undefined : Date.now() - startedAt,
      },
    });
  });
}

async function probe(url: string): Promise<number | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return response.status;
  } catch {
    return null;
  }
}

async function waitUntilReady(label: string, url: string, timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (bootError.value) {
      throw new Error(`${label} failed to boot: ${bootError.value.message}`);
    }
    if (interrupted.value) {
      throw new Error(`${label} wait interrupted (${interrupted.reason})`);
    }
    if ((await probe(url)) !== null) return;
    await sleep(500);
  }
  throw new Error(`${label} did not become ready within ${timeoutMs}ms: ${url}`);
}

/**
 * Pre-boot guard implementing the repo's "stop stray servers first" e2e
 * rule: when self-booting, refuse to start on occupied ports instead of
 * silently probing the wrong app.
 */
async function requireFreePorts(): Promise<void> {
  if (attachToRunningStack) return;
  const apiState = await probe(apiHealthUrl);
  if (apiState !== null) {
    throw new Error(
      `Something already answers on ${apiOrigin} (health status ${apiState}) — stop stray servers first, or set WALKTHROUGH_SKIP_BOOT=1 to attach.`,
    );
  }
  const webState = await probe(`${webOrigin}/`);
  if (webState !== null) {
    throw new Error(
      `Something already answers on ${webOrigin} (status ${webState}) — stop stray servers first, or set WALKTHROUGH_SKIP_BOOT=1 to attach.`,
    );
  }
}

function bootStack(): ChildProcess[] {
  const api = spawn("pnpm", ["-C", "apps/api", "dev"], {
    cwd: repoRoot,
    // detached: own process group, so the teardown's group signal reaches
    // the whole tree (pnpm wrapper -> tsx watch -> server), not just pnpm
    detached: true,
    env: {
      ...process.env,
      PORT: String(apiPort),
      HOST: "127.0.0.1",
      API_CORS_ORIGINS: webOrigin,
    },
    stdio: ["ignore", "inherit", "inherit"],
  });
  const web = spawn(
    "pnpm",
    ["-C", "apps/web", "exec", "vite", "dev", "--port", String(webPort), "--strictPort"],
    {
      cwd: repoRoot,
      detached: true,
      env: { ...process.env, VITE_API_URL: apiOrigin },
      stdio: ["ignore", "inherit", "inherit"],
    },
  );
  // without an 'error' listener an async spawn failure (ENOENT, ...) is an
  // uncaughtException that skips the finally teardown, straying the
  // detached servers — record it so readiness polling fails fast into the
  // normal failure/teardown path instead
  const onSpawnError = (child: ChildProcess, error: Error): void => {
    bootError.value ??= new Error(`server process (${child.spawnfile}) failed: ${error.message}`);
  };
  api.once("error", (error) => onSpawnError(api, error));
  web.once("error", (error) => onSpawnError(web, error));
  return [api, web];
}

function signalTree(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid === undefined || child.exitCode !== null) return;
  try {
    // detached spawn put each server in its own process group — signal the
    // whole group so the pnpm wrapper does not orphan the real server
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

async function stopStack(processes: ChildProcess[]): Promise<void> {
  for (const child of processes) signalTree(child, "SIGTERM");
  const exited = Promise.all(
    processes.map(
      (child) =>
        new Promise<void>((resolve) => {
          child.once("exit", () => resolve());
        }),
    ),
  );
  const grace = new Promise<void>((resolve) => setTimeout(resolve, 3000));
  await Promise.race([exited, grace]);
  for (const child of processes) signalTree(child, "SIGKILL");
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function runLiveSession(page: Page, appUrl: string): Promise<void> {
  await page.goto(appUrl);
  console.log(`
Walkthrough session live — browser is yours to direct (log: ${outPath}).
Press Ctrl+C (or close the browser) to end the session and tear the stack down.`);
  while (!interrupted.value) await sleep(250);
}

/**
 * Self-driving verification pass: a synthetic session that must produce a
 * well-formed log with real events — an initial units fetch with a numeric
 * result count, a filter application, a click interaction, and a
 * zero-result encounter (the frozen dataset's known empty combination) —
 * with no page errors. Exits non-zero if any check fails.
 */
async function runDryRun(page: Page, log: EventLog, appUrl: string): Promise<void> {
  const visible = (selector: string): Promise<void> =>
    page.locator(selector).first().waitFor({ state: "visible", timeout: 20_000 });

  await page.goto(appUrl);
  await page.getByText("Prototype with synthetic data").waitFor({ timeout: 20_000 });
  await visible(".unit-list article");
  const initial = await log.waitFor(
    (event) => event.type === "filter-applied" && typeof event.detail?.resultCount === "number",
    20_000,
  );

  await page.locator(".filter-bar").getByRole("button", { name: "Ward 5" }).click();
  await log.waitFor(
    (event) => event.type === "filter-applied" && String(event.label).includes("ward=5"),
    20_000,
  );

  await page.locator(".unit-list article").first().getByRole("button").click();
  await log.waitFor((event) => event.type === "click", 5_000);

  await page.goto(appUrl);
  await page.getByText("Prototype with synthetic data").waitFor({ timeout: 20_000 });
  await page.selectOption("#filter-housing-type", { label: "Emergency shelter" });
  await page.selectOption("#filter-population", { label: "Families" });
  await page
    .locator(".filter-bar")
    .locator(".control-boolean")
    .filter({ hasText: "Referral required" })
    .getByRole("button", { name: "Yes" })
    .click();
  await page.locator(".filter-bar").getByRole("button", { name: "Ward 6" }).click();
  await log.waitFor((event) => event.type === "zero-results", 30_000);

  const events = log.all();
  const failures: string[] = [];
  const initialCount = initial.detail?.resultCount;
  if (typeof initialCount !== "number" || initialCount <= 0) {
    failures.push(
      `initial units fetch has no positive result count (got: ${String(initialCount)})`,
    );
  }
  if (
    !events.some(
      (event) => event.type === "filter-applied" && String(event.label).includes("ward=5"),
    )
  ) {
    failures.push("no filter-applied event for the ward=5 application");
  }
  if (!events.some((event) => event.type === "click")) {
    failures.push("no click event captured");
  }
  if (!events.some((event) => event.type === "zero-results")) {
    failures.push("no zero-results event captured");
  }
  const pageErrors = events.filter((event) => event.type === "page-error");
  if (pageErrors.length > 0) {
    failures.push(`${pageErrors.length} page error(s): ${JSON.stringify(pageErrors[0]?.detail)}`);
  }
  const malformed = events.filter((event) => !Number.isFinite(event.at) || !event.type);
  if (malformed.length > 0) {
    failures.push(`${malformed.length} malformed event(s)`);
  }
  if (failures.length > 0) {
    throw new Error(`dry-run checks failed:\n- ${failures.join("\n- ")}`);
  }
  log.finish("dry-run completed");
}

async function main(): Promise<void> {
  const log = new EventLog(outPath);
  log.add({
    type: "session-start",
    label: dryRun ? "dry-run" : "live",
    detail: { webOrigin, apiOrigin, headless, attachToRunningStack },
  });
  await requireFreePorts();
  const processes = attachToRunningStack ? [] : bootStack();
  active.stack = processes;
  let browser: Browser | undefined;
  try {
    if (!attachToRunningStack) {
      await waitUntilReady("housing API", apiHealthUrl);
      await waitUntilReady("web app", `${webOrigin}/`);
    }
    // software-GL args under headless so the MapLibre canvas renders
    // without a GPU (same posture as the CI browser matrix)
    browser = await chromium.launch({
      headless,
      args: headless ? ["--use-gl=angle", "--use-angle=swiftshader"] : [],
    });
    active.browser = browser;
    browser.on("disconnected", () => {
      // only a spontaneous close names itself — the teardown's own
      // browser.close() must not overwrite a user-interrupt reason
      if (!interrupted.value) {
        interrupted.value = true;
        interrupted.reason = "browser closed";
      }
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    await instrument(context, page, log, apiOrigin);
    if (dryRun) await runDryRun(page, log, webOrigin);
    else await runLiveSession(page, webOrigin);
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stopStack(processes);
  }
  if (!dryRun) log.finish(`session ended (${interrupted.reason})`);
  console.log(`
Capture finished. Events: ${JSON.stringify(log.countByType(), null, 2)}
Log: ${outPath}`);
  const consoleErrors = log
    .all()
    .filter((event) => event.type === "console" && event.label === "error");
  if (consoleErrors.length > 0) {
    console.log(
      `Console errors seen in the session (captured for review, not harness faults): ${JSON.stringify(
        consoleErrors.map((event) => event.detail),
        null,
        2,
      )}`,
    );
  }
}

/**
 * Out-of-flow crash path (a throw inside an EventEmitter listener that
 * never reaches main's promise chain): the finally teardown above cannot
 * run there, so tear the detached stack down here before exiting.
 */
async function emergencyTeardown(cause: unknown): Promise<void> {
  console.error("Walkthrough capture failed:", cause);
  if (active.browser) await active.browser.close().catch(() => {});
  await stopStack(active.stack);
  process.exit(1);
}
process.on("uncaughtException", (error: unknown) => {
  void emergencyTeardown(error);
});
process.on("unhandledRejection", (reason: unknown) => {
  void emergencyTeardown(reason);
});

main().catch((error: unknown) => {
  console.error("Walkthrough capture failed:", error);
  process.exitCode = 1;
});
