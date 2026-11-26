# Tasks

Implementation and first deploy wait until both `static-asset-headers`
and `api-restart-under-load` land. Group 1 starts only after the human
confirms both landed and authorizes implementation against that baseline.
Do not freeze pre-investigation Compose or image settings.

Numbered groups are sequential, reviewable blocks. Use a fresh session
per block, record evidence, run
`openspec validate deployment-internal-lane --strict`, and stop for human
review before proceeding. Implementers never commit; planning artifacts
are read-only. Before the first commit of any workflow or deployment
script, code review, security review, and an adversarial pass must clear
the security-sensitive surfaces per `AGENTS.md`. The orchestrator
commits and pushes reviewed blocks; the maintainer dispatches workflows
or operates infrastructure; the implementer and reviewer inspect
sanitized outputs. Unmarked verification is local; `Human-gated:`
marks steps needing the maintainer, hosted evidence, or human approval.

Rehearse on the bootstrapped internal host before any evaluator gets the
URL, with rehearsal-only probe accounts. The host is disposable in
practice because nothing depends on it yet; a separate throwaway instance
is allowed, not required. Wipe rehearsal stack and activation state
between scenarios and reseed the required baseline; never erase durable
evidence. Preserve operator-owned config, credentials and ACME state.
Start recovery rehearsals with no current manifest and no running stack,
then prove first-candidate failure, seed green last-good, and rehearse
recovery, rollback and cancellation in that order. Keep schedules off.
For every hosted rehearsal that contacts the host, confirm the venue
hostname and flag, manually dispatch from `main`, read its run ID and
attempt, then write the D20 marker during admission. Proceed only
after authorization. The disposable non-main environment check has
no host contact; the unmarked-target negative deliberately does not
bind. End every block that changes host or repository configuration
with sanitized cleanup evidence reviewed by the human before real
activation: restore the prior rehearsal state where applicable and
compare operational policy, configuration and credential classes.

No production lane, pnpm version bump, Dependabot, or application change
beyond proxy trust. Run commands from the worktree root unless `-C`
selects a workspace. Never log credentials or raw probe addresses.

## 1. Approve the baseline and bound API proxy trust

- [ ] 1.1 Human-gated: Confirm both prerequisites landed and approve
  implementation. Verify: record adopted revision and serving posture,
  both prerequisite landings, and maintainer authorization.
- [ ] 1.2 Add tests for trusted peer, untrusted peer, unset configuration,
  and same-address sharing across accounts. Wire `API_TRUST_PROXY` in
  `apps/api/src/server.ts` and `apps/api/src/app.ts`; reject invalid and
  catch-all trust. Update `docs/api.md`. Verify: capture fail-first
  evidence for new trust behavior and passing baseline controls; after
  implementation all four pass with `pnpm -C apps/api test` and
  `pnpm typecheck`. A same-address control uses different credentials,
  not different bucket keys.

## 2. Define deployment topology and pin images

- [ ] 2.1 Add `deploy/internal/compose.yaml`; pin bridge and peer, retain
  loopback ports and inherited health checks. Document local/CI boundary
  in `docs/deployment.md`. Verify:
  `docker compose -f compose.yaml -f deploy/internal/compose.yaml config`
  with fixture digest inputs shows exact loopback ports and peer pin;
  root `compose.yaml` is byte-identical to the landed baseline.
- [ ] 2.2 Add `deploy/internal/Caddyfile.template`; strip upstream
  `Authorization` requests and upstream robots response headers on both
  legs, preserving the immediate front-door header and auth order.
  Document validation/reload in `docs/internal-ops.md`. Verify:
  `caddy validate --config <rendered-file> --adapter caddyfile`; on
  isolated HTTPS, count raw header fields and assert exactly one
  `X-Robots-Tag` of `noindex, nofollow` on 401, both legs' 200 and 500
  even with an upstream header, and front-door 502. Verify the HTTP
  redirect also carries exactly one and never serves application data.
- [ ] 2.3 Add `scripts/check-internal-routes.mjs` and
  `apps/api/test-support/internal-route-inventory.ts`; wire into
  `pnpm test` and export paths for the selected version's access probe.
  Verify: `node scripts/check-internal-routes.mjs` passes exact parity
  and rejects a real unmatched API registration while `/units` works.
- [ ] 2.4 Digest-pin external images in `apps/api/Dockerfile` and
  `apps/web/Dockerfile`, preserving tooling versions. Record reviewed
  refresh procedure in `docs/deployment.md`. Verify:
  `docker buildx imagetools inspect <tag@digest>` for each pinned image
  shows `linux/amd64` and `linux/arm64`;
  `docker buildx build --platform linux/amd64 -f apps/api/Dockerfile --load -t internal-api:pin-check .`
  and
  `docker buildx build --platform linux/amd64 -f apps/web/Dockerfile --load -t internal-web:pin-check .`
  both succeed.
- [ ] 2.5 Document `API_RATE_LIMIT_MAX` and its default in
  `docs/deployment.md`. Verify: local test overrides are distinguished
  from the internal 100 requests per 60 seconds and agree with
  `docs/api.md` and the rendered deployment config.

## 3. Build candidate gates and immutable publishing

- [ ] 3.1 Add manual-only `plan`/`checks`/`publish` to
  `.github/workflows/release-internal.yml` with no deploy/probe secrets.
  Record exact tool and Action pins in `deploy/internal/tool-versions.json`;
  document cadence, tag source and digest identity in `docs/deployment.md`.
  Verify: `actionlint .github/workflows/release-internal.yml` and local
  fixtures cover non-main refusal, pinned SHA, and rerun tag uniqueness.
- [ ] 3.2 Add `scripts/deploy/internal-inventory.sh` and
  `deploy/internal/sbom-coverage.json`. Pin scanner checksum filenames
  and hashes in `deploy/internal/tool-versions.json`. Compare the pinned
  images' OS package databases and API production dependency tree with
  independent expectations; check the distinct web build inventory.
  Verify: scan locally built digest fixtures; missing expected package
  blocks, and a stubbed scanner/database failure reports unavailable
  without blocking promotion. Document report semantics in
  `docs/deployment.md`.
- [ ] 3.3 Prepare signing and read-only `verify` in
  `.github/workflows/release-internal.yml`, including D20's one-kind
  negative controls. Document fail-closed verification in
  `docs/deployment.md`. Verify locally:
  `actionlint .github/workflows/release-internal.yml`; fixtures enforce
  distinct predicates and reject wrong identity. Hosted proof runs
  only in group 13; no registry access is required here.

## 4. Validate host inputs and constrain deployment authority

- [ ] 4.1 Build the validation and command surface in
  `scripts/deploy/internal-host.sh`: fixed operations, strict manifest
  fields, allowed origins/packages, and versioned root-owned templates.
  Document exact sudoers boundary, SSH pin, registry identity and
  install/preflight commands in `docs/internal-ops.md`. Verify: local
  fixtures reject arbitrary commands, shell text, uploaded config,
  unapproved digests/origins and unsafe template selections.
- [ ] 4.2 Render host-owned config and add digest pull, bounded
  readiness and validated `systemctl reload caddy` to
  `scripts/deploy/internal-host.sh`. Document compatible version
  installation in `docs/internal-ops.md`. Verify: isolated Compose and
  Caddy validate with exact pins; stubbed pull/config failures cannot
  reach switch or reload; valid pulls precede activation with no build.
- [ ] 4.3 Add D20's first-contact admission, host authorization and
  go-marker hold to `scripts/deploy/internal-host.sh`. Document
  dispatch, bind, release and cleanup in `docs/internal-ops.md`.
  Verify: a flagged host waits for the exact binding before inspection,
  accepts a late valid marker, and rejects after ten minutes without
  mutation; an unmarked host never waits. A bad go-marker or
  120-second timeout stops the next workflow action, not operator edits.

## 5. Make host state and recovery durable

- [ ] 5.1 Implement locked inspect/activation state in
  `scripts/deploy/internal-host.sh`: pending first, unchanged comparison,
  then target and incumbent eligibility. Retain verified route inventory
  and exact config version with successful activation. Verify: local
  state fixtures cover first activation, pending refusal, unchanged
  skip with missing template, forced recheck, and incompatible versions.
- [ ] 5.2 Implement host settlement, restore and reconciliation in
  `scripts/deploy/internal-host.sh`; document no-last-good stops,
  exact-version eligibility, recovery dispositions and backfill sources
  in `docs/internal-ops.md`. Verify: stubbed hard and inconclusive
  outcomes never promote; changed restore eligibility refuses mutation;
  successful recovery uses old digests without rebuilding.

## 6. Collect and validate phase evidence

- [ ] 6.1 Implement same-run A/B sampling in
  `apps/web/e2e-internal/probe.ts` and bounded host observation in
  `scripts/deploy/internal-host.sh`. Supply sanitized observations
  in the D13 `internal-evidence/` JSON files, with path/digest-only job
  outputs and pinned same-run file transfer. Document schema, bindings
  and privacy in `docs/internal-ops.md`. Verify: fixtures accept valid
  observations without deciding acceptance, and reject missing, stale,
  malformed and digest-mismatched evidence. Files contain no raw
  addresses, credentials, headers or logs.

## 7. Define and execute browser and evidence scenarios

- [ ] 7.1 Add `apps/web/playwright.internal.config.ts` using
  `defineBddConfig`, the separate gitignored generated output, and
  `apps/web/e2e-internal/features/internal-deployment.feature` with
  requirement, stage and health tags. Bind `createBdd` and browser
  mechanics under `apps/web/e2e-internal/steps/`. Share axe mechanics
  via `apps/web/test-support/axe.ts` without changing the existing
  blocking PR behavior or adding tests under `apps/web/e2e/`.
  Document the acceptance command in `docs/internal-ops.md`. Verify
  from `apps/web` with workspace binaries on PATH:
  `bddgen -c playwright.internal.config.ts && playwright test -c playwright.internal.config.ts`
  against isolated fixtures. Cover TLS, disclosure, real `/units`, all
  parity paths, the real asset and unknown path, denied and authenticated
  controls, isolated front-door 502, public-port bypass, and report-only
  axe. Count raw robots header fields; missing address lookup is
  inconclusive and axe errors report unavailable.
- [ ] 7.2 Add technical scenarios to `internal-deployment.feature` and
  steps under `apps/web/e2e-internal/steps/` that assert D13
  `internal-evidence/` JSON
  for A/B samples, timing, process identity and origin distinctness.
  Cover forwarded-claim rejection and shared-budget exhaustion across
  two accounts using a fresh fixture window. Verify: the D13 generation
  and test command passes valid evidence and turns red for shared origin,
  expiry, restart or missing required evidence. Distinguish hard failure
  from inconclusive, never print addresses, headers or credentials.

## 8. Enforce requirement-to-scenario coverage

- [ ] 8.1 Add `scripts/check-internal-bdd-coverage.mjs` and unit tests;
  wire into `pnpm test` per D21 and document tag/exclusion conventions
  in `docs/internal-ops.md`. Verify: covered fixtures pass, a requirement
  without a release-selected scenario fails, an unknown tag fails, and
  untagged scenarios, slug collisions, stale or overlapping exclusions
  and feature-only tags do not satisfy coverage. Verify both spec paths,
  scenario outlines, and multi-tag counting. Run `pnpm test`, `pnpm lint`,
  `pnpm format:check`, `pnpm typecheck` and `pnpm arch:check`.

## 9. Wire the existing activation and settlement graph

- [ ] 9.1 Wire inspect, verify, switch, and pre-switch advisory
  qualification in `.github/workflows/release-internal.yml` per D5/D6.
  Keep the existing graph and no `actions: write`. Verify:
  `actionlint .github/workflows/release-internal.yml`; workflow fixtures
  cover skip, force, pending, missing template and failed advisory probe;
  only successful verify authorizes a switch.
- [ ] 9.2 Wire candidate and restore collectors and observers to
  `internal-evidence/` JSON files and the browser jobs to both release
  selections of `internal-deployment.feature`. Apply D5's pinned
  checkout, frozen web dev install, Chromium-only and step-scoped
  probe credentials. Settlement and close consume scenario verdicts;
  no SSH-bearing or collector process runs the suite. Update recovery
  instructions in `docs/internal-ops.md`. Verify: actionlint and
  workflow fixtures prove permissions separation, missing or failed
  verdict routes to recovery, and settlement still runs after a
  possibly mutating switch failure.
- [ ] 9.3 Provide D20's first-contact admission, marker-bound inputs
  and same-job host holds
  in the existing workflow. Document named checkpoints, resumed jobs,
  timeout effects and cleanup in `docs/internal-ops.md`. Verify:
  scheduled, non-main or mismatched requests and writer preflight
  failures cannot mutate; an unchanged switch fault requires explicit
  force; registry-only mode uses admission but finishes after
  verification without a checkpoint hold. The first-candidate smoke
  fault fails the real mandatory disclosure scenario in
  `internal-deployment.feature`; no synthetic job verdict.

## 10. Record release history and make alerts observable

- [ ] 10.1 Wire `record` and add `deploy/internal/cliff.toml`. Verify
  git-cliff checksum and bot identity against pinned tooling; record
  them in `deploy/internal/tool-versions.json`. Document history
  backfill in `docs/internal-ops.md`. Verify: local bare-remote fixture
  rejects a stale history push, refetches and retries without force,
  duplicates or default-branch edits. Durable findings include
  vulnerability rows, scanner/database metadata and axe impact/rule IDs
  after temporary artifacts are removed. Pending evidence finalizes
  once on backfill; rollback/restore do not generate forward ranges.
- [ ] 10.2 Wire release `alert` and `.github/workflows/health-internal.yml`
  with both cron entries gated off until approval. Generate from the
  same internal BDD config with D5's scenario job setup. Select only
  `@health` in `internal-deployment.feature` using whole-tag `--grep`;
  no isolation or release-only axe. Document cadence,
  deduplication, failure visibility and missed-run ownership in
  `docs/internal-ops.md` and `docs/deployment.md`. Verify:
  `actionlint .github/workflows/release-internal.yml
  .github/workflows/health-internal.yml`; generation, filtered `--list`
  and a fixture run show that a nonempty set of all and only `@health`
  scenarios runs
  (browser, data, TLS, denial and ordinary robots checks). A failing
  selected scenario fails health. The stubbed incident API confirms
  deduplication and visible red status on posting failure.
- [ ] 10.3 Finish the local quick-tunnel recipe in `docs/internal-ops.md`
  and link from `docs/runbook.md`. Verify: isolated local proxy check
  proves auth, robots header and correct baked origin; document the
  short-lived URL and platform-specific trust/budget diagnosis.
  Verify references with `node scripts/check-tracking-refs.mjs`.
- [ ] 10.4 Prepare D20's reviewed ruleset and disposable-ref checks,
  rehearsal-only history, and marker-bound no-switch alert invocation.
  Document cleanup in `docs/internal-ops.md`. Verify: writer preflight
  and `record` independently reject bad bindings; invalid override
  cannot claim delivery; deny/retry never targets production history.
  Disposable workflow review finds only environment references, with
  no checkout, secret mapping, publication or host action.

## 11. Prepare repository controls for the rehearsals

- [ ] 11.1 Human-gated: Create the two `main`-restricted environments,
  the orphan `internal-releases` branch, and the targeted `main` rule
  with maintainer bypass but no workflow bypass. Configure named alert
  recipients and enablement variables with schedules off. Verify:
  policy readback, history branch has no source/workflows, and
  `docs/internal-ops.md` records setup and maintainer push behavior.
## 12. Provision the rehearsal host, accounts and DNS

- [ ] 12.1 Human-gated: Provision Lightsail Linux amd64, static IP,
  and cloud/host firewall limited to 22/80/443. Verify: attached static
  address, permitted ingress only, no external TCP 3000/5173, and a
  subnet-overlap check against host routes, provider networks and
  Docker pools. Record bootstrap in `docs/internal-ops.md`.
- [ ] 12.2 Human-gated: Choose hostname, write matching records in NS1
  and Squarespace Domains DNS. Verify: `dig @<server> <hostname> A`
  returns the static IP from every delegated authority and a public
  resolver before any internal-URL image build or certificate attempt.
- [ ] 12.3 Human-gated: Install unattended upgrades, exact Docker,
  Compose and Caddy pins, bounded log rotation and persistent ACME
  storage. Keep Caddy stopped. Verify: installed versions, bounded
  logs and upgrades are configured; no HTTPS app is serving.
- [ ] 12.4 Human-gated: Provision read-only registry credentials under
  the execution identity and host-only bcrypt for rehearsal probes;
  store probe pairs in `internal-probe`. Install memory/disk timer
  and durable restart/OOM evidence. Verify: pull works without publish,
  the required account fragment is nonempty and reads only to its
  authorized identities; samples/restart evidence survive replacement
  and reboot in a controlled host fixture.
- [ ] 12.5 Human-gated: Install the root-owned entry point and templates,
  set the rehearsal venue flag and document D20's first-contact
  admission, set up constrained SSH and narrow sudoers,
  and set the SSH key and independently verified host-key pin. With
  the bcrypt fragment present, validate and start Caddy. Verify: config
  validation and reload pass, HTTPS is certificate-valid and answers
  401 unauthenticated, and host-key mismatch, interactive SSH and
  arbitrary privileged commands are refused.

## 13. Rehearse hosted controls and qualify the target

- [ ] 13.1 Human-gated: Confirm rehearsal hostname and venue flag.
  With secrets provisioned and reviewed workflows on `main`, dispatch
  D20's policy control, bind its run/attempt in admission, then proceed.
  Attempt a real workflow-token update to `main` and an authorized
  maintainer update. Verify: the rule rejects the workflow token;
  maintainer and rehearsal history writes succeed. Review and run the
  disposable non-main ref against both environments, then delete it.
  Verify both deny and the reviewed ref had no checkout, secret mapping,
  publication or host action. Confirm production policies are intact.
- [ ] 13.2 Human-gated: Set `INTERNAL_HOST` after DNS verification.
  Confirm rehearsal hostname and flag. Dispatch D20's registry-only
  invocation and bind each run/attempt in admission before proceeding.
  `verify` has no host credentials; no holds follow verification.
  Verify: both exact digests get both attestations, and the pinned `gh`
  rejects independently invalidated provenance and SBOM. Confirm
  predicate types, source digest format and verification read scope.
  Record `rehearsal only — no switch`; verify no host activation or
  production history change, then clear the bindings.
- [ ] 13.3 Human-gated: Confirm rehearsal hostname and venue flag.
  Boot a private validation stack directly (no workflow dispatch) to
  measure the API socket peer and test rehearsal accounts. Verify: the peer
  matches the single pin and both accounts authenticate; remove the
  validation stack and confirm no running stack or current manifest
  before starting recovery rehearsals.
## 14. Verify monitoring and alert delivery

- [ ] 14.1 Human-gated: Confirm rehearsal hostname and venue flag.
  Install Lightsail email alarms and HetrixTools
  passwordless HTTPS 401 and TLS-expiry monitoring. Verify: monitoring
  test notifications arrive, renewal/expiry checks are enabled, and
  expected HTTPS 401 is healthy with no password supplied.
- [ ] 14.2 Human-gated: Use D20's normal and invalid-recipient alert
  no-switch controls before recovery. Check the rehearsal hostname
  and flag, then dispatch and bind each run in admission before proceeding.
  Verify: rehearsal recipients confirm delivery and missed-run
  ownership; invalid rehearsal override gives a visible sanitized
  posting error, red run and no delivery claim. Clear the override
  and verify production alert variables and probe credentials are
  unchanged.

## 15. Rehearse empty-host failure, then seed last-good

- [ ] 15.1 Human-gated: Check rehearsal hostname, flag and empty host
  state. Dispatch `first-candidate-smoke`, bind in admission, and
  proceed. Verify: both attestation
  kinds for both digests verify before either candidate starts; record
  events in order. The mandatory disclosure scenario in
  `internal-deployment.feature` fails; the candidate stops, no restore
  is claimed, and durable
  rehearsal history and an alert show first-activation failure. Remove
  the binding and verify production history and credentials are intact.
- [ ] 15.2 Human-gated: Check rehearsal hostname and marker before
  resetting state. Dispatch a green seed, bind in admission, and
  proceed. Verify: candidate becomes last-good only after readiness,
  browser/access acceptance and origin-observed isolation; retained
  report and config identify exact digests. Save the sanitized evidence
  and reseed this baseline after wipes as required.

## 16. Rehearse activation and isolation fault families

- [ ] 16.1 Human-gated: Check rehearsal hostname, flag and seeded
  last-good. Dispatch `provenance` and `sbom` separately, binding each
  run during admission before proceeding. Verify:
  neither starts a new container
  nor changes the serving pair; only the selected predicate check fails.
  Clear bindings and confirm production state is untouched.
- [ ] 16.2 Human-gated: Check rehearsal hostname and marker; pre-stage
  and validate the restart procedure and the unchanged restart config —
  not a container ID, which the candidate switch replaces. Dispatch, bind
  in admission, then proceed. At `before-candidate-b`, recheck venue,
  identify the API container started by this candidate (it runs the
  candidate's recorded API digest) and verify that identity before
  restarting it as one operation (no config edits), and write the
  go-marker. `deploy_hold_candidate_b` resumes before B samples. Verify:
  restart makes isolation inconclusive; report hold/binding failure
  separately from 60-second window expiry. Timeout stops the next
  action, not the restart; verify the prior rehearsal config and serving
  state before another phase. Clear markers and confirm production state
  is intact.
- [ ] 16.3 Human-gated: Check rehearsal hostname and marker before
  atomically applying the validated wrong-pin variant. Dispatch, bind
  in admission, and proceed; use a controlled client with two rehearsal
  accounts for the direct budget controls. Verify: wrong pin cannot pass;
  forged forwarding does not change the bucket; both accounts receive
  429 after same-address exhaustion. Shared runner egress is observed
  only; equality is deterministic in local fixtures. Remove the
  variant, restore the exact pin, and verify production config intact.

## 17. Rehearse candidate failure and automatic restore

- [ ] 17.1 Human-gated: Confirm rehearsal hostname and marker. Pre-stage
  and validate the rotated candidate account fragment and original
  fragment. Dispatch each D20 candidate-failure case, bind in admission,
  then proceed. For the password case apply the rotated file atomically
  at `before-candidate-browser` (`deploy_candidate_observe` resumes);
  reinstate it at `before-restore` (`deploy_settle` resumes). Restore
  the prior file on apply/reload failure. Verify candidate readiness or
  smoke failure leads to exact prior digests and green recheck. Record
  hold/binding failure separately from 60-second expiry. If a hold times
  out, stop the next action, explicitly reinstate and verify prior
  rehearsal configuration before another phase. Prove production config
  was unchanged.
## 18. Rehearse restore-negative outcomes

- [ ] 18.1 Human-gated: Confirm rehearsal hostname and marker. Pre-stage
  and validate changed and original restore-B/browser account fragments.
  Dispatch each restore-negative case, bind in admission, and proceed.
  At `before-restore-b`, apply the B fragment atomically with
  restore-on-failure (`deploy_hold_restore_b` resumes). At
  `before-restore-browser`, reinstate B for the inconclusive case or
  rotate only the browser account for the hard case
  (`deploy_restore_observe` resumes). Verify “restore unverified”
  versus hard alert, independently of hold/binding continuity failure
  and 60-second sampling expiry. After a timeout, explicitly restore
  and verify the prior rehearsal config before another phase. Reinstate
  credentials before reuse and compare production config.
## 19. Rehearse rollback, cancellation and history backfill

- [ ] 19.1 Human-gated: Confirm rehearsal hostname and marker; pre-stage
  validated version availability and revocation changes. Dispatch,
  bind in admission, then at `before-rollback-switch` confirm versions
  or atomically revoke the rehearsal target with restore-on-failure.
  Release `deploy_switch`. Verify exact config/digest reuse with green
  promotion, or refusal before switch. Timeout/bad binding is a
  refusal with no switch, not window expiry. Restore and verify prior
  rehearsal eligibility before another phase and compare production config.
- [ ] 19.2 Human-gated: Confirm rehearsal hostname and marker. Dispatch,
  bind D20's cancellation run during admission, then recheck venue and cancel
  `deploy_switch` at `after-switch-pending` instead of releasing it.
  If neither released nor cancelled, timeout fails the phase without
   another mutation at that checkpoint; verify prior rehearsal config
   before recovery. Verify: the next
  run refuses mutation while pending; maintainer reconciles actual
  host state and backfills one finalized record with the cancelled
  attempt's observed outcome. Remove go-markers and verify production
  state remains intact.
- [ ] 19.3 Human-gated: Confirm rehearsal hostname and marker before
  changing policy. Use D20's history outage control and review the
  deterministic stale-write fixture from 10.1. Dispatch and bind in
  admission to the rehearsal-only history location. Verify: denied append leaves
  backfillable host evidence; local retry does not overwrite; finalized
  reports outlast artifacts. Undo denial and confirm no test edited
  or denied writes to production history.

## 20. Activate the real target after rehearsals

- [ ] 20.1 Human-gated: Confirm rehearsal hostname and marker before
  account edits. Clear the D20 venue flag, run marker and rehearsal activation
  state or switch to the prepared unmarked target. Remove go-markers
  and rehearsal policy controls, revoke rehearsal accounts, install
  operational probes, and prepare individual evaluator credentials
  without sharing the URL yet. Verify: marker absent, retired accounts
  absent from active config, probe secrets replaced, no plaintext on
  host or in evidence.
- [ ] 20.2 Human-gated: Dispatch one reviewed D20 fault from `main`
  against the unmarked target after a baseline snapshot. Verify:
  immediate `rejected fault dispatch` with no admission wait, no host
  or history mutation, same running
  digests (or empty stack) and current record, production variables
  and credentials unchanged. Record only sanitized evidence.
- [ ] 20.3 Human-gated: Dispatch the first activation on the real
  target after the rehearsals, from `main`, schedules still off.
  Verify: exact verified digests, browser and isolation pass, durable
  host/history records agree, both new probe accounts authenticate,
  old rehearsal credentials get 401, and the independent monitor sees HTTPS
  401. Measure headroom during the switch or explicitly force a second
  switch: five-second samples show at least 200 MiB `MemAvailable`,
  no OOM or unexpected restart, and no sustained swap growth. If it
  fails, resize and repeat.

## 21. Run integration gates and approve schedule enablement

- [ ] 21.1 Run combined repository gates and check scenario evidence.
  Verify: `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm typecheck`,
  `pnpm arch:check`, `pnpm design:check`, `pnpm audit --prod`,
  `pnpm audit`, `pnpm -C apps/web e2e`, `pnpm -C apps/web e2e:bdd`,
  `pnpm -C apps/web e2e:prod`, `pnpm -C apps/web e2e:ci`,
  `pnpm -C apps/web e2e:bdd:ci`, `pnpm -C apps/web scan:flags`,
  `pnpm datagen`, `pnpm docgen:model`, `node scripts/check-diagrams.mjs`,
  `node scripts/run-mutation.mjs` (report-only),
  `node scripts/check-tracking-refs.mjs`,
  `actionlint .github/workflows/release-internal.yml
  .github/workflows/health-internal.yml`, and
  `openspec validate --all --strict`. Follow documented boot/teardown
  order; generated data and model stay byte-identical. Against the local
  `internal-evidence/` fixture and isolated origin, run from `apps/web`:
  `bddgen -c playwright.internal.config.ts && playwright test -c playwright.internal.config.ts`
  with workspace binaries on PATH. Verify the generated
  `internal-deployment.feature` scenarios execute.
- [ ] 21.2 Human-gated: Review integrated live, host and history
  evidence against the capability and approval criteria. Verify:
  maintainer records integration approval after gates, security review,
  real activation, headroom and alert delivery pass.
- [ ] 21.3 Human-gated: Enable both schedules only after recorded
  integration approval. Verify: guards permit authorized `main`
  scheduled runs, due runs are visible, and missed-run ownership is
  confirmed before evaluator handoff.
- [ ] 21.4 Human-gated: After integration approval, share the URL and
  individual evaluator passwords out of band via the secure handoff.
  Verify: each evaluator confirms access with their own account; no
  shared accounts or credentials in records, chat logs, or CI.

## Workflow follow-up

- Human-gated: Archive only after project review requirements are
  satisfied; record maintainer approval and archive evidence.
- Verify the archived result: `internal-deployment` requirements are
  present in main specs and `openspec validate --all --strict` passes.
