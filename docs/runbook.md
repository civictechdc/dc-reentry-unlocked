# Runbook — running DC Reentry Housing Discovery

The complete run story for the prototype: development without Docker, the
Compose boot, and dataset regeneration. Every command here is verified to
run as written. Prerequisites: Node ≥ 22.12, pnpm ≥ 12
(`corepack enable pnpm`), git ≥ 2.54 — and for the Compose section, a
running Docker daemon (the build uses BuildKit).

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
The API loads the frozen generated dataset (`data/units.v2.json`) at boot.

Spot-check the boot:

```sh
curl -sS http://localhost:3000/health
curl -sS "http://localhost:3000/units" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log('units served:',JSON.parse(s).units.length))"
```

The health endpoint answers `{"status":"ok"}` and the units count prints the
available-unit total (932 with the current frozen dataset).

Stopping: interrupt `pnpm dev` in its terminal (Ctrl-C). On some platforms
killing the parent processes can leave the API's TypeScript server child
alive and still listening on port 3000; if a subsequent boot reports port
3000 in use, check the listeners explicitly:

```sh
lsof -nP -iTCP:3000 -iTCP:5173 -sTCP:LISTEN
```

and kill the listening PID(s) found there (`lsof` shows no listeners when
both servers are really stopped).

## 2. Compose boot

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

## 3. Dataset regeneration

The frozen dataset (`data/units.v2.json`, committed) must stay byte-identical
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
