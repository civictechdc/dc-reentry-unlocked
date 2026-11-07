# Tasks

## 1. Deployment research (evidence-backed, no code)

- [ ] 1.1 Research deployment options for the current two-service stack (adapter-node web + Fastify API containers): where to run them (container platform vs VM-with-Compose vs similar), health checks, environment/config injection, TLS, cost, and ops burden — no app architecture change; verify every claim against current authoritative provider docs and cite them
- [ ] 1.2 Research release-pipeline best practice for web apps: regular-cadence internal releases of the latest accumulated main-branch diffs (scheduled, e.g. weekly) vs deploy-on-merge continuous deployment; tagged production releases (semver tags, release notes); registry and image-tag strategy for the existing web + api Dockerfiles (GitHub Actions already the CI runner); health-gated deploys, rollback, and preview environments; produce a recommendation with trade-offs and citations
- [ ] 1.3 Research the internal evaluation environment: crawler exclusion (`X-Robots-Tag: noindex` including non-HTML resources, robots.txt semantics — including that a robots.txt disallow can prevent crawlers from ever seeing a noindex signal — and auth walls as the stronger control), access-control options (basic auth, network/IP allowlists, unlinked hostname), plus guaranteeing the synthetic-data disclosure banner renders on every non-prod environment; cite current search-engine crawler documentation

## 2. Decisions, plan, and follow-ups

- [ ] 2.1 Run the decision session(s) with the user: deployment option, provider(s), release cadence, environment topology, and crawler-exclusion controls; record each decision with dated provenance, then write `docs/deployment.md` (environments, both release lanes, pipeline design, crawler exclusion, secrets/config handling, rollback, verification gates); verify the user reviews and signs off before it is committed
- [ ] 2.2 Spawn the implementation proposal(s) for the chosen pipeline (deploy workflows, environment configuration, crawler-exclusion headers) named and scoped to the plan; verify `openspec validate --all --strict` stays green with them planned

## Workflow follow-up

- After all tasks complete: code review per project policy (the plan document), then archive this change (`openspec archive`) and verify the archived state.
- The spawned implementation proposals carry all pipeline and infra work; this change never edits workflow, compose, or environment code.
