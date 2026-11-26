# Design

## Context

See [proposal](proposal.md) for motivation and binding scope. The current
Compose boot builds two healthchecked services, both loopback-published.
The web build bakes its API origin and CSP; the API limiter keys on Fastify's
`request.ip`. Deployment must preserve local and PR CI behavior. See the
[planning evidence](research/planning-evidence-2026-11-24.md), especially
“Repository facts”, “Front-door behaviour”, “GitHub”, and “Not verified”.
The observed API socket peer on the target host is not yet known.

## Goals / Non-Goals

**Goals:**

- Make the front door the only public application listener. Prove this and
  the unchanged browser data flow from outside the VM.
- Make a release a verified digest pair plus recoverable runtime config.
  Separate publishing, host mutation, public records, and alerts.
- Make failure and recovery visible without logging credentials or relying
  on an expiring workflow log as the deployment ledger.

**Non-Goals:**

- No production lane, per-PR VM, managed edge, signing service, SBOM
  dashboard, or zero-downtime choreography.
- No API route, limiter algorithm, account-aware API identity, or frontend
  behavior change. Local Compose stays the local/CI boot.

## Decisions

**D1 — Isolate deployment files.** Keep root `compose.yaml` byte-identical
to the landed prerequisite baseline. Add `deploy/internal/compose.yaml`
(override), `deploy/internal/Caddyfile.template`, `deploy/internal/cliff.toml`,
`deploy/internal/tool-versions.json` (new tool pins and download hashes),
and `deploy/internal/sbom-coverage.json` (reviewed inventory expectations).
Use `scripts/deploy/internal-host.sh` for host operations,
`scripts/deploy/internal-inventory.sh` for CI inventory/scan, and
`scripts/check-internal-routes.mjs` for API matcher parity. Keep the
workflows in `.github/workflows/{release,health}-internal.yml`
and runner logic with its owner: `apps/web/playwright.internal.config.ts`
uses `defineBddConfig` for
`apps/web/e2e-internal/features/internal-deployment.feature` and
`apps/web/e2e-internal/steps/**/*.ts`. Keep technical evidence collection
in `apps/web/e2e-internal/probe.ts`. Share the existing axe scan mechanics
via `apps/web/test-support/axe.ts`, outside either discovery tree.
Generate into a dedicated, gitignored `apps/web/.features-gen-internal/`.
Use `docs/internal-ops.md` for operations.
Reject a shared implicit override or adding remote tests to `e2e/`: either
would change discovery or boot for existing local and CI callers.

**D2 — Caddy is a host service.** Run it with its own service identity,
persistent ACME state, and a loopback-only admin endpoint. It can reach
`127.0.0.1:3000` and `127.0.0.1:5173` without an additional bridge hop.
Reject a sidecar: reaching host loopback would need host networking or a
different upstream topology, with no benefit here. Import a required
host-only `/etc/caddy/internal-users.caddy` inside the auth block; restrict
it to root and the Caddy service identity. Generate bcrypt hashes on host
with `caddy hash-password`, which reads stdin without `--plaintext`;
never pass a password as an argument. The import inside `basic_auth`
was verified with Caddy 2.11.9.
Add, rotate, or revoke one entry per account; stage atomically, validate
with `caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile`,
then reload the host service through the elevated entry point (D10).
Caddy 2.11.9 validation returned 0 for valid config and 1 for invalid.
On validation/reload failure restore the
old file and confirm live policy. Never roll account data back with app
config. Refuse a missing or empty account fragment; do not serve an
unauthenticated fallback site.

**D3 — Authenticate before forwarding; set the robots header immediately.**
Use the plain site-wide `header X-Robots-Tag "noindex, nofollow"` before
`basic_auth`, realm `restricted`; never `defer`, `>`, or a literal route
with auth ahead of this header. The default 502 already retains the
header in Caddy 2.11.9; no custom error handler. Match exactly
`path /health /units /filters /openapi.json`; route these to API unchanged
and everything else to web. Query strings do not change path matching.
Strip `Authorization` on both proxy legs (`header_up -Authorization`).
On both legs use `header_down -X-Robots-Tag` to remove the upstream copy.
Neither service sets it today, but the front door must not depend on
that. The immediate `header` directive does not overwrite an upstream
value; downstream set/add can still duplicate it. Removing the upstream
copy leaves exactly one `X-Robots-Tag: noindex, nofollow` on proxied 200
and 500 responses, and the local 401 retains its one header (measured on
Caddy 2.11.9).
Keep default Caddy forwarding-header replacement for direct internet
clients, with no trusted inbound proxies in the deployed site. Disable
access logs and debug/credential logging; emit bounded operational events
without request credentials, raw headers, or auth usernames.

“Every response” means application responses on the HTTPS site, including
401s and proxy errors. Port 80 is ACME challenge handling and a fixed-host
HTTPS redirect only, never an auth challenge or an upstream. Use an
explicit `http://` redirect site with the plain robots header and
`permanent` (301, verified locally). ACME protocol responses on port 80
are outside the contract. No alternate application vhost, public
health exemption, or blanket `robots.txt` block. The live probe rules out
deferred and auth-first literal ordering; implementation checks actual
HTTPS, errors and the HTTP redirect, not only config adaptation.

**D4 — Trust one measured peer, keep the limiter keyed by IP.** Wire
optional `API_TRUST_PROXY` through `apps/api/src/server.ts` and the app
factory in `apps/api/src/app.ts` into Fastify `trustProxy`. Accept one
literal IP or CIDR string, reject empty/malformed input, lists, booleans,
hop counts and catch-all CIDRs. Unset leaves Fastify's default unchanged.
Deploy with a single address only, not the bridge subnet. The override
pins its default bridge to `10.203.40.0/24`, gateway `10.203.40.1`, and
sets `API_TRUST_PROXY=10.203.40.1` as the initial hypothesis. This avoids
Docker's stock pools. Bootstrap must confirm no overlap with configured
Docker pools/networks, host routes, or provider VPC ranges; stop and
review a different pin if there is overlap. Keep the same-origin CORS
allowlist empty and the deployed budget at 100 requests per 60 seconds.

Test that a trusted peer splits forwarded clients into different keys,
an untrusted peer ignores the header, and an unset option retains the
direct-peer budget even when headers differ. Do not special-case
usernames or trust all XFF. In `docs/api.md`: “`API_TRUST_PROXY` is unset
by default; set one proxy IP or CIDR only when that proxy controls the
forwarded client address used for rate limiting.” The runbook shows how
to send a controlled request through Caddy while observing TCP SYN
source addresses in the API container network namespace (`nsenter`
with `tcpdump -nn`, SYN-only filter for destination port 3000, no payload
or capture file). Ensure a fresh upstream connection, not a reused one.
If the actual peer differs, stop promotion, confirm the forwarding path
and revise the reviewed single-address pin (and IPAM if necessary).
Never broaden trust to make the gate pass. D13 proves the key split, not
the unverified Docker mechanism. Clients sharing an egress IP share a
budget, even with different accounts.

**D5 — Separate release jobs and trust boundaries.** Trigger on
`17 15 * * 1` UTC and `workflow_dispatch`. Guard every path, including
cleanup, record, and alert jobs, on `github.ref == 'refs/heads/main'`.
Use event `github.sha` as the immutable candidate and workflow revision;
no later HEAD lookup. Workflow concurrency group `internal-deployment`,
`cancel-in-progress: false`; a newer pending run can replace an older
pending run. Explicit workflow-level `permissions: {}`; job grants below
are exhaustive (`GITHUB_TOKEN` is implicit, not an environment secret).

| Job phase | Dependencies and outcome | Token grants | Mapped secrets |
| --- | --- | --- | --- |
| `plan` | Guard ref and validate dispatch inputs; no checkout or host access | `{}` | None |
| `checks` | `plan`; forward release only, exact checkout | `contents: read` | None |
| `publish` | `checks`; build, inventory, attest; emit candidate | `contents: read`, `packages: write`, `attestations: write`, `id-token: write` | None |
| `deploy_inspect` | `plan`, `publish`; read host state in D6 order; emit skip or eligible manifest | `{}` | `internal-deploy`: SSH key |
| `verify` | `deploy_inspect` eligible; verify both digests | `packages: read`, `attestations: read` | None |
| `deploy_pre_observe` | Verified target and existing stack; capture sample start state | `{}` | `internal-deploy`: SSH key |
| Pre-switch probe legs | `deploy_pre_observe`; record qualification only | `contents: read` | `internal-probe`: probe pairs |
| `deploy_switch` | Verified target and applicable pre-switch collection terminal; recheck state, switch, check readiness and sample start state | `{}` | `internal-deploy`: SSH key |
| Candidate probe legs | `deploy_switch` ready; A then B | `contents: read` | `internal-probe`: probe pairs |
| `deploy_candidate_observe` | Capture sample end state before other checks | `{}` | `internal-deploy`: SSH key |
| `candidate_browser` | Candidate evidence ready; scenario setup below; run browser and evidence scenarios | `contents: read` | `internal-probe`: pair A, test step only |
| `deploy_settle` | Consume candidate scenario verdict; promote or restore and capture restore sampling start state | `{}` | `internal-deploy`: SSH key |
| Restore probe legs | `deploy_settle` restored and ready; A then B | `contents: read` | `internal-probe`: probe pairs |
| `deploy_restore_observe` | Capture restore sample end state before other checks | `{}` | `internal-deploy`: SSH key |
| `restore_browser` | Restore evidence ready; scenario setup below; run browser and evidence scenarios | `contents: read` | `internal-probe`: pair A, test step only |
| `deploy_close` | Consume restore scenario verdict and close recovery | `{}` | `internal-deploy`: SSH key |
| `record` | All earlier jobs terminal; record skip/success/failure | `contents: write` | None |
| `alert` | Record attempted; notify on an unexpected failure | `issues: write` | None |
| Health workflow `health` | Scenario setup below; run `@health` only | `contents: read` | `internal-probe`: pair A, test step only |
| Health notification | Report failed/cancelled health job per D14 | `issues: write` | None |

Only the deploy sequence (`deploy_*`) talks to the host. Probe legs run
in the same workflow run on separate hosted VMs. Each job is a thin
wrapper over `apps/web/e2e-internal/probe.ts` with phase and leg inputs;
browser logic is shared with health. Only the three scenario jobs run
`bddgen` and the suite. In each, check out the pinned workflow SHA
without persisting checkout credentials, set up the exact Node/pnpm
pins, install the web workspace dev dependencies with the frozen
lockfile, and install locked Playwright Chromium only. Candidate and
restore also materialize the D13 evidence files before generation
and testing. Map probe credentials only into the test step that
uses them, never setup or generation. No suite process has an SSH
key. A/B and deploy jobs do not run the suite; deploy settlement and
close consume the scenario job's sanitized phase verdict. Neither
workflow grants `actions: write`.

`checks` requires a successful `plan` and a forward operation; `publish`
requires successful `checks`. `deploy_inspect` uses `if: always() && …`
with `needs.plan.result == 'success'` and either forward plus
`needs.publish.result == 'success'` or rollback plus an expected skipped
`publish`. `verify` requires a successful eligible `deploy_inspect`; it
is skipped for an unchanged release. Capture pre-switch start state in
`deploy_pre_observe` and end state as the first observation in
`deploy_switch`. `deploy_switch` requires successful verification and a
terminal pre-switch collection where applicable. Terminal means each
collector leg has completed, failed, or been explicitly skipped; a
failed leg is terminal without an evidence file and does not block the
switch. It does not require a qualification verdict.
`candidate_browser` evaluates qualification after the switch.
Recheck incumbent state under the host lock. Candidate/restore B
requires its corresponding A sample to be usable. End observations
follow the probe legs directly, even if they failed or were skipped;
browser checks follow the observations so they cannot affect sampling.
The settlement jobs use `if: always() && …` whenever their preceding
host operation may have mutated state, including readiness failures and
failed, cancelled or skipped probe legs. Missing probe outputs are
inconclusive, never green.

`record` uses `if: always() && …` and records each `needs.<id>.result`,
distinguishing expected skips from failures. `alert` uses
`if: always() && …` after recording; alert on unexpected failure,
cancellation, missing required outcome, non-green activation/restore,
or `needs.record.result != 'success'`. Advisory qualification alone
does not fail the release. Every condition includes the `main` guard.
The disposable non-main policy probe is limited to environment
references on its temporary ref per D20; it cannot enter this graph.
Host loss or full cancellation can prevent cleanup, so the pending
marker remains authoritative.

Both environments allow only `main`. Each job declaring an environment
can access all of that environment's secrets. `internal-deploy` owns
`INTERNAL_SSH_KEY` and host/key-pin variables; `internal-probe` owns
`INTERNAL_PROBE_{A,B}_{USERNAME,PASSWORD}`. Map only the relevant pair
to each probe leg; neither environment contains the other credential.
Public build input `INTERNAL_HOST` is a repository variable.
Do not persist checkout credentials, except scoped authentication for the
record push; never run branch data, PR code, or unreviewed payloads as
commands. All Action refs are full commit SHAs; explicitly version-pin
every pipeline tool (including setup runtimes, Docker CLI/Compose where
used, Buildx and BuildKit); do not rely on a mutable runner tool default.
The Playwright revision comes from the frozen lockfile. Verify supported
versions before implementation and record the exact pins.

Checks use frozen install, current fresh-checkout Paraglide generation,
`pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm arch:check`,
`pnpm test`, and `npx -y @fission-ai/openspec@1.16.0 validate --all --strict`;
retain the PR job's deterministic design, production build/flag and diagram
checks. Include `node scripts/check-internal-routes.mjs` in `pnpm test`
so PR and release CI both enforce exact route parity. The script spawns
`apps/api/test-support/internal-route-inventory.ts` in the API workspace.
This helper boots the real app factory with its test
data source. A test-only wrapper around the Fastify constructor delegates
to the real constructor and attaches `onRoute` before registration; no
production instrumentation. Compare unique concrete
GET/HEAD paths to the Caddy API `path` matcher parsed from the committed
template; exclude only auto-HEAD duplicates and the CORS `OPTIONS *`
registration, reject an unexpected app route/method or wildcard matcher.
The script consumes JSON from the helper, never imports across workspaces.
Pass the parity-checked paths for the exact selected template version to
the access probe. Retain that version's verified route list with the
activation metadata for rollback/restore; never substitute today's routes.
The `/units` smoke cannot detect a newly registered path by itself.

No PR-triggered or `workflow_run` promotion. Forward deploy selects the
compatible host-installed template version, and rollback uses the retained
version from its host record (D10). Browser tooling uses the guarded
release workflow SHA even when testing an older deployment.
Use a new dispatch or re-run all jobs for a retry; reject cross-attempt
promotion inputs from partial job re-runs.

**D6 — Check host state in deployment order.** Under the host lock,
first refuse a pending transaction; then compare the forward candidate
SHA with `current.json` and confirm it matches the running state. Return
an unchanged skip here, without inspecting template availability. Empty
state means first deploy only if no app stack exists; unreadable or
unreconciled activation state stops the run. An unhealthy incumbent
alone is not unreconciled state. A nonempty `rollback_release` selects
a recorded successful activation and does not use the unchanged shortcut.
`force_redeploy` is Boolean, default false; true bypasses only equality.
For a switch-required fault rehearsal, refuse an unchanged candidate
unless `force_redeploy` is explicitly true (D20). Do not silently skip
or bypass equality for that request.
Reject combining rollback and force.

Third, for a non-skipped operation, check target and previous template
eligibility (D10); missing target version blocks forward deployment or
rollback, never an unchanged skip. Only then verify the target digests,
finish any applicable pre-switch collection, and mutate. Check the expected
host state again under lock before mutation. Accept the cost of
building unchanged forward candidates before this sequence. A skip
never starts containers, updates current, or creates a changelog entry.

**D7 — Human-readable tags, digest identity.** Publish Linux amd64 to
`ghcr.io/<owner>/dc-reentry-unlocked-api` and
`ghcr.io/<owner>/dc-reentry-unlocked-web-internal` as private,
repository-linked packages. Use the stable version core in
`apps/web/package.json` for both: it already versions the evaluated
artifact; reject adding a version file/root version or chasing git tags.
Validate it as `MAJOR.MINOR.PATCH`. Tag
`<version>-internal.<yyyymmdd>.g<short-sha>.<run-id>.a<attempt>` from
UTC publish date, first seven candidate SHA hex characters, GitHub run
ID and attempt. Other workspace versions may drift without changing the
tag. Never overwrite tags; no aliases. Push the uniquely
tagged images and use the pushed digest output, not tag resolution, for
every subsequent scan, signature and deployment. Bake
`VITE_API_URL=https://<internal-host>` (no path). Set Docker build action
`provenance: mode=min` and `sbom: false` explicitly; reject public-repo
max defaults and a second implicit SBOM scanner.

**D8 — Sign in publish; verify on a clean runner before mutation.**
Use `actions/attest` twice per digest: default SLSA provenance and a
second invocation with `sbom-path` (CycloneDX JSON). Set the fully
qualified untagged subject name and the pushed subject digest. Store
attestations via GitHub's API; leave registry bundle push and storage
record creation off (`push-to-registry: false`, `create-storage-record:
false`), so no `artifact-metadata: write` is needed. Use the permissions
listed for `publish`; confirm the current releases at implementation and
pin the generic Action by SHA. Verified against the
[Action README](https://github.com/actions/attest) and
[GitHub CLI manual](https://cli.github.com/manual/gh_attestation_verify).

Run the following for each `IMAGE` (`package@sha256:...`) and for each
required predicate (`https://slsa.dev/provenance/v1` and
`https://cyclonedx.org/bom`; confirm the latter with the pinned Action):

```sh
gh attestation verify "oci://$IMAGE" --repo "$GITHUB_REPOSITORY" \
  --signer-workflow "$GITHUB_REPOSITORY/.github/workflows/release-internal.yml" \
  --source-ref refs/heads/main --source-digest "$SOURCE_SHA" \
  --predicate-type "$PREDICATE"
```

Authenticate to the registry with the verify job's read-only token.
`SOURCE_SHA` is the image's recorded source (candidate event SHA for new
builds, recorded build SHA for rollback), not the rollback dispatch SHA.
Do not print bundles. Missing digest, mismatched identity, or network
failure blocks mutation; the deploy sequence reads compatibility and
rollback metadata before verification. Rehearse with the pinned
versions: confirm `attestations: read` suffices, establish the accepted
`--source-digest` format, prove the intended source verifies and a wrong
source fails. Online verification on the runner avoids new
VM tooling and GitHub/Sigstore dependencies on the recovery path. An
automatic restore reuses the already-verified, host-retained last-good
state and cached images; it is not a way to authorize new artifacts.

**D9 — Check inventory coverage; report vulnerabilities, not a threshold.**
Install Syft and Grype from pinned upstream Linux release archives,
checking each against its published checksum and the reviewed stored
hash before executing. No unverified installer or `syft-action` URL.
Confirm the published Syft and Grype checksum filenames against each
pinned release and record the exact filenames and hashes in
`deploy/internal/tool-versions.json`.
Syft scans each pushed registry digest for one runtime `cyclonedx-json`;
validate coverage before attesting. Compare distro package name/version
inventory with the pinned runtime base's package database; for API also
compare expected production npm packages from the deployed dependency
tree (including Fastify, tsx, and shared workspace material). Establish
expectations independently of the Syft result; missing expected entries
fail coverage rather than silently updating the baseline.

Build a separate, labeled web-build inventory from the frozen web
workspace lockfile dependency closure at the same SHA, including
workspace dependencies and build inputs. Check coverage against that
closure and expected web stack packages; do not claim a bundled dependency
can be enumerated from runtime files or that all build inputs shipped.
Bind its report to the web digest and source SHA. Scan the two runtime
SBOMs and the separate build inventory with Grype (`grype sbom:<file>
-o json`) to reuse cataloging, not start another scanner service. Record
scanner and database versions/timestamp. Findings, or a scanner/database
failure explicitly recorded as unavailable, do not block promotion;
missing/invalid inventory, failed coverage, or attestation does. Upload
full inventories and raw vulnerability reports as temporary run/attempt
artifacts. Commit the sanitized findings themselves to history (D11). See
[Grype scan targets](https://oss.anchore.com/docs/guides/vulnerability/scan-targets/).

**D10 — Strict SSH, staged config, bounded activation.** Operator records
the independently verified host public key as the environment variable
`INTERNAL_SSH_KNOWN_HOSTS` (known_hosts line); use
`StrictHostKeyChecking=yes`, explicit known_hosts and key files,
`BatchMode=yes`, no agent forwarding. Never learn a pin during deploy.
Load key from `INTERNAL_SSH_KEY` into an ephemeral mode-0600 file and
remove on exit. Use an unprivileged SSH account with no Docker-group
membership. Restrict its key to a forced command (no interactive shell
or forwarding) and elevate only through a sudoers rule naming the fixed
root-owned release entry point, `internal-host.sh`, with no arbitrary
command arguments. Read the allowlisted request as data on stdin; do not
execute submitted text. The execution identity (root) owns the read-only
registry credential in its own config directory. The root-owned entry
point, running via its narrow sudoers rule, validates Caddy config and
runs `systemctl reload caddy` only on successful validation. The SSH
account cannot invoke the service manager directly.

The operator installs versioned, root-owned templates from a reviewed
checkout: base `compose.yaml`, deployment override and Caddyfile template.
Store side-by-side versions under `/etc/dc-reentry-internal/templates/`;
bind each version ID to the installed file checksums. Runtime mutation
passes only validated manifest values (digest pair, origin, release ID)
and allowlisted operation/transaction identifiers, never config files.
Carry the host's selection from `deploy_inspect` as an expected-state
precondition; recheck it at activation and record it in the manifest.
Require the exact configured origin and allowlisted digest-only package
refs. App releases can change
image code, not the access wall. Keep authenticator entries out of version
directories so a rollback cannot revive revoked accounts.

After the unchanged check, `deploy_inspect` compares the target version
(the reviewed bundle's checksum ID, or the rollback record's version)
with the host's installed and approved versions. If absent, stop with
“Install template version <id> from reviewed source; retry.” Runbook has
a human review, install, checksum and validation step. Before every
switch, also verify the previous template version, if any, remains
installed, eligible under current host policy, and restorable with its
retained digests and configuration. Recheck these conditions at switch.
Rollback and automatic restore both load the exact recorded version,
and both refuse it if missing, revoked, or incompatible. Retain old
versions for the rollback horizon; do not substitute a different version.

Render from local templates only; preserve loopback ports and healthchecks.
Validate merged `docker compose ... config` before activation. No
dependency on `!reset`; use it only if the pinned Compose supports it.
For files staged in one directory and fixed project name:

```sh
docker image pull "$API_IMAGE"
docker image pull "$WEB_IMAGE"
docker compose -p dc-reentry-unlocked -f compose.yaml \
  -f compose.internal.yaml up -d --no-build --pull never --wait --wait-timeout 240
```

Both pulls must finish before switching. Validate Caddy config before
reload; reload only on change, and whenever restoring different config.
Check exact 200s at `http://127.0.0.1:3000/health` (also check JSON
`status: ok`) and `http://127.0.0.1:5173/`, with bounded timeouts.
No token, raw Compose output, credential-bearing request, or raw remote
log in workflow output; return stage/result codes and safe diagnostics.
Reject building on the VM, deploying tags, or uploading config or shell.

**D11 — Host owns current state; branch owns the durable public record.**
Versioned JSON manifest: schema version, environment, release ID/tag,
source SHA, build run/attempt, operation run/attempt, UTC timestamps,
operation, prior last-good release ID, origin, platform, both fully
qualified digest refs, config source SHA and bundle hash, and per-gate
and recovery status. Include the host template version, not just config
checksum. Separate the immutable build identity from activation
attempt identity. No passwords, hashes, key material, or log dumps.
Store `/var/lib/dc-reentry-internal/current.json`, a transaction marker,
and `history/<run-id>.a<attempt>/` with immutable final records; retain
compatible secret-free config with successful image pairs. Update current
atomically only on green activation. History also distinguishes a
failed first activation or unverified restore from the most recent success.

Initialize orphan `internal-releases` with no workflows or source tree.
Store `records/<run-id>.a<attempt>/{manifest.json,summary.md,findings.json}`
plus root `CHANGELOG.md`. Key findings by image digest or explicit
web-build inventory ID linked to the web digest. Keep each finding's
package, version, vulnerability ID, severity and fix status; store scanner
and database versions and scan timestamp per target. Write `unavailable`
on scan failure (unknown metadata stays unknown, never a clean result).
Record axe counts by impact and rule IDs per candidate/restore phase,
including an explicit unavailable status on scan failure. Do not commit
raw results, traces or credential-bearing artifacts. Failed attempts
without images use a result record
with those fields absent, not invented digests. The `record` job fetches
the pinned source history separately, generates forward-release notes
with checksum-verified git-cliff 2.14.2 and `deploy/internal/cliff.toml`:

```sh
git-cliff --offline --no-exec --config deploy/internal/cliff.toml \
  "$PREVIOUS_SHA..$SOURCE_SHA" --output "$ENTRY"
```

First deployment baselines at the candidate's reachable history; equal
SHAs say “redeploy; no source changes”. Rollbacks get an activation note,
not a forward range. Do not read history files as executable config.
Commit as `github-actions[bot]`
(`41898282+github-actions[bot]@users.noreply.github.com`); verify these
constants at implementation and record them with the selected GitHub
tooling pins in `deploy/internal/tool-versions.json`. Push only
`HEAD:refs/heads/internal-releases`, never force. On non-fast-forward
fetch and regenerate against the new history tip, up to three attempts;
record IDs make repeats idempotent. Exhaustion alerts and leaves the host
truth intact; document backfill from host history. No GitHub Release,
deployment API lookup, or artifact retention as a substitute for either
store. Marker-bound rehearsal writes go only to the scoped rehearsal
history location (D20). See evidence “Changelog tooling” for rejected
generators.

**D12 — Restore on post-switch failure; manual rollback is digest reuse.**
The host script serializes mutations with a lock and a durable pending
transaction keyed by run/attempt. Save prior manifest and config before
any switch; keep prior images locally. Classify each gate as `success`,
`hard-failure` (confirmed contract violation), or `inconclusive`
(evidence unavailable or cannot distinguish failure from probe drift).
Neither non-green outcome promotes. Pre-switch qualification is advisory
(D13), not a mutation gate. After mutation, either
non-green readiness/probe outcome invokes automatic restore: reapply the
previous version and digests only if they still meet the same eligibility
rule as manual rollback (D10), check local readiness, re-run the same
external gate, and record both outcomes. Loss of eligibility between
switch and restore is a restore failure, not permission to bypass policy.

Stop a non-green first candidate and alert: no last-good exists. On
restore success leave last-good serving and alert on the failed candidate.
On a hard restore failure alert with the observed state; leave corrective
action to the operator. On an inconclusive restore gate keep the restored
last-good serving and alert “restore unverified”. Neither changes current
to the failed candidate. Do not stop the whole stack automatically when a
previous release exists. A lost runner can leave a pending marker; the
next release refuses before mutation until the operator reconciles the
active digests/config, rechecks, and closes the transaction using the
runbook. Reject overlapping/stale requests. No host transaction timer in
this change; a recovery watchdog is a possible later addition.

Manual `rollback_release` names a successful host activation ID, uses
its compatible config and digests, verifies them for its source SHA
before mutation, and passes normal readiness and external gates before
advancing current. Never rebuild historical source. Retain host-side
operator recovery of previously verified results without a GitHub
checkout; prefer local images and use registry digest pull when needed.
Reject mandatory manual intervention for normal smoke failures and
blue/green duplication on one small VM.

**D13 — One BDD gate and two network-isolation legs.** From `apps/web`,
with workspace binaries on PATH, run
`bddgen -c playwright.internal.config.ts && playwright test -c playwright.internal.config.ts`.
No `webServer`; one Chromium worker (reuse CI software GL), no
automatic retries, and a bounded timeout. Use origin-scoped
`httpCredentials`; use separate credential-free
contexts for denial tests and API request contexts for A/B rate probes.
Rate-probe contexts send credentials on the first request (`send:
always`), scoped to the internal origin.
Do not disable TLS verification, forward auth over redirects, or collect
traces/raw headers. Emit only sanitized assertion and axe data. The hard
smoke gate asserts only the stable deployment contract so current tooling
can gate older releases: disclosure, data roundtrip, robots header,
denial, and origin/client isolation. No exact dataset counts, UI layout,
or axe thresholds. Define every behavior below as an executable scenario.
Browser steps make observations directly; technical steps assert the
phase-bound evidence files below. Both release browser jobs select
`@release-browser` and `@release-evidence`; health selects only
`@health`. A browser scenario can also carry `@health`. Fail closed
on an empty mandatory selection. Settlement and recovery close read
the corresponding scenario verdict, not the evidence as a second
acceptance algorithm. A nonpassing mandatory scenario is non-green. Preserve the D12
hard-failure versus inconclusive distinction with safe outcome codes.
Incumbent evidence is evaluated separately and remains advisory.
**Evidence boundary.** Collectors write strict, sanitized JSON files
before the corresponding scenario job starts: A/B sample files from
the runner legs and an origin/process observation file from the end
observer. Use fixed relative paths under `internal-evidence/`.
File locator outputs carry only the path and SHA-256 of the file bytes,
never observations or inferred verdicts. Use pinned same-run artifact
upload/download solely to move these files across isolated runners;
download only predetermined names scoped to run, attempt, phase and
producer. Recompute hashes before parsing. Use the shortest supported
retention; only sanitized summaries enter durable history. For the host
log join, each leg also writes a separate phase-bound correlation file
containing only validated server-generated request IDs and their slots.
Transfer it with the same path-and-digest contract to the observer,
not to the suite. Never include those IDs in reports.

Validate the same schema and bindings at write and read:

- Every file has a schema version, allowed phase (`pre-switch`,
  `candidate`, `restore`), current numeric run ID and positive attempt,
  and candidate identity (full source SHA and exact API/web digest
  pair for the stack being sampled). Bind these to the expected
  release or incumbent from the workflow, not from the file itself.
- A/B files identify the leg and contain its ordered sample slots
  (three for A, one for B). Each slot records HTTP status, limit,
  remaining, server date and reset. Permit numeric HTTP status
  100–599, nonnegative integer counters/reset and a valid UTC
  server date, or `null` when observation is unavailable. Include
  transport lookup outcome (`not-run`, `unavailable`, `same`,
  `different`); it is diagnostic, not a gate.
- The observer file has origin-observed distinctness (`true`,
  `false`, or `null` if unavailable/ambiguous), and before/after API
  container identity, UTC start time and nonnegative restart count
  (validated opaque container ID and timestamp, or explicit `null`
  for unavailable fields). Never include addresses, credentials,
  raw headers or log lines. Reject extra fields.

Missing files, different run/attempt/phase/candidate, invalid schema
or digest mismatch fail closed; an unavailable sample cannot prove
acceptance. Collectors observe and record without applying acceptance
thresholds. Expected observations are assertions of scenarios only:

- Visible `role="note"` with “Prototype with synthetic data”; observe the
  application's actual same-origin `/units` GET, 200 with a nonempty
  `units` array and loaded results UI. A direct curl alone cannot prove
  the browser's baked URL and CSP.
- `candidate_browser` and `restore_browser` own full access acceptance.
  Probe every API path from the selected version's parity inventory,
  the web document, one actual static asset referenced by it, and an
  unknown path. On each unauthenticated response require 401, Basic
  challenge with realm `restricted`, no application content, and exactly
  one `X-Robots-Tag` header with value `noindex, nofollow`. Count raw
  field occurrences, not just the normalized value. With credentials,
  require 200 and the single header on existing paths; the unknown path
  must return its normal
  web not-found response with the header. Verify the header on a
  front-door-generated 502 in an isolated run of the selected template
  with a deliberately unavailable fixture upstream. Use test TLS trust
  and throwaway auth, not a fault injected into the live environment.
  Probe public TCP 3000 and 5173 on every advertised address without
  credentials. A successful connection fails; DNS or address lookup
  failure is inconclusive, not proof that either port is closed.
- A records three authenticated samples; B follows with one, using a
  separate account, once A's sample is usable. Usable means transport
  and schema validity only: A's evidence file exists, matches its
  digest, is bound to this run, attempt, phase and candidate, and
  parses against the strict schema. It does not mean A's counters
  were accepted. Only scenarios judge counters; neither collectors
  nor gate preconditions do. The isolation scenario asserts successful samples,
  limit 100, A remaining `limit−1 … limit−3`, B remaining `limit−1`,
  and B before the earliest reset of A's window, allowing for rounding.
  Missing or expired timing is inconclusive. Do not forge forwarding
  headers in these samples.
- In the host end-observation steps, join bounded API request logs
  to validated response IDs using `reqId`. The pinned Fastify request
  serializer logs resolved `request.ip` as `req.remoteAddress`. Compare
  the addresses for the sampled requests on the host, confirming A is
  consistent across its three samples. The scenario asserts distinct
  origin-observed addresses and a fresh B budget; one shared address
  cannot pass. Missing or ambiguous evidence is inconclusive.

- Public egress echo is optional diagnosis only: it can disagree with
  the API's view. For diagnostics, try a certificate-validated HTTPS
  echo and then one independent fallback, without internal credentials.
  Retain the answering provider and sanitized comparison, not raw
  addresses. Echo failure or equality never skips B or changes the
  gate result; the origin evidence is authoritative.
- The observer captures API container identity, start time and restart
  count immediately before and after each phase. The continuity scenario
  asserts all three are present and unchanged; otherwise evidence is
  inconclusive. The timing
  guard excludes a normal window reset; the host check excludes an
  in-memory reset from container restart or replacement between legs.
  Verify in rehearsal that API process exits end the container, so the
  container observations cover the limiter process's lifetime.
  Browser work follows the end observation. Cap each invocation at 20
  API requests per account; allow the full window to expire before
  resampling a runtime that could retain a prior phase's counters.
- With an incumbent, collect advisory evidence before switch and
  evaluate it in `candidate_browser` as an advisory-only selection,
  using the same evidence-step assertions. Record its outcome
  separately from the mandatory verdict without blocking switch or
  promotion.
  If no incumbent exists, record `not-applicable`. Whenever no browser
  evaluation occurred — a collector failed or was skipped, or the
  browser job did not run — the recorder emits `qualification not
  evaluated` as advisory. It never blocks the switch or counts as
  isolation evidence. After a switch or restore the corresponding
  scenarios alone decide the smoke verdict.
- Reuse the `e2e/a11y.spec.ts` page-ready and full-page axe scan logic
  with the existing dependency, but report counts and rule IDs by impact
  without assertions on findings in internal smoke. Runtime scan errors
  report “scan unavailable”; the existing PR a11y suite remains blocking.

**D14 — Daily authenticated health and explicit issue alert.** Schedule
`43 14 * * *` UTC, plus manual health dispatch, with the same `main`
guard and concurrency group as release. Generate from the same D13
config and execute only `@health` scenarios with Playwright `--grep`
matching the whole tag. Tag browser rendering/disclosure, same-origin
data, certificate-valid TLS, denial and ordinary robots checks,
including authenticated positive controls. Do not tag isolation,
public-port bypass, the isolated upstream-error rehearsal or release
accessibility. Health uses `contents:
read` and `internal-probe` (pair A); no SSH or package access. Use
`if: always() && …` for notification on `needs.health.result ==
'failure'` or `'cancelled'`, with the `main` guard and `issues: write`
only. Open or update one incident issue per failure class; on open or
reopen assign the primary recipient and mention both primary and
fallback (`INTERNAL_ALERT_LOGIN`, `INTERNAL_ALERT_FALLBACK_LOGIN`).
Use sanitized status and run link only; same mechanism for release
failures. Notification from a workflow-token issue mention is unverified:
human tests delivery to both recipients and their preferences before
enablement. Keep failures red even if delivery fails. Passwordless
uptime monitoring is the independent perimeter signal, not a fallback
app-health probe. The primary checks for missed runs; fallback covers
absence. Neither cron nor a 401 is an application SLA.

**D15 — Bootstrap by hand; install only repeatable operational tooling.**
`docs/internal-ops.md` has a provider-specific bootstrap subsection.
Operator provisions a Linux amd64 Lightsail instance (1 GB initially),
attaches static IPv4, and configures provider and host firewall for
22/80/443 only (key-only SSH, no direct root login; account for IPv6 if
enabled). Create identical DNS records for the chosen `civictechdc.org`
subdomain in NS1 and Squarespace Domains DNS; query every delegated
authoritative server and a public resolver before the first build or
certificate attempt. No wildcard DNS service or provider default URL.
Select Lightsail VM over Container Service because the managed edge
cannot guarantee the application's auth/header policy on all responses.

Document unattended security upgrades, deliberate revalidation of pinned
Docker Engine/Compose/Caddy, bounded Docker daemon log rotation, service
enablement, persistent Caddy state, and operator-only account management.
Install the host script and versioned templates from a reviewed
checkout, not a provisioning script. Bootstrap GHCR access via a dedicated
package reader with `read:packages`, using `docker login --password-stdin`;
persist it in the execution identity's restricted Docker config, never
under the release directory. Verify the SSH host key out of band.
Generate unique per-person evaluator passwords in the operator's password
manager and share them directly out of band through a secure password
share. No shared evaluator accounts, plaintext stored on the host, or
password handoff by repository, issue or workflow log. Store only bcrypt
hashes on the host. Keep CI probe accounts separate from evaluator accounts;
put their plaintext credentials only in the probe environment. Revoke by
removing the person's entry, validating and reloading (D2), then verify
their old credential is denied. Provision both GitHub environments, the
SSH key and probe pairs; confirm alert delivery.
Set Lightsail built-in status-check email alarms;
set HetrixTools to check HTTPS `/` with expected 401 and TLS expiry,
without a password. Verify delivery and note the provider's account
maintenance requirements. Keep scheduled workflow history on the
operator checklist to catch dropped runs that cannot alert themselves.

Use one lightweight timer for five-minute memory and disk samples. Prefer
existing bounded persistent Docker/system logs for restart and OOM
evidence if rehearsal proves they retain it through container replacement
and host reboot. Otherwise capture the missing restart/die/OOM evidence
with the same timer into bounded persistent logs (timestamp, service,
container ID, exit status); no custom observer daemon required. Restart
counters alone are not event history. Restrict logs and omit request data.
During a representative release switch, sample `MemAvailable` every
five seconds from before pulls through readiness and smoke. The 1 GB
host passes with at least 200 MiB available in every sample, no OOM or
unexpected restart, and no sustained swap growth. Otherwise resize and
repeat before scheduled enablement. Reject on-host heavy scan services,
cloud SDK coupling and provisioning automation.

**D16 — Pin all base/copy images in both Dockerfiles.** Keep readable
`node:22-slim@sha256:...` and
`ghcr.io/pnpm/pnpm:12.22.0@sha256:...` references (all `FROM` and external
`COPY --from`). Use digests supporting existing developer platforms as
well as amd64; run a monthly maintainer review and expedite security
refreshes. Resolve digests from upstream registries and update both
Dockerfiles with inventory expectations in one reviewed PR; rerun image,
gate and SBOM checks. Reject a mutable tag or adding a new dependency bot
in this change. Keep the pnpm version bump separate.

**D17 — Local tunnel always fronts local Caddy.** Document a loopback
HTTP listener `127.0.0.1:8080` with the same access wall and robots
rules, using local-only throwaway accounts, then
`cloudflared tunnel --url http://127.0.0.1:8080`. Get the assigned HTTPS
origin first, build web via `docker compose build --build-arg
VITE_API_URL=https://<tunnel-host> web`, and start at that URL behind Caddy.
Use a local-only Compose override if configuring the API peer: measure it
on the developer platform, never copy the VM pin. Default to the shared
100/min budget on this demo path; pace tests or deliberately adjust
`API_RATE_LIMIT_MAX` locally, never on the internal VM. Do not trust
incoming forwarding headers to obtain per-evaluator buckets in the tunnel.
Close the tunnel and remove throwaway accounts after use. Reject direct
upstream tunnels or reusing an image baked for a previous URL; no
availability or maximum-lifetime promise.

**D18 — Protect privileged surfaces before enabling the lane.** Treat the
workflows and the deployment scripts/templates they run like the
security-sensitive surfaces in `AGENTS.md`. Human review checks job
scopes, action/tool pins, command interpolation, record-only branch push,
host inputs, gate failures, and redaction. `contents: write` is
repository-wide; an unprotected `main` and a narrow push refspec are not
a security boundary. Use this control ladder:

1. **Required:** target `main` with an active repository ruleset
   restricting updates; allow maintainer bypass but exclude GitHub
   Actions from the bypass list. Before enabling schedules, human
   rehearses a real ref update: a workflow push with `GITHUB_TOKEN`
   must be rejected by the rule and the maintainer's own push must pass.
   Day to day: maintainer direct pushes still work; workflow writes only
   the records branch.
2. **Recommended, not required:** full PR review and required checks
   with no direct pushes; adopt only with explicit maintainer approval.
   Day to day: changes to `main` must go through PRs, even for maintainer.
3. **Rejected unless approved:** separate records repository with a
   repository-scoped writer, requiring a new credential.
   Day to day: records live elsewhere and the operator rotates that key.

**D19 — Both prerequisites are hard gates.** Implementation and first
deploy wait for `static-asset-headers` and `api-restart-under-load` to land.
Inherit the landed Compose and image baseline, never freeze today's
pre-investigation settings. Leave a web-handler config seam for inherited
static asset headers if that prerequisite picks the proxy; do not choose
its mechanism here or let it alter the top-level auth/header order.
Reject shipping first with retries or missing asset headers as a stopgap.

**D20 — Rehearse the same graph with bounded, opt-in faults.** A control
requires manual dispatch from `main` and a root-owned run marker naming
this run ID, attempt, and requested fault/control. The rehearsal venue
flag is separate from this per-run binding. On a rehearsal-flagged host,
the first host contact is admission, before inspection or authorization.
The host script waits up to ten minutes for the exact run marker. The
maintainer dispatches, reads the run ID and attempt, writes the marker,
and the run proceeds. Only after admission succeeds can the host
authorize a control. Admission timeout returns sanitized
`rejected fault dispatch` with no mutation. An unmarked host skips
admission entirely: no wait or change to ordinary behavior. It rejects
any requested fault immediately.

Allow one enumerated fault per manual `main` dispatch:
`candidate-readiness`, `first-candidate-smoke`, `provenance`, or `sbom`.
`plan` validates syntax only. The host entry point reads and validates
the marker before mutation. Pass only its allowlisted binding fields
over pinned SSH in same-run deploy outputs. The writer checks those
fields itself against the dispatch event, ref, run, attempt and
control, not an authorization Boolean. Run the same writer check in
read-only rehearsal preflight before any switch and repeat it in
`record` before any push, using binding fields reread by the
deploy-side entry point immediately before recording. The writer gets
no SSH secret. Reject a
failed check with the same sanitized disposition. The host rereads
the binding before fault effects. Keep the marker unchanged until
the run drains; remove it before activation on the real target.
Require an empty incumbent for first-candidate smoke. D6 still
applies: refuse a switch-required fault on an unchanged candidate
unless `force_redeploy` is set. Never imply force from a fault input.
Do not modify registry evidence or bypass a gate.

The maintainer induces each hosted case below. Implementer and reviewer
inspect only sanitized evidence. Only after marker authorization, the
host script waits at a named checkpoint for up to 120 seconds for a
root-owned go-marker naming this run, attempt, and checkpoint. The
same SSH-side job resumes; its downstream probe stays separate. Where
a hold falls between A and B, use a thin host-only checkpoint job
in the same run with the existing deploy environment. Do not use
environment approvals, another environment, or a separate workflow.
Use the hold only to apply a pre-staged, validated change and release
the job, never to generate hashes or troubleshoot. Apply edits
atomically with restore-on-failure, as for the account file. Bad
binding or timeout produces a sanitized checkpoint failure and stops
the workflow's next action; it never undoes an operator edit. Before
another phase starts, including any restore or recheck that depends on
the edited configuration, verify cleanup restored the prior rehearsal
configuration. If cleanup is unverified, leave the attempt pending for
reconciliation. After restore, report recovery unverified and alert
when the hold fails. Between
sampling legs, the 60-second sampling deadline applies independently
of any hold. Record a binding/hold or process continuity failure
separately from elapsed limiter-window evidence.

Mark hosted rehearsal evidence and exclude it from evaluator changelog
ranges. Use rehearsal-only probe accounts, marker-bound alert-target
overrides (never edit production variables), and rehearsal-only history.
Use the local stale-write fixture and deny append only at the rehearsal
history location; never induce failure on the production history ref.
After every configuration-changing case, verify production config is
intact and restore rehearsal credentials before a phase needs them.
Before account edits, pin changes, restarts, cancellations, or
history-policy changes, the maintainer checks the rehearsal hostname
and marker presence. The marker cannot prevent or redirect these
operator actions. End each host- or repository-config-changing block
with verified cleanup evidence before real activation.

| Case | Maintainer control | Sanitized assertion |
| --- | --- | --- |
| Bootstrap and measured peer | Start private validation stack with rehearsal accounts after DNS, certificate and credential preflights; send a controlled request through the front door, then remove the validation stack | Peer matches exact pin, both accounts work, external origin ports are closed; rehearsal starts without a current manifest or running stack |
| Repository rule and history scope | In the reviewed history writer context run a controlled real update attempt against `main` and a normal history write; perform the authorized maintainer update separately | Workflow-token update rejected by the rule, history write succeeds, maintainer update allowed |
| Environment rejection | Use the reviewed disposable D5 ref described below | Both requests denied; review proves the ref cannot use credentials; ref deleted |
| Registry-only verify, then live negative | Select marker-bound registry-only mode. For each fault use a known absent predicate for just one required check; keep other checks real | Verify then record `rehearsal only — no switch`, with no hold. Later repeat each negative with an incumbent: serving pair unchanged |
| Candidate readiness and empty-host smoke | Dispatch the same authorized fault. Fail readiness after activation at its own gate, or make the mandatory candidate disclosure scenario fail after real readiness on an empty host | Actual Gherkin failure stops both new instances with no restore claim; readiness failure enters restore with a prior pair; positive verify precedes either start |
| Green last-good seed | Wipe rehearsal state and dispatch without a fault; reseed as needed between cases | Readiness, access and isolation pass before current advances; record names exact digests and template |
| Candidate smoke with incumbent | At `before-candidate-browser`, rotate its rehearsal credential; resume `deploy_candidate_observe`, then browser. At `before-restore`, reinstate the credential; resume `deploy_settle` | Candidate fails; prior pair is restored and passes recheck |
| Restore evidence unavailable or hard failure | At `before-restore-b`, rotate B's rehearsal credential; resume `deploy_hold_restore_b`, then B. At `before-restore-browser`, reinstate it for the inconclusive case or rotate the browser account for the hard case; resume `deploy_restore_observe`, then browser | Missing B origin evidence reports “restore unverified”; confirmed browser denial is a hard restore failure and alerts |
| Incorrect trust / forwarded claim / shared budget | Install a reviewed rehearsal variant with a wrong single-peer pin; restore it afterwards. Separately, from a controlled client send a test forwarding claim and exhaust a fresh window through the front door with two rehearsal accounts at one address | Wrong pin is non-green; the client-supplied claim does not change the bucket; the next request from either account receives 429 |
| Restart during isolation | At `before-candidate-b`, restart API after A; resume `deploy_hold_candidate_b`, then B | Changed process is inconclusive even with a fresh B budget; expiry is separate |
| Shared runner egress | Observed only; do not claim deterministic induction | Equal origin addresses never pass; no raw addresses retained. Cover equality and expired windows with local fixtures |
| Compatible or rejected rollback | At `before-rollback-switch`, confirm both versions or revoke the inactive target; resume `deploy_switch`, which rechecks eligibility | Reuse exact recorded version/digests, or refuse before switch |
| Cancellation and backfill | Cancel `deploy_switch` at `after-switch-pending` without releasing the hold; retry, then reconcile via host entry point | Retry refuses mutation; one finalized cancelled-attempt record |
| History conflict or outage | Use a local stale-write fixture for retry, and deny appends only at the marker-bound rehearsal history location | Retry without overwrite; failed publication leaves backfillable host evidence |
| Alert posting failure | Use a marker-bound no-switch alert check in the release `alert` job. First use the designated rehearsal recipients, then an invalid rehearsal override | Test reaches both recipients; invalid override gives a visible sanitized posting error, red run and no delivery claim. No stack or production variable changes |
| Perimeter and restart evidence | Send test notifications from the monitor and host alarm; replace and reboot the private validation stack or its host during evidence checks | HTTPS 401 is healthy with no monitor password; test notifications arrive and bounded samples and restart/OOM evidence survive the lifecycle check |

For the branch-rule exercise, allow the existing `record` job to
attempt one reviewed, harmless ref update only after host authorization;
use the existing `contents: write` token and no bypass. Its successful
test write targets rehearsal history. Separately, the D5 branch-policy
check uses a reviewed disposable non-main ref whose workflow only
references both environments: no checkout, no secret mapped to any
step, no publication, and no host action. Review proves those exact
limits before dispatch; delete the ref afterward. It cannot request
faults or change the normal `main` workflow.

**D21 — Executed Gherkin is the behavior gate.** Use the existing pinned
`playwright-bdd` 9.2.1 and `bddgen`; add no dependency. Mirror the house
feature pattern: title and description cite `internal-deployment`,
scenarios use behavior language, and internal `steps/bdd.ts` binds
`Given`, `When` and `Then` through `createBdd`. Start with one feature
file; split only for readability. No remote feature or step lives in
`apps/web/e2e/`, and existing local and PR CI discovery stays unchanged.
No parallel plain Playwright behavior specs. Step definitions own
browser mechanics and assertions; collectors supply observations, not a
substitute promotion gate. Isolation scenarios cover both legs, timing
and counters, process identity and origin-observed distinctness.
Feature text, generated test names and reports contain no runtime
addresses, credentials, raw headers or log lines.

Tag each scenario directly with at least one `@req:<slug>`. In
`scripts/check-internal-bdd-coverage.mjs`, wired into `pnpm test`, use
Node built-ins only. Resolve paths from the repository root: while
`openspec/changes/deployment-internal-lane/` exists, read its
`specs/internal-deployment/spec.md` delta and fail if it is missing.
After archive, read `openspec/specs/internal-deployment/spec.md`.
For each `### Requirement:` heading take the heading text, lowercase,
replace each non-alphanumeric run (`[^a-z0-9]+`) with one hyphen, and
trim hyphens. Reject slug collisions.

Parse only the scenario's own contiguous tag lines immediately above
`Scenario:` or `Scenario Outline:`. Ignore comments, prose and inherited
feature tags. Every valid requirement tag on a multi-tag scenario counts;
unknown requirement tags fail even outside the release selection.
A tagged `Scenario Outline` with no executable examples earns no
coverage and fails the check with a message naming the outline.
Coverage counts only if the candidate or restore gate selects the
scenario via `@release-browser` or `@release-evidence`; `@health` alone
does not count. Each heading must be covered or explicitly excluded,
never both or neither; reject stale exclusions and untagged scenarios.

Gate-observable: Authenticated access, Crawler exclusion header,
No upstream bypass, Same-origin route parity, Client-address rate
limits, Bounded proxy trust, Last-good promotion gate, and Report-only
accessibility results. Mixed requirements earn **partial** gate
evidence only. Keep deterministic route parity, API peer tests,
promotion ordering, and durable accessibility report checks for the
parts not observed by the scenarios.

Excluded from the browser gate; verified by the named host or
workflow check:

| Requirement | Verification |
| --- | --- |
| Default-branch release cadence | Trigger/ref guard and pinned-SHA checks rehearsal |
| Immutable release identity | Publish tag/digest and rerun evidence |
| Durable deployment traceability | Host/state and history cancellation/backfill rehearsal |
| Verified attestations before image start | Registry verification and before-start ordering/negative rehearsals |
| Signed inventory and coverage | Publish SBOM signature and missing-package coverage checks |
| Nonblocking vulnerability reporting | Publish scanner failure fixture and durable findings inspection |
| Changelog without default-branch writes | Record history/range check and repository ruleset rehearsal |
| Skip unchanged candidates | Host inspect equality and force fixtures |
| Automatic restore after a failed switch | Deployment settlement and restore rehearsals |
| Manual digest rollback | Recorded-digest/template rollback rehearsal |
| Scheduled health alerts | Health trigger, incident failure and recipient delivery checks |
| Credential confinement | Environment policy, host account/forwarding and artifact redaction checks |

D20 admission, fault induction and recovery are unchanged. The
authorized first-candidate smoke fault drives the actual mandatory
disclosure scenario red; the runner exports the real test outcome,
never a synthetic or substituted job result. Readiness and attestation
faults fail only at their own gates.

Rejected: plain Playwright specs, which lack the readable feature and
requirement traceability; `@cucumber/cucumber`, a second implementation
against the pinned single-tool policy; documentation-only Gherkin,
which cannot enforce release behavior.

## Risks / Trade-offs

- [Repository token defaults to read/write] → explicit denies/default
  grants and a per-job matrix; no persistent push token outside record.
- [Unprotected `main` + `contents: write` can rewrite trusted automation]
  → require targeted workflow-token rejection before enabling; see D18.
- [Wrong proxy trust pin or shared probe egress] → record advisory
  qualification before the switch; restore on non-green proof after it.
  Diagnose the peer without broadening trust or treating accounts as keys.
- [Two DNS providers can disagree] → change both and verify every
  authority before build, ACME validation or DNS migration.
- [CA rate limits / first-boot certificate failure] → use owned DNS,
  confirm 80/443 and DNS first, preserve ACME state, use staging in
  rehearsals, stop repeat issuance attempts on failure. No HTTP app or
  TLS-validation bypass as fallback.
- [GitHub delays/drops or disables scheduled runs] → off-hour-minute
  scheduling, operator checks for missing runs, manual dispatch, and
  independent passwordless perimeter monitor. Pending runs are not FIFO.
- [1 GB has limited burst headroom] → observe overlap, disk and OOM
  evidence; resize if headroom is thin. No building or scanning on VM.
- [Registry retention can break rollback] → exclude current and retained
  successful digests from cleanup; retain their configs and keep at
  least current and previous pairs cached. Check availability before
  mutation and rehearse recovery. Public history can outlast artifacts.
- [Single-host switch may briefly interrupt service] → keep old pair
  through pull and validation, use bounded waits/restore, do not claim
  atomic switch. Alert on failed restore or stale transaction.
- [Online verify or history push can fail independently] → verification
  blocks mutation; a history push failure alerts without reverting a
  verified healthy deploy. Reconcile records from host evidence.

## Migration Plan

1. **Human verification:** verify both prerequisite changes landed and
   authorize implementation against that baseline. Deliver proxy/rate-limit
   tests and exact Compose/Caddy topology first; validate merged config
   and access-wall behavior without altering the local boot.
2. Add pinned image builds, inventory, attestations and runner verification.
   **Human preflight:** confirm exact Docker Compose and Caddy versions
   can render, validate, boot and reload the host templates, without
   a local image build. Confirm exact `gh` and attestation Action
   compatibility, predicate types, read scope and source digest format.
   Require positive and negative verification tests: intended digest
   pair passes; wrong repo/workflow/ref/source SHA or missing signature
   fails before mutation. Record checked releases, checksums and identity
   in `deploy/internal/tool-versions.json`.
3. Wire host transaction, reports and probe phases. **Human verification:**
   measure the API socket peer with a controlled request through the
   target topology before first promotion (use a private rehearsal).
   Confirm the pin or stop for correction. Rehearse wrong pin, shared
   egress, reset between legs, origin bypass detection, hard failure,
   inconclusive restore, lost runner, and rollback across installed
   template versions. Verify alert delivery and record redaction.
4. **Human verification:** review privileged surfaces and rehearse `main`
   ruleset rejection and maintainer push. Bootstrap VM and history
   branch; confirm SSH pin, both DNS authorities, certificate, accounts,
   installed template version and alert recipients. Manually dispatch
   first release from `main`; no last-good means a failed switch stops
   the candidate. Verify headroom against D15 during a representative
   switch, durable findings and restart evidence, isolation, and public
   401 monitoring before handoff or enabling schedules.
5. Update `docs/deployment.md` to replace the old hostname open item,
   tag/alias policy, no-app-change claim, unspecified Caddy placement,
   manual-only restore, and tentative monitoring/notes with the dated
   internal-lane decisions. Include `API_RATE_LIMIT_MAX` and its default.
   Add the proxy setting to `docs/api.md`; link `docs/internal-ops.md`
   from `docs/runbook.md` for bootstrap, diagnosis, tunnel, health,
   registry retention, restore, and manual rollback. Keep the production
   section future-facing; no production provisioning.

## Open Questions

- Hostname label, evaluator list, and alert recipient: operator supplies
  at bootstrap; first build waits for DNS.
- Is 1 GB adequate? Measure under representative load and switch overlap.
- Does the API see the pinned peer on this VM? Measure and prove it with
  the rate-limit gate before first promotion; revise only the exact pin
  in reviewed config if necessary.
