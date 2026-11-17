# Proposal

## Why

The deployment plan is committed (`docs/deployment.md`, decisions dated
2026-11-16): a provider-neutral VM + Compose + Caddy architecture on AWS
Lightsail, single-hostname same-origin topology, individual-account Basic
Auth with `X-Robots-Tag: noindex, nofollow` on every response, a weekly
Monday internal release lane plus manual override, digest-based deploys and
rollback, and an ad-hoc Cloudflare quick-tunnel test-build recipe. Nothing
of it exists yet — the stack's deployment story still ends at the local
Compose boot. Internal evaluators have no environment to use.

## What Changes

- **Host bootstrap** (runbook-documented, not code-generated): Lightsail VM
  (1 GB to start, validate headroom), Docker + compose, host firewall
  (22/80/443 only, key-auth SSH), read-only GHCR pull credential, and the
  Caddy front door provisioned with evaluator accounts (bcrypt hashes
  on-host only, never committed).
- **Deployed topology configuration**: a compose override for the deployed
  environment keeping web (:5173) and api (:3000) loopback-only, with the
  Caddy front door as the only listener — TLS (ACME), Basic Auth on every
  path, `X-Robots-Tag: noindex, nofollow` on every response including
  401s, and same-origin routing by the API's real root paths
  (`/health`, `/units`, `/filters`, `/openapi.json` → api; all other
  paths → web). The web image bakes an origin-style base (`https://<host>`, no
  path) exactly like the localhost base it uses today — the client resolves
  root-absolute request paths against the base origin, so the front door
  routes the API's real paths rather than stripping a prefix. The proxy's
  API path list must stay in sync with the API route set (the smoke gate
  exercises `/units`, catching drift at deploy time).
- **Release workflow** (`release-internal.yml`): scheduled weekly Monday
  (~15:17 UTC) + `workflow_dispatch`; snapshots main HEAD once; reruns the
  deterministic repo gates on the pinned SHA; builds the internal web
  image (`VITE_API_URL=https://<internal-host>`) and the API image;
  pushes to GHCR with unique immutable tags; deploys by digest over SSH;
  serialized per environment; skip-if-unchanged against the last
  successfully deployed SHA.
- **Deployment manifests**: per-environment last-good manifest (source SHA,
  web/API digests, config reference, no secrets) driving rollback, which
  redeploys recorded digests — never rebuilds.
- **Smoke gates**: readiness checks plus an authenticated real-browser
  gate — disclosure banner visible, same-origin `/units` data roundtrip,
  `X-Robots-Tag` present on web and API responses, 401 for unauthenticated
  requests.
- **Evaluator notes**: a "what changed" summary per successful internal
  release (previous-deployed-SHA → deployed-SHA), outside GitHub Releases.
- **Ad-hoc tunnel recipe**: documented quick-tunnel flow (tunnel → build
  web for that URL → compose up behind Caddy) for ephemeral test-build
  URLs; the tunnel always fronts Caddy, never a loopback upstream.

## Capabilities

### New Capabilities

(none declared at proposal stage — `skip_specs` until planned; planning
will decide whether a `deployment` capability spec is warranted)

### Modified Capabilities

## Impact

- **Code/config:** `.github/workflows/` (new release workflow), deploy
  topology configuration (compose override + Caddy config template),
  `docs/runbook.md` or a new ops doc for bootstrap/tunnel/rollback
  recipes; no application runtime changes, no Dockerfile image-shape
  changes
- **Sequencing:** after the two serving-posture baselines land or land
  together with them (the API-restart-under-load investigation and the
  static-asset response-headers baseline — the pipeline inherits the same
  images); the internal hostname decision is a prerequisite for the first
  web image build and stays open until settled
- **Out of scope:** the production tagged lane and its provisioning
  (designed in the plan, implemented when first needed); any application
  change (the origin-style base makes none necessary — client, CSP, and
  CORS all work unchanged)
