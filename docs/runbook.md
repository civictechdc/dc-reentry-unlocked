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
  against one long-lived API: the per-route rate limit (100 requests per
  minute) saturates and the client surfaces the same unreachable alert.

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
