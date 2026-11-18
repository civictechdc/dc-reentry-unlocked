# Proposal

## Why

The stack's deployment story ends at the local Compose boot: the web
(adapter-node) and API (Fastify) images are built and healthchecked for
dev and e2e (`compose.yaml`, `pr.yml`, `full.yml`), but nothing ships the
app anywhere. Before the prototype can be evaluated by internal audiences
and eventually published, it needs a deployment pipeline for the current
two-service stack with two release lanes — a regular-cadence internal
release of the latest main-branch diffs (weekly or similar), and tagged
production releases following web-app best practice — plus an internal
evaluation environment that stays out of search indexes. Where and how to
host the existing containers is undecided, so this change researches the
deployment options and produces a committed plan rather than pipeline
code.

## What Changes

- An evidence-backed deployment research pass (claims verified against
  current authoritative provider and search-engine docs, not training
  memory):
  - Deployment options for the existing web + API containers: where to
    run the two-service stack (container platform vs VM-with-Compose vs
    similar), including health checks, environment/config injection,
    TLS, cost, and ops burden — no architecture change to the app itself
  - Release-lane best practice for web apps: regular-cadence internal
    releases of accumulated main diffs (scheduled, e.g. weekly) vs
    deploy-on-merge; tagged production releases (semver tags, release
    notes); registry and image-tag strategy; health-gated deploys;
    rollback; preview environments
  - Internal evaluation environment: crawler exclusion (`X-Robots-Tag:
    noindex`, robots.txt semantics and the disallow-hides-noindex nuance,
    auth walls as the stronger control), access-control options (basic
    auth, network/IP allowlists, unlinked hostname), and guaranteeing the
    synthetic-data disclosure renders on every non-prod environment
- Decision session(s) with the user recording the chosen deployment
  option, provider(s), cadence, environment topology, and
  crawler-exclusion controls (dated provenance)
- A committed deployment plan (`docs/deployment.md`): environments, both
  release lanes, pipeline design, crawler exclusion, secrets/config
  handling, rollback, and verification gates — user-reviewed before commit
- Spawned implementation proposal(s) for the chosen pipeline (deploy
  workflows, environment configuration); this change itself lands no
  pipeline or infra code

## Capabilities

### New Capabilities

(none — research/planning change spawned with `skip_specs`; the
implementation change it spawns carries any capability deltas, e.g. a
`deployment` capability)

### Modified Capabilities

## Impact

- **Code:** none (research + planning only)
- **Docs:** `docs/deployment.md` (new, committed)
- **Sequencing:** after `live-walkthrough-feedback` runs its first
  session (deployment then serves the evaluation loop it opens) and
  after `ci-security-badges` lands (its scanners and badges underpin the
  pipeline); independent of the other in-flight product changes — the
  internal environment deploys whatever main carries
