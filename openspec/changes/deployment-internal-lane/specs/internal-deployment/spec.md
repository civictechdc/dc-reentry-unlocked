# Spec Delta

## Purpose

Defines how the team releases and evaluates the internal prototype at a
protected origin, with verifiable images, durable release evidence, and
recovery when a candidate fails.

## ADDED Requirements

### Requirement: Authenticated access

The front door SHALL require valid credentials on every path of the
internal HTTPS site and return HTTP 401 without application content to
requests without valid credentials.

#### Scenario: Every protected path denies and discourages indexing

- **WHEN** a client without credentials requests every registered API
  path, the web document, a real static asset referenced by that
  document, and an unknown path on the internal HTTPS site
- **THEN** each response is HTTP 401 with an HTTP Basic authentication
  challenge, contains no application content, and carries exactly one
  `X-Robots-Tag` header with value `noindex, nofollow` on that response

#### Scenario: Invalid or revoked credentials

- **WHEN** a client supplies incorrect credentials or credentials for a
  revoked account
- **THEN** the front door returns HTTP 401 without application content

### Requirement: Crawler exclusion header

Every application response on the HTTPS site and the HTTP-to-HTTPS
redirect SHALL carry exactly one `X-Robots-Tag` header with value
`noindex, nofollow`. Certificate-validation protocol responses on the
HTTP port are outside this contract.

#### Scenario: Successful, denied, and error responses

- **WHEN** the front door serves HTML, a static asset, API JSON, an
  authentication denial, or an upstream or front-door error on HTTPS
- **THEN** the response carries exactly one `X-Robots-Tag` header with
  value `noindex, nofollow`

#### Scenario: Upstream supplies its own robots header

- **WHEN** either upstream supplies its own `X-Robots-Tag` on a proxied
  HTTP 200 or 500 response
- **THEN** the client receives exactly one `X-Robots-Tag` header, with
  value `noindex, nofollow`, regardless of the upstream value

#### Scenario: Authenticated positive controls

- **WHEN** a client with valid credentials requests the same web
  document, real static asset, registered API paths, and unknown path
- **THEN** on a healthy deployment each existing path returns HTTP 200
  with exactly one `X-Robots-Tag` header with value `noindex, nofollow`
- **AND** the unknown path reaches the web app and returns its normal
  not-found response, not a 401, with that same single header

#### Scenario: Front door generates an error response

- **WHEN** an authenticated request reaches the HTTPS front door but its
  upstream is unavailable and the front door generates an error response
- **THEN** the error response carries exactly one `X-Robots-Tag` header
  with value `noindex, nofollow`

#### Scenario: HTTP navigation

- **WHEN** a client requests an application path over HTTP
- **THEN** it receives a redirect to the internal HTTPS origin with
  exactly one `X-Robots-Tag` header with value `noindex, nofollow`, not a
  challenge or application content

### Requirement: No upstream bypass

The application's upstream ports SHALL be unreachable from outside the
host, independently of the front door's access policy.

#### Scenario: Direct connection to upstream ports

- **WHEN** an external client attempts to connect directly to either the
  web or API upstream port on any public address of the host
- **THEN** no connection to either upstream succeeds

#### Scenario: External address cannot be determined

- **WHEN** DNS or public address lookup fails during the bypass check
- **THEN** the result is inconclusive, not evidence that either port
  is closed

### Requirement: Same-origin route parity

The front door SHALL serve each registered API route at its real root
path on the internal origin and route all other paths to the web app.
Route parity SHALL be checked before a candidate is deployed.

#### Scenario: Web and API share an origin

- **WHEN** an authenticated client requests `/health`, `/units`,
  `/filters`, or `/openapi.json` on the internal origin, with or without
  a query string
- **THEN** the API handles the request at that path without a prefix or
  origin change

#### Scenario: Similar path is not an API route

- **WHEN** an authenticated client requests `/units/example`, which is
  not a registered API route
- **THEN** the web app handles the request

#### Scenario: Registered routes diverge from front-door routing

- **WHEN** a candidate registers a real API route with no matching path
  in the template version selected for activation, while `/units` still
  works, or that template routes a path not registered by the API
- **THEN** the parity check fails before deployment

#### Scenario: Candidate and selected template agree

- **WHEN** the API's registered paths exactly match the API paths in
  the template version selected for activation
- **THEN** the parity check passes using that version, not a separate
  fixture

### Requirement: Client-address rate limits

The deployed API SHALL enforce one budget of 100 requests per 60 seconds
per client address behind the front door. Evaluator and probe accounts
SHALL supply credentials only, never rate-limit bucket identities.

#### Scenario: Distinct addresses have independent budgets

- **WHEN** authenticated clients at different addresses start with fresh
  budgets and one client makes several API requests within a window
- **THEN** its `x-ratelimit-remaining` decreases without reducing the
  other client's remaining budget

#### Scenario: Multiple accounts share one address

- **WHEN** two authenticated clients using different accounts make a
  combined 100 API requests from one address in a fresh window
- **THEN** the requests consume one shared budget, and further requests
  from either account at that address receive HTTP 429 in that window

### Requirement: Bounded proxy trust

The API SHALL use a forwarded client address only when the immediate
peer matches the configured proxy address. With no proxy configured, the
API SHALL retain its direct-peer behavior.

#### Scenario: Request from the configured proxy

- **WHEN** the API receives a request with a forwarded client address
  from the configured proxy
- **THEN** the forwarded client address determines the rate-limit budget

#### Scenario: Untrusted or unconfigured peer

- **WHEN** a request claims a different client address but the immediate
  peer does not match the configured proxy, or no proxy is configured
- **THEN** the API ignores the claim and uses the immediate peer address

#### Scenario: Client supplies its own forwarding header

- **WHEN** an external client sends a forged client-address header through
  the front door
- **THEN** the forged value does not determine the API budget

### Requirement: Default-branch release cadence

The release workflow SHALL run on a weekly schedule and accept manual
dispatch from the default branch (`main`) only. For a new release it
SHALL rerun the deterministic repository gates on the exact selected
candidate commit before deployment.

#### Scenario: Candidate remains fixed throughout the run

- **WHEN** the weekly run or an authorized manual dispatch selects a
  candidate from the default branch (`main`)
- **THEN** the gates and release build use that commit even if the
  default branch advances during the run

#### Scenario: Dispatch from another ref

- **WHEN** a release is manually requested from a non-default branch or tag
- **THEN** the workflow does not publish or deploy it

#### Scenario: Candidate fails a deterministic gate

- **WHEN** a deterministic gate fails on the selected candidate
- **THEN** the run fails without deploying that candidate or substituting
  another commit, and any existing release remains serving

### Requirement: Immutable release identity

Both images SHALL use the same unique tag
`<version>-internal.<yyyymmdd>.g<short-sha>.<run-id>.a<attempt>`, with the
web workspace's declared version as the sole version source. The
workflow SHALL NOT overwrite a tag or publish a mutable alias.
Deployments and rollbacks SHALL reference image digests only.

#### Scenario: Build and rerun tags

- **WHEN** the registry receives both images for a release build
- **THEN** both tags encode the same web workspace version, UTC publish
  date, first seven commit hex characters, run ID, and attempt number
- **AND** a rerun uses a different tag, even if another workspace's
  version differs from the web workspace's version

#### Scenario: Activation selects images

- **WHEN** a deployment or rollback selects its image pair
- **THEN** it selects the exact recorded registry digests, never an
  alias or tag that could resolve to different images

### Requirement: Durable deployment traceability

The release workflow SHALL retain a record for each deployment attempt
beyond workflow log retention, identifying the source commit, both
image digests when available, run and attempt, configuration reference,
and gate results or an explicit reason they were not reached. If history
publication is interrupted after a host attempt begins, the host record
SHALL remain pending evidence until reconciliation and backfill.

#### Scenario: Inspect a completed attempt after log expiry

- **WHEN** an operator looks up a deployment attempt by run and attempt
  after the workflow logs expire
- **THEN** the release history identifies its commit, image pair,
  compatible configuration, gate results, and activation outcome

#### Scenario: Attempt fails before image publication

- **WHEN** an attempt fails before one or both digests are available
- **THEN** the record identifies the failure and leaves unavailable
  digests unset rather than substituting a previous digest

#### Scenario: Pending host evidence is reconciled

- **WHEN** a run is cancelled after the host attempt begins, or the
  history write fails after the host records an outcome
- **THEN** the host evidence remains identifiable by run and attempt
  as pending reconciliation or publication, not as a finalized history
  record
- **AND** the next run or an operator reconciles the attempt against the
  host evidence and backfills one finalized record with the observed
  outcome rather than assuming success

### Requirement: Verified attestations before image start

Before a deployment or manual rollback starts either image, the release
workflow SHALL verify both images' provenance and software bill of
materials (SBOM) attestations for the exact digests and source commit.
Both attestations SHALL identify the release workflow on the default
branch (`main`) as signer. Automatic restore SHALL reuse an image pair
already verified and recorded as last-good.

#### Scenario: Both attestations verify before either selected image starts

- **WHEN** both exact image digests have valid provenance and SBOM
  attestations for the expected workflow, branch, and source commit and
  all other pre-switch conditions pass
- **THEN** the workflow verifies both attestation kinds for both
  digests, then starts both selected containers at those exact digests
- **AND** any previously serving pair remains untouched until
  verification completes

#### Scenario: Provenance is invalid for one image

- **WHEN** both SBOM attestations and the other image's provenance are
  valid but one image's provenance is missing, invalid, or mismatched
- **THEN** neither new container starts and the serving pair is unchanged

#### Scenario: SBOM attestation is invalid for one image

- **WHEN** both provenance attestations and the other image's SBOM
  attestation are valid but one image's SBOM attestation is missing,
  invalid, or mismatched
- **THEN** neither new container starts and the serving pair is unchanged

### Requirement: Signed inventory and coverage

Each published image digest SHALL have an SBOM from a pinned scanner,
signed against that digest. The release SHALL fail if a required
inventory is missing or omits an expected package.

#### Scenario: Complete runtime and web-build inventories

- **WHEN** both images are published
- **THEN** each signed runtime SBOM includes expected base operating
  system packages, the API SBOM includes expected runtime application
  packages, and a separate web-build inventory identifies expected build
  dependencies and is linked to the web digest

#### Scenario: Expected package is missing

- **WHEN** coverage validation finds an expected package missing from
  its required inventory
- **THEN** the release fails before deployment

### Requirement: Nonblocking vulnerability reporting

The release history SHALL retain sanitized vulnerability findings keyed
to each image digest or identified build inventory. Findings and scan
unavailability SHALL NOT block promotion when required gates pass.

#### Scenario: Scan returns findings

- **WHEN** a vulnerability scan returns findings
- **THEN** the durable report includes the package, version, vulnerability
  ID, severity, and fix status, with scanner and database versions and
  scan timestamp for the target
- **AND** the findings do not prevent an otherwise passing promotion

#### Scenario: Scanner or database is unavailable

- **WHEN** the vulnerability scan cannot complete
- **THEN** its report is marked `unavailable`, never “no findings,” and
  states any known scanner and database versions and timestamp

### Requirement: Changelog without default-branch writes

The release workflow SHALL add one changelog entry to the release history
for each successful forward release. Rollbacks and restores SHALL get
an activation note, not a forward-range entry. An enforced repository
rule SHALL prevent the workflow from modifying the default branch (`main`).

#### Scenario: Release advances the deployed commit

- **WHEN** a successful forward release changes the last-good commit
- **THEN** the changelog entry covers the commits from the previously
  deployed commit to the new commit and the workflow leaves the default
  branch (`main`) unchanged

#### Scenario: First release or successful redeploy

- **WHEN** the first forward release succeeds or an explicit redeploy
  succeeds without changing the source commit
- **THEN** the first entry covers reachable history, or the redeploy
  entry states there were no source changes, respectively

#### Scenario: Recovery activation is not a forward release

- **WHEN** a manual rollback or automatic restore activates a recorded
  release
- **THEN** the history adds an activation note without adding a
  forward-range changelog entry

#### Scenario: Workflow cannot update the default branch

- **WHEN** the workflow token writes an authorized release-history
  record and a controlled rehearsal attempts an actual update to the
  default branch (`main`) with that token
- **THEN** the history write succeeds and the default-branch update is
  rejected by the enforced rule

### Requirement: Skip unchanged candidates

The release workflow SHALL skip deployment and omit a changelog entry
when the candidate commit matches the last successful deployment,
unless an explicit redeploy is requested.

#### Scenario: Candidate matches the last successful commit

- **WHEN** the candidate matches the commit of the release serving as
  last-good and redeploy was not requested
- **THEN** the workflow records a skip, starts no new application
  instances, and adds no changelog entry

#### Scenario: Explicit redeploy on the same commit

- **WHEN** an operator explicitly requests redeploy of the unchanged commit
- **THEN** commit equality does not block a new deployment attempt or
  bypass any verification or promotion gate

### Requirement: Last-good promotion gate

A switched release SHALL become last-good only after readiness and the
external smoke gate pass. The smoke gate SHALL check the stable
deployment contract in a real browser and at the public network boundary.

#### Scenario: Candidate passes the browser and access checks

- **WHEN** the candidate is ready after the switch
- **THEN** a real authenticated browser shows the synthetic-data
  disclosure and completes the app's same-origin `/units` roundtrip with
  nonempty data; web, API, and unauthenticated HTTP 401 responses each
  carry exactly one `X-Robots-Tag` header with value `noindex, nofollow`;
  requests without credentials are denied; and neither upstream port
  accepts an external connection

#### Scenario: Isolation must be proved before promotion

- **WHEN** authenticated requests from two distinct client addresses
  prove independent budgets within the same rate-limit window and all
  other required checks pass
- **THEN** the release becomes last-good

#### Scenario: Two accounts are not two client addresses

- **WHEN** the promotion probe has two valid accounts but both use the
  same client address
- **THEN** the accounts supply credentials only; the probe does not
  establish independent budgets or pass the isolation gate

#### Scenario: Isolation evidence is inconclusive

- **WHEN** the probe cannot establish independent budgets within one
  window, such as when it cannot rule out a reset or shared egress
- **THEN** the result is inconclusive and the candidate is not promoted

#### Scenario: Incumbent qualification is advisory

- **WHEN** the pre-switch isolation check fails or is inconclusive
  against the incumbent
- **THEN** the workflow records the outcome and does not block an
  otherwise eligible switch on that result, since the release can fix
  the incumbent
- **AND** only the post-switch isolation proof gates promotion

### Requirement: Automatic restore after a failed switch

If readiness or the smoke gate fails or is inconclusive after a switch,
the release workflow SHALL automatically restore and recheck the prior
last-good release, when one exists. It SHALL record the candidate and
recovery outcomes separately and alert on the failed deployment.

#### Scenario: Previous release is restored and passes

- **WHEN** the post-switch gate rejects a candidate and the previous
  release passes the same gate after restoration
- **THEN** that previous release serves again and the history records
  the candidate's failure or inconclusive result and the verified restore

#### Scenario: Restore cannot be verified

- **WHEN** the restored release's gate is inconclusive
- **THEN** the previous release remains running, the history records
  “restore unverified,” and the workflow alerts rather than reporting
  successful recovery

#### Scenario: Restore has a confirmed failure

- **WHEN** restoring or rechecking the prior release fails conclusively
- **THEN** the workflow records and alerts on the restore failure, does
  not advance last-good, and leaves corrective action to the operator

#### Scenario: First release fails after the switch

- **WHEN** the first switched release fails readiness or smoke, or its
  gate is inconclusive, and no prior last-good release exists
- **THEN** the workflow stops the candidate, records the outcome, and
  alerts without claiming a restore

### Requirement: Manual digest rollback

An operator SHALL be able to request rollback to a recorded successful
activation. Rollback SHALL use its recorded image digests and compatible
configuration without rebuilding either image.

#### Scenario: Recorded release is recoverable

- **WHEN** the operator selects a successful record with available,
  verified images and compatible configuration
- **THEN** the workflow redeploys those exact digests with that
  configuration and updates last-good only after the promotion gate passes

#### Scenario: Recorded configuration is unavailable or incompatible

- **WHEN** the selected record's compatible configuration is missing or
  no longer approved for the host
- **THEN** rollback is refused before the running deployment changes

### Requirement: Report-only accessibility results

An automated accessibility scan SHALL report results per internal
release without blocking promotion. The existing blocking pull-request
accessibility suite is outside this change and remains unchanged.

#### Scenario: Scan reports violations or cannot run

- **WHEN** the release accessibility scan completes or fails to produce
  results
- **THEN** the release history records counts by impact and rule IDs,
  or an explicit unavailable status, respectively
- **AND** that report does not prevent otherwise passing promotion

### Requirement: Scheduled health alerts

The internal site SHALL receive a daily authenticated health check.
On failure, the workflow SHALL attempt an explicit alert to the named
primary and fallback recipients and retain the failed run status.
Delivery to both recipients SHALL be verified before the lane is enabled.

#### Scenario: Daily application check

- **WHEN** the scheduled health check runs against the internal site
- **THEN** it verifies valid HTTPS, authenticated browser rendering and
  same-origin data, unauthenticated denial, and robots headers
- **AND** it does not run or claim proof of client-address isolation

#### Scenario: Health failure with incident posting available

- **WHEN** the health check fails and incident posting is available
- **THEN** the workflow opens or updates the corresponding incident
  without duplicating an open incident for that failure class and
  names both the primary and fallback recipients

#### Scenario: Health failure with incident posting unavailable

- **WHEN** the health check fails and the workflow cannot post the incident
- **THEN** the run shows a posting error, stays failed, and does not
  claim that an alert was posted or delivered

#### Scenario: Both recipients receive a test alert

- **WHEN** the operator rehearses health alerting before enabling the lane
- **THEN** both named recipients confirm delivery before enablement

### Requirement: Credential confinement

Within the deployment infrastructure, passwords SHALL persist only as
salted hashes on the host or as secrets in the workflow's secret store.
Evaluator accounts and workflow probe accounts SHALL be separate.
No passwords or hashes SHALL appear in the repository, release history,
or logs, and the front door SHALL NOT pass credentials to the upstreams.

#### Scenario: Authenticated upstream request

- **WHEN** a valid evaluator or probe request is forwarded
- **THEN** the upstream receives no `Authorization` credentials

#### Scenario: Audit records and logs

- **WHEN** an operator inspects the repository, retained release history,
  and logs after successful and failed authenticated requests and runs
- **THEN** none contains plaintext passwords, password hashes, or
  authentication headers carrying credentials
