# Runbook — running DC Reentry Housing Discovery

The complete run story for the prototype: development without Docker, in
a dev container, the Compose boot, and dataset regeneration. Every
command here is verified to run as written. Prerequisites: Node ≥ 22.12,
pnpm ≥ 12 (`corepack enable pnpm`), git ≥ 2.54 — and for the Compose
section, a running Docker daemon (the build uses BuildKit). The dev
container path replaces those manual prerequisites with Docker/Podman
plus a dev-container-supporting editor.

For API environment variables, the published filter contract, and endpoint
semantics see [api.md](api.md); for the synthetic-data policy see
[data-synthetic.md](data-synthetic.md).

## 1. Development without Docker

```sh
pnpm install
pnpm dev
```

`pnpm dev` starts both dev servers: the web app at
[localhost:5173](http://localhost:5173/) and the API at
[localhost:3000](http://localhost:3000/) (`/health`, `/units`, `/filters`).
The API loads the frozen generated dataset (`data/units.json`) at boot.

Spot-check the boot:

```sh
curl -sS http://localhost:3000/health
curl -sS "http://localhost:3000/units" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log('units served:',JSON.parse(s).units.length))"
```

The health endpoint answers `{"status":"ok"}` and the units count prints the
available-unit total (932 with the current frozen dataset).

Web-only candidate features ship behind dev-only feature flags, disabled by
default. Enable one for a dev session at launch:

```sh
VITE_FEATURE_<NAME>=1 pnpm -C apps/web dev
```

or override per page load by appending `?flags=name1,name2` to the app URL
(registered names only; unknown names are ignored and an empty value enables
nothing). Overrides apply on reload — change flags and reload the page, never
restart the dev server. The registry of valid names and the full mechanism
live in `apps/web/src/lib/flags/`. Non-development builds (`vite build` —
the Docker image and the production e2e probe) have no flag surface: neither
launch variables nor URL parameters enable anything there — the build-time
environment is ignored even if the variable is set when building — and
guarded code is eliminated by construction, because both flag globals are
forced false in every build regardless of NODE_ENV (an empirical scan of
the built bundle joins with the first flagged feature). When a feature
graduates, its flag (registry entry and declaration) is removed together
with the guard. Flags are never a security boundary: they gate candidate
UX trials only, and anything that must be enforced stays behind the API's
real checks — the doctrine lives in
`apps/web/src/lib/flags/README.md`.

Stopping: interrupt `pnpm dev` in its terminal (Ctrl-C). On some platforms
killing the parent processes can leave the API's TypeScript server child
alive and still listening on port 3000; if a subsequent boot reports port
3000 in use, check the listeners explicitly:

```sh
lsof -nP -iTCP:3000 -iTCP:5173 -sTCP:LISTEN
```

and kill the listening PID(s) found there (`lsof` shows no listeners when
both servers are really stopped).

### Stale servers poison the local e2e suites

The Playwright configs run with `reuseExistingServer` enabled outside CI:
any process already listening on port 3000 is adopted as "the API" without
receiving the e2e environment. Two failure shapes come from that, both
investigated from a green tree (2026-11-10):

- **`e2e:prod` fails with pins never attaching** and the page alerting "We
  couldn't reach the housing service". An adopted orphan API runs with the
  default CORS allow list (dev origin only), so the production probe's page
  — served on port 4317 — has its cross-origin units fetch blocked by the
  browser. The app shell, map, and worker all look healthy, which makes the
  symptom point far from the cause.
- **Late e2e tests start failing after back-to-back full-suite runs**
  against one long-lived API: the per-client rate limit (100 requests per
  minute, one shared budget across all requests) saturates and the client
  surfaces the same unreachable alert.

Diagnosis one-liner — a correctly booted e2e API answers with an
`access-control-allow-origin` header for the prod origin; an orphan does
not:

```sh
curl -s -D - -o /dev/null -H "Origin: http://localhost:4317" \
  http://localhost:3000/units | grep -i access-control
```

Prevention is the stopping guidance at the top of this section: before
`pnpm -C apps/web e2e` or `e2e:prod`, stop stray servers on
3000/4317/5173 (`lsof -ti :3000 -i :4317 -i :5173 | xargs kill`) so
Playwright boots its own configured stack.

## 2. Development in a dev container

No local Node/pnpm toolchain at all is fine: the repo's `.devcontainer/`
config boots a container with the whole toolchain ready (Node 24,
pnpm 12.15.0, Playwright chromium, git hooks wired), supported by VS Code
Dev Containers, Zed, and GitHub Codespaces. Boot it from your editor
(_Reopen in Container_ in VS Code, the space-creation flow in Codespaces,
Zed's dev-container flow) or headless:

```sh
npx @devcontainers/cli up --workspace-folder .
```

Post-create finishes in about a minute, and the forwarded ports match the
dev boot above (3000 API, 5173 web, 4317 e2e prod probe). The full story
— per-editor notes, ports behavior, git hooks, trust model, verification
recipe — lives in [dev-container.md](dev-container.md).

## 3. Compose boot

The stack ships `compose.yaml` (service definitions) and per-workspace
Dockerfiles (`apps/api/Dockerfile`, `apps/web/Dockerfile`) running as the
unprivileged `node` user, on the loopback interface only — ports 3000/5173
match the development parity (`127.0.0.1:3000`, `127.0.0.1:5173`): the CORS
allow list and the baked API base `http://localhost:3000` then work
unchanged for local use (as a local prototype nothing is reachable on the
LAN; for other hosts, rebuild the web image with a different API base):

```sh
docker compose build --build-arg VITE_API_URL=https://api.example.com web
```

(align the API's `API_CORS_ORIGINS` with the served web origin; see the
environment table in [api.md](api.md)).

**Caveat:** healthy containers mean only that the boot passed, not that the
app's wiring is right — a wrong `VITE_API_URL` still yields two healthy
services whose browser flow cannot reach the API. The real check is the
smoke below plus the actual browser page, or the browser-level production
test `pnpm -C apps/web e2e:prod` against a locally built stack.

Boot:

```sh
docker compose up -d
docker compose ps
```

`docker compose ps` shows both services `Up (healthy)` — each service has
a healthcheck (API → `/health`, web → the served SPA shell).

Smoke-check the stack:

```sh
curl -sS http://localhost:3000/health
curl -sS "http://localhost:3000/units" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log('units served:',JSON.parse(s).units.length))"
curl -sS -o /dev/null -w "web shell: %{http_code}\n" http://localhost:5173/
```

Then open [localhost:5173](http://localhost:5173/) in your browser: the
prototype banner, the map, and the card list should show (the SPA renders
in the host browser against that baked API URL).

Clean teardown removes the containers and the network (the stack defines no
named volumes). The two built images and the Docker build cache remain
after `down` — that is deliberate (rebuilds stay fast); remove them to
reclaim the space when they are no longer wanted:

```sh
docker compose down
docker ps -a --filter "name=dc-reentry-unlocked"

# optional cleanup when the images/cache are no longer wanted:
docker compose down --rmi all
docker builder prune
```

After the teardown the container listing shows no dc-reentry containers —
only its column header row with zero rows beneath it.

## 4. Dataset regeneration

The frozen dataset (`data/units.json`, committed) must stay byte-identical
across regenerations — the generator is deterministic with a fixed seed, so
regenerating and diffing must end clean:

```sh
pnpm datagen
git diff --exit-code -- data/
```

Both commands exit 0 when the frozen dataset is intact after regeneration.
If the diff exits nonzero, regeneration changed the output — investigate
the generator change before committing anything under `data/` (dataset
files are never hand-edited).

## 5. Model-doc regeneration

The generated model reference (`docs/data-model.md`, committed) is rendered
from the TypeBox schemas in `packages/shared` — never hand-edit it. Like the
dataset, regeneration must stay byte-identical; a schema change without a
regenerated doc fails the gate:

```sh
pnpm docgen:model
git diff --exit-code -- docs/data-model.md
```

Both commands exit 0 when the committed reference matches the schemas. If
the diff exits nonzero, a schema change reached the doc — regenerate and
commit the updated reference together with the schema change. Schema prose
(field meanings, enum meanings, worked examples) lives in the schemas'
`description` / `examples` annotations, so the doc carries it on every
regeneration.

## 6. WebKit reference rig (Linux container)

The GitHub runner's WebKit leg runs Linux WebKit under software GL with a
virtual display — a browser build macOS cannot provide (macOS arm64
installs a different WebKit revision than the runner's `playwright
install --with-deps webkit`). This section documents the local reference
rig: the repo's CI Playwright config `desktop-webkit` project running
inside the official Playwright Linux container against the Compose boot,
approximating the runner environment for local evidence.

Prerequisites: the Compose boot healthy (section 3) and its ports free —
stop stray servers first (`lsof -ti :3000 -i :4317 -i :5173 | xargs
kill`). The rig must talk to the Compose boot, not dev servers. No other
setup: the browser deps ship inside the image, and the repo's
`node_modules` is left untouched (the container installs its own into
named volumes — macOS binaries cannot run in the Linux container, and the
container must never rewrite the host install).

From the repo root:

```sh
docker run --rm --name webkit-rig \
  --platform linux/arm64 \
  -e LIBGL_ALWAYS_SOFTWARE=1 \
  -e CI=1 \
  -v "$PWD":/work -w /work \
  -v rig-webkit-node-modules:/work/node_modules \
  -v rig-webkit-node-modules-web:/work/apps/web/node_modules \
  -v rig-webkit-pnpm-store:/pnpm-store \
  mcr.microsoft.com/playwright:v1.64.1-noble \
  bash -c '
    set -e
    # The suite and the served SPA hardcode localhost/127.0.0.1 origins;
    # Compose publishes on the host loopback, so a tiny in-container
    # forwarder bridges container-loopback -> host.docker.internal.
    cat > /tmp/loopback-forward.mjs <<"EOF"
import net from "node:net";
for (const port of [3000, 5173]) {
  net.createServer((client) => {
    const upstream = net.connect(port, "host.docker.internal");
    client.on("error", () => upstream.destroy());
    upstream.on("error", () => client.destroy());
    client.pipe(upstream);
    upstream.pipe(client);
  }).listen(port, "127.0.0.1");
}
EOF
    node /tmp/loopback-forward.mjs &
    npm install -g pnpm@12.15.0
    pnpm install --frozen-lockfile --filter @dc-reentry/web... --store-dir /pnpm-store
    xvfb-run -a pnpm -C apps/web e2e:ci --project=desktop-webkit
  '
```

The pieces, in order:

- `mcr.microsoft.com/playwright:v1.64.1-noble` — the runner's distro
  (Ubuntu noble) with the Playwright-matched browser builds preinstalled
  (`/ms-playwright`, WebKit revision matching the repo's Playwright
  1.64.1). Pin the image tag to the repo's `@playwright/test` version.
- `LIBGL_ALWAYS_SOFTWARE=1`, `CI=1`, `xvfb-run` — the workflow's
  environment, mirrored deliberately: software GL, the CI retry posture
  (`retries: 1` in the CI config when `CI` is set), and the virtual
  display the workflows wrap the suite in.
- The named volumes — container-side `node_modules` at the root and in
  `apps/web` (mounted over the host's, which stays untouched), plus a
  persistent pnpm store so re-runs skip the download. First run installs
  (~2 min); later runs start in seconds.
- The forwarder — a 20-line Node listener on container-loopback
  3000/5173 relaying to `host.docker.internal`. Without it the suite's
  hardcoded `localhost` origins cannot reach the Compose boot from inside
  the container.

Architecture: the runner is amd64; on Apple Silicon prefer
`--platform linux/amd64` for CPU fidelity — but under OrbStack it is
recorded unstable (VM crashes mid-run, and emulation overhead breaches
the timing budgets: an axe-scan cold-start timeout and a 5132ms
filter-apply against the 3000ms floor, both of which pass on the real
runner). The verified baseline uses `--platform linux/arm64`. Expected
green baseline: 34 passed, 3 skipped (the two webkit `test.skip` guards
plus the Chromium-only touch-drag injection test), about 2 minutes after
the first install.

One test is CPU-contention sensitive in the rig: the drag-pan proof can
see its drag register as a click when software-GL rendering starves the
input pipeline (the camera then moves zero distance). The runner posture
`CI=1` carries the CI leg's retry, which recovers it — flaky-but-green is
a normal rig outcome. If a run reports it failed, re-run the block before
investigating: the same command is green on re-run, and the test passes
on the runner's amd64 hardware.

What the rig is evidence of — and what it is not: it approximates the
runner (same distro family, same Playwright browser-build lineage,
software GL, xvfb) closely enough for local WebKit evidence, and it is
where rig-dependent calibrations (software-GL timing budgets) are
measured. It is not the runner: not byte-identical browser installation,
and on Apple Silicon not the runner's CPU architecture. Conclusions from
the rig are evidence, not proof — the PR-check CI leg remains the
authoritative gate.

Trust and caveats: the rig runs the checked-out branch's own test code as
container root with the repo mounted read-write — run it only on your own
branches, never on untrusted PRs. Playwright artifacts (`test-results/`,
`playwright-report/`) land inside the mounted worktree, owned by container
root — delete them after runs. `host.docker.internal` is Docker Desktop
(macOS/Windows) behavior; on a Linux host add
`--add-host=host.docker.internal:host-gateway` to the `docker run`. When
the recipe is reused for triage on other machines, pin the image by digest
(`mcr.microsoft.com/playwright:v1.64.1-noble@sha256:…`, recorded beside
the tag) rather than trusting the mutable tag.

Tear the Compose boot down when done (section 3's `docker compose down`);
the rig container removes itself (`--rm`) and the named volumes persist
for fast re-runs — reclaim them with
`docker volume rm rig-webkit-node-modules rig-webkit-node-modules-web rig-webkit-pnpm-store`
when no longer wanted.
