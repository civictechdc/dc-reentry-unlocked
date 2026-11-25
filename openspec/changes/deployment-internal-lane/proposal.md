# Proposal

## Why

The deployment plan is committed (`docs/deployment.md`, decisions dated
2026-11-16): a provider-neutral VM + Compose + Caddy architecture on AWS
Lightsail, single-hostname same-origin topology, individual-account Basic
Auth with `X-Robots-Tag: noindex, nofollow` on every response, a weekly
Monday internal release lane plus manual override, digest-based deploys and
rollback, and an ad-hoc Cloudflare quick-tunnel test-build recipe. Nothing
of it exists yet — the stack's deployment story still ends at the local
Compose boot. Internal evaluators have no environment to use. On 2026-11-24
the user refined the ask: internal builds deploy to AWS securely and
reliably, with evaluator access plus an accessibility gate, readable build
tags, an auditable pipeline, proportionate observability, and reliable SBOM
reports.

## What Changes

Decisions dated 2026-11-24 are marked; unmarked bullets restate the
committed plan.

- **Host bootstrap** (runbook-documented, not code-generated; the user
  bootstraps): Lightsail VM (1 GB to start, validate headroom), Docker +
  compose, host firewall (22/80/443 only, key-auth SSH), unattended
  security updates, Docker daemon log rotation, read-only GHCR pull
  credential, and the Caddy front door provisioned with evaluator accounts
  (bcrypt hashes on-host only, never committed).
- **Hosting stays Lightsail VM + Compose + Caddy** (2026-11-24): the
  operator's AWS permission set covers Lightsail plus read-only access to
  everything else, and the design stays provider-neutral. The Lightsail
  Container Service was evaluated and rejected: its managed HTTPS edge
  answers some requests itself, so authentication and `X-Robots-Tag` cannot
  be guaranteed on every response. An EC2 / SSM / CloudWatch-native path
  stays a possible later addition (it needs broader AWS permissions).
- **Deployed topology configuration**: a compose override for the deployed
  environment keeping web (:5173) and api (:3000) loopback-only, with the
  Caddy front door as the only listener — TLS (ACME), Basic Auth on every
  path, `X-Robots-Tag: noindex, nofollow` on every response including
  401s, and same-origin routing by the API's real root paths
  (`/health`, `/units`, `/filters`, `/openapi.json` → api; all other
  paths → web). The web image bakes an origin-style base (`https://<host>`,
  no path) exactly like the localhost base it uses today; a build with a
  non-localhost base emits a CSP blessing exactly that origin (verified
  2026-11-24), so the client, CSP, and CORS work unchanged. The proxy's
  API path list must stay in sync with the API route set (the smoke gate
  exercises `/units`, catching drift at deploy time).
- **API rate limit behind the front door** (added scope, 2026-11-24 — the
  only application change): behind a same-host proxy every request reaches
  the API from the proxy's address, so all evaluators would share one
  100-requests-per-minute budget. The API learns to trust the front door's
  client-address header for the proxy's address only (Fastify
  `trustProxy`), covered by a unit test; the smoke gate proves two
  evaluators do not share a bucket.
- **Release workflow** (`release-internal.yml`): scheduled weekly Monday
  (~15:17 UTC) + `workflow_dispatch`; snapshots main HEAD once; reruns the
  deterministic repo gates on the pinned SHA; builds the internal web image
  (`VITE_API_URL=https://<internal-host>`) and the API image; pushes to
  GHCR; deploys by digest over SSH; serialized per environment;
  skip-if-unchanged against the last successfully deployed SHA. The
  build/publish job never holds deployment secrets and the deploy job never
  holds publish credentials (2026-11-24: the deploy job uses a GitHub
  Environment restricted to `main`; every Action is pinned by full commit
  SHA).
- **Build tags** (2026-11-24): SemVer pre-release
  `<version>-internal.<yyyymmdd>.g<short-sha>.<run-id>.a<attempt>`, e.g.
  `0.1.0-internal.20261124.g7f0896f.18965432101.a1`. Unique by construction
  and never reused by workflow policy (the workflow never relies on the
  registry enforcing tag immutability); no `latest`-style aliases; deploys
  and rollbacks reference digests only. The version core comes from one
  source named in design (no single app version exists today).
- **Auditable pipeline** (2026-11-24): each image is built with minimal
  BuildKit provenance and an SBOM attestation; GitHub signs an attestation
  for each pushed digest, and the deploy step verifies the signature
  (signer workflow + `main` source) before any container starts — fail
  closed, last-good keeps serving. Base images are pinned by digest. Each
  deploy records source SHA, both digests, run and attempt, and gate
  results in a deploy-record history kept beyond the workflow run logs.
- **Reliable SBOM reports** (2026-11-24): each pushed digest is also
  scanned with a pinned Syft, producing a CycloneDX JSON that is uploaded
  and signed against the digest. Coverage is checked (expected base-image
  OS packages and API npm packages; the web image gets a separate build
  inventory because the bundled SPA carries no package manifests), and
  findings are reported per internal release. OWASP Dependency-Track was
  evaluated: a persistent instance is deferred (it needs its own API
  server — 2 GB RAM minimum by its docs — plus a frontend and a database,
  more than the VM can host alongside the app); whether a scheduled
  ephemeral CI run is worth adding is a design decision.
- **Deployment manifests**: per-environment last-good manifest (source SHA,
  web/API digests, config reference, no secrets) plus a retained history
  driving rollback, which redeploys recorded digests — never rebuilds.
- **Smoke gates**: readiness checks plus an authenticated real-browser
  gate — disclosure banner visible, same-origin `/units` data roundtrip,
  `X-Robots-Tag` present on web and API responses, 401 for unauthenticated
  requests, per-evaluator rate limiting — and (2026-11-24) an automated
  accessibility scan (axe via Playwright), reported per internal release.
- **Observability** (2026-11-24, Tier 0 — no credential leaves the team's
  control): Lightsail built-in email alarms for host status; bounded,
  sanitized logs on the host (credentials never logged); an external uptime
  check that holds no password and expects HTTPS plus the password prompt
  (401); a scheduled GitHub health run that executes the authenticated
  browser smoke with a probe account stored only in GitHub and alerts a
  named recipient; on-host memory/disk sampling and persistent
  container-restart evidence.
- **Evaluator notes**: a "what changed" summary per successful internal
  release (previous-deployed-SHA → deployed-SHA), outside GitHub Releases.
- **Ad-hoc tunnel recipe**: documented quick-tunnel flow (tunnel → build
  web for that URL → compose up behind Caddy) for ephemeral test-build
  URLs; the tunnel always fronts Caddy, never a loopback upstream.
- **Documentation**: the committed plan (`docs/deployment.md`) is updated
  with the 2026-11-24 decisions and now mentions `API_RATE_LIMIT_MAX`;
  bootstrap, tunnel, rollback and health recipes land in an ops doc.

## Capabilities

### New Capabilities

- `internal-deployment`: the internal release lane's observable contract —
  access wall (401 without credentials, `X-Robots-Tag` on every response),
  same-origin API routing, per-evaluator rate limiting behind the front
  door, deploy traceability (digest + commit + signature verified before
  start), rollback by recorded digests, accessibility results reported per
  release, and health alerting. Written in the design step, which also
  un-sets `skip_specs`.

### Modified Capabilities

(none — no existing capability's requirements change; no main spec carries
a rate-limit requirement today)

## Impact

- **Code/config:** `.github/workflows/` (new release workflow + health
  workflow), deploy topology configuration (compose override + Caddy config
  template), `apps/api` (the bounded proxy-trust change and its unit test),
  digest pins in both Dockerfiles, `docs/deployment.md` and an ops doc
- **Sequencing:** after the two serving-posture baselines land or land
  together with them (the API-restart-under-load investigation and the
  static-asset response-headers baseline — the pipeline inherits the same
  images). Unchanged 2026-11-24: this change is planned now; its
  implementation and first deploy wait for them.
- **Human-gated inputs:** the internal hostname (prerequisite for the first
  web image build), the evaluator account list (names only in local notes;
  hashes on the host), secrets provisioning (SSH deploy key, GHCR read-only
  token), an alert recipient, an uptime-monitor account
- **Out of scope:** the production tagged lane and its provisioning;
  EC2/SSM/CloudWatch-native deploys; the Lightsail Container Service; a
  persistent Dependency-Track server; on-demand branch previews on AWS and
  deploy-on-every-merge (kept open as potential later updates); Cosign
  signing; any application change beyond the proxy-trust configuration
