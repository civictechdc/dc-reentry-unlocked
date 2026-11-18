# Release-pipeline research (retrieved 2026-11-16)

covers research task 1.2

All linked sources below were retrieved **2026-11-16**. Recommendations and trade-off assessments are explicitly identified as project-specific judgments, not externally established facts. Stack details are supplied ground truth, not independently audited.

## Recommendation summary

**Recommendation:** start with scheduled weekly internal deployment of accumulated `main` changes, plus `workflow_dispatch` for first deployment, retries, and urgent fixes. Later add a separate production workflow triggered by pushed version tags. Keep ordinary merges deployment-free.

Use GHCR, environment-specific web builds, digest-based deployment, and a manifest identifying the exact web/API pair. Treat deployment health and application integration checks as separate gates. Defer automatic per-PR preview stacks.

These are design recommendations based on the requirements. GitHub documents the necessary scheduled/manual/tag triggers; GHCR documents workflow-token publishing and digest-based pulls. [GitHub events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows), [GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry) — retrieved 2026-11-16.

## 1. Cadence and GitHub Actions triggers

### Verified trigger behavior

- `schedule` uses five-field POSIX cron. Default timezone is UTC; current documentation also supports an explicit IANA `timezone`. Minimum interval is five minutes. Nonstandard shorthand such as `@weekly` is unsupported. Scheduled workflows use the latest commit on the default branch and require the workflow file there. [GitHub schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) — retrieved 2026-11-16.
- Scheduled runs can be delayed during high load, particularly at the start of an hour; sufficiently high load can cause queued jobs to be dropped. Public-repository schedules disable after 60 days without repository activity. **Do not treat cron as a precise delivery-time guarantee.** [GitHub schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) — retrieved 2026-11-16.
- `workflow_dispatch` enables manual runs and supports inputs. The workflow must exist on the default branch. Documentation describes dispatching against branches or tags through CLI/API once the workflow has run at least once. [GitHub workflow_dispatch](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch) — retrieved 2026-11-16.
- `push` supports filtering by branch or tag, so continuous deployment could use pushes to `main`, while production can use a tag filter. [GitHub push](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#push) — retrieved 2026-11-16.
- `workflow_run` supports `completed`, `requested`, and `in_progress`; the downstream workflow file must exist on the default branch. A `completed` trigger runs regardless of upstream success, requiring an explicit `github.event.workflow_run.conclusion == 'success'` condition. Its own SHA/ref context refers to the default branch, not automatically the upstream revision. [GitHub workflow_run](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run) — retrieved 2026-11-16.
- `workflow_run` can receive secrets and write tokens unavailable upstream. GitHub warns against executing untrusted code because of cache-poisoning and unintended privilege/secrets access risks. Chains cannot exceed three downstream workflow levels. [GitHub workflow_run](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run) — retrieved 2026-11-16.

### Project-specific assessment

| Approach | Expected benefit | Expected cost/risk |
|---|---|---|
| Deploy every successful main change | Fast feedback; each individual deployment has a narrower source diff | Evaluators encounter changing behavior during evaluation; more deployment notifications and operational events |
| Weekly accumulated-main deployment | Stable evaluation windows; one weekly "what changed" narrative | Larger combined change set to diagnose; feedback waits until release |
| Weekly plus manual override | Predictable evaluation cadence without blocking urgent fixes | Requires a clear exception policy and accurate deployed-state records |

These are qualitative judgments; no project-specific incident-rate or productivity benefit is established. **UNVERIFIED:** any numerical claim that weekly releases are safer, cheaper, or faster for this app.

**Recommendation:** use weekly plus manual override now. Snapshot the candidate SHA once, rerun release checks on that SHA, and do not silently fall back to an older commit when current main fails. Record a failed release attempt and notify the maintainer.

For traceability, compare the candidate against the **last successful internal deployment**, not simply the previous week's date or latest attempted build. This is a recommended recordkeeping rule.

Example trigger, following verified syntax:

```yaml
on:
  schedule:
    - cron: '17 15 * * 1'
  workflow_dispatch:
```

This proposes Monday 15:17 UTC. Choosing minute 17 avoids the documented start-of-hour congestion point but does not guarantee timely dispatch. [GitHub schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) — retrieved 2026-11-16.

**Recommendation:** avoid `workflow_run` initially. Put validation, publishing, deployment, and verification in a directly ordered release workflow, rather than interpreting completion of unrelated PR/manual test workflows as authorization to deploy.

## 2. Tagged production releases and release notes

### Verified SemVer meaning

SemVer 2.0.0 requires a declared public API. Its version rules are:

- **MAJOR:** incompatible public-API changes.
- **MINOR:** backward-compatible public functionality; deprecating public functionality also requires a minor increment.
- **PATCH:** backward-compatible bug fixes.
- `0.y.z` denotes initial development, without a stable public API.
- Released version contents must not be modified.
- Prerelease identifiers such as `1.0.0-rc.1` are supported.
- `v1.2.3` is a conventional tag name; the semantic version itself is `1.2.3`.

[SemVer specification and FAQ](https://semver.org/) — retrieved 2026-11-16.

**Recommendation:** declare what compatibility means for this web app before automating version increments. Candidate contract: documented API behavior, supported external URLs/integrations, and any externally consumed data formats. A visual redesign is not automatically a SemVer-major change; evaluate it against the declared compatibility contract.

Use a single application version for the coordinated web/API release initially. Choose version bumps deliberately; do not equate "a week passed" with a minor-version increment.

### Verified GitHub support

GitHub automatically generated release notes include merged pull requests, contributors, and a full-changelog link. `.github/release.yml` supports label-based categories and exclusions. GitHub instructs authors to review generated notes before publication. [Automatic release notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes) — retrieved 2026-11-16.

`gh release create` supports:

- `--verify-tag`: fail if the remote tag does not exist.
- `--generate-notes`: use GitHub's release-notes API.
- `--notes-start-tag`: explicitly select the comparison starting tag.
- `--draft`, `--prerelease`, and `--latest=false`.
- Asset-file uploads.

Without `--verify-tag`, a missing tag is automatically created from the default branch unless another target is specified. [GitHub CLI release create](https://cli.github.com/manual/gh_release_create) — retrieved 2026-11-16.

Production trigger:

```yaml
on:
  push:
    tags:
      - 'v*'
```

Tag filters are supported; this broad pattern must be followed by actual version validation. GitHub also documents that pushing more than three tags at once does not generate tag push events. [GitHub tag push](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#running-your-workflow-only-when-a-push-of-specific-tags-occurs) — retrieved 2026-11-16.

**Recommendation:** maintainer pushes one validated version tag pointing at an intended, tested main commit. Production workflow validates version format and main ancestry, tests exact tagged SHA, publishes images, and prepares a draft release with manifest and notes. Approval gates deployment; successful integration checks permit final publication.

For production notes, explicitly use the previous **production** tag as the comparison baseline so internal-release records do not accidentally define the production changelog boundary. This is a recommended policy supported by `--notes-start-tag`. [GitHub CLI](https://cli.github.com/manual/gh_release_create) — retrieved 2026-11-16.

**Important automation caveat:** GitHub documents that, apart from dispatch exceptions and its specified PR behavior, events generated using `GITHUB_TOKEN` do not create new workflow runs. Do not assume a tag created by one workflow using that token will start a tag-push release workflow. Prefer a human-pushed tag or deliberate dispatch design. [GitHub event documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request) — retrieved 2026-11-16.

## 3. Registry and image identity

### Verified GHCR behavior

GHCR uses `ghcr.io/NAMESPACE/IMAGE_NAME:TAG`, with namespace belonging to a personal account or organization. New packages default to private visibility. Public container images support anonymous access. [GHCR documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry) — retrieved 2026-11-16.

GitHub's publishing example authenticates to `ghcr.io` with `github.actor` and `secrets.GITHUB_TOKEN`, granting `contents: read` and `packages: write` to the publishing job. Additional attestation permissions shown in its attestation example are distinct from this baseline publishing permission set. [Publishing Docker images](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images) — retrieved 2026-11-16.

Publishing from the repository workflow using `GITHUB_TOKEN` automatically links the package to that repository. A preexisting, unlinked package with the same name can prevent token publishing. GitHub recommends an `org.opencontainers.image.source` label. [GHCR setup and linkage](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry#pushing-container-images) — retrieved 2026-11-16.

GitHub recommends pinning actions to commit SHAs. [Publishing Docker images](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images) — retrieved 2026-11-16.

### Tags versus immutable identity

Docker documents tags as reusable/changeable references; digests identify immutable image content. GHCR explicitly supports pulling by digest to obtain the same image. Therefore, **a tag containing a Git SHA is not inherently immutable**. [Docker digests](https://docs.docker.com/dhi/core-concepts/digests/), [GHCR digest pulls](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry#pull-by-digest) — retrieved 2026-11-16.

**Recommendation:**

- Give every build a unique tag such as `internal-sha-<fullsha>-run-<id>-attempt-<n>`.
- Give production images a human-readable version alias.
- Never overwrite release aliases as a project policy.
- Deploy and roll back using `image@sha256:...`, not aliases.
- Treat `latest`, `internal`, or `production` as optional convenience pointers only; update them after deployment verification if used.
- Store source SHA **and** image digest: source identity and artifact identity are separate concerns.

### Environment-specific web images

**Given constraint:** web bundles bake `VITE_API_URL` and CSP at build time. Consequently, internal web image cannot simply be promoted unchanged to production when API URLs differ.

Options, both recommendations using GHCR's documented naming/tag model:

| Option | Example | Trade-off |
|---|---|---|
| Separate web packages | `dc-reentry-unlocked-web-internal`, `dc-reentry-unlocked-web-prod` | Clearer artifact separation; more package entries and access settings |
| One web package, explicit environment tags | `dc-reentry-unlocked-web:internal-sha-…`, `:prod-v1.2.3` | Fewer packages; environment correctness depends more heavily on tag/manifest discipline |

[GHCR naming and tagging](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry) — retrieved 2026-11-16.

**Recommendation:** separate internal/prod web packages for clarity, plus one API package. API reuse across environments is an option because runtime configuration is supplied ground truth, not a reason to assume every future API build is environment-neutral.

Each release/deployment manifest should record:

- application version or internal release ID;
- source SHA and workflow run;
- environment;
- exact web/API image names and digests;
- web API build URL;
- runtime configuration revision/reference, without secrets;
- previous successful deployment manifest.

This is a recommended audit schema. Do not claim production has the exact web binary evaluated internally; it has a separate environment-specific build and needs its own verification.

## 4. Deployment gates, health, rollback

### Verified GitHub environment capabilities

Environment protection rules can require approval, delay jobs, restrict branches/tags, or invoke custom GitHub App rules. Environment secrets are available only to jobs referencing that environment and, when approval is configured, only after approval. [Deployments and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments) — retrieved 2026-11-16.

Required reviewers support up to six users/teams, but only one approval is necessary. Preventing self-review blocks the deployment initiator from approving. On Free, Pro, and Team plans, required reviewers and wait timers are public-repository-only. Private-repository environment secrets require Pro, Team, or Enterprise rather than Free. Custom protection rules are public preview and subject to plan/visibility limitations. [GitHub environment reference](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments) — retrieved 2026-11-16.

**Recommendation:** confirm repository visibility and GitHub plan before promising an approval feature. For a one-maintainer project, do not enable prevention of self-review unless another approver exists. A self-approved pause provides deliberate intent, not independent review.

Keep public build configuration separate from deployment credentials. In particular, do not give a web-build job production deployment secrets merely to read its public API URL. This is a recommended permission boundary.

### Health and rollback patterns

Provider example, **not a provider selection**:

- Render checks new instances before routing traffic; if readiness is not achieved within 15 minutes, it cancels deployment and continues serving existing instances. HTTP checks accept `2xx`/`3xx`; default checks are TCP. [Render health checks](https://render.com/docs/health-checks) — retrieved 2026-11-16.
- Render supports returning a service to a previous successful deployment. For registry-hosted images it pulls the recorded tag or digest again; a moved tag can therefore retrieve a different image, while an unavailable image causes rollback failure. [Render rollbacks](https://render.com/docs/rollbacks) — retrieved 2026-11-16.

**Recommendation:** design three gates:

1. **Predeploy:** exact-revision checks and container smoke tests.
2. **Platform readiness:** wait for successful deployment status and service readiness.
3. **Integration:** real browser loads web and makes an API request, checking baked API URL, CSP, and exact-origin CORS behavior.

Do not equate "deployment API accepted request" with completed deployment. Do not equate a successful web-page response with browser/API integration working. These are recommended acceptance criteria for the given stack.

Retain a known-good manifest and both referenced images. Rollback redeploys that pair with compatible runtime configuration; it does not rebuild historical source. Specify deployment ordering and mixed-version compatibility before selecting automatic rollback.

**UNVERIFIED:** atomic two-service deployments, automatic rollback after browser-test failures, and rollback of persistent state on the eventual provider. Provider selection and sibling research must settle these.

## 5. PR preview environments

### Verified provider example

Render preview environments can copy multiple services, datastores, and environment groups per PR; update with commits; and delete when the PR closes or merges. Datastore/disk copies exclude base-resource data. Preview environments require a Pro workspace or higher. [Render previews](https://render.com/docs/preview-environments) — retrieved 2026-11-16.

Render supports manual preview selection, expiry after inactivity, smaller preview compute plans, and preview-specific variables. Preview resources are billed like other services, prorated by the second. [Render previews](https://render.com/docs/preview-environments) — retrieved 2026-11-16.

GitHub does not pass ordinary secrets to fork PR runners, and their `GITHUB_TOKEN` is read-only. Privileged `workflow_run` execution has the security caveats described earlier. [GitHub fork PR behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflows-in-forked-repositories), [workflow_run](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run) — retrieved 2026-11-16.

### Project-specific patterns

1. **Full isolated preview:** reserve/provision PR API and web addresses; build web using that PR's API URL; configure API CORS with exact PR web origin; deploy both; test; destroy resources/images on closure or expiry.
2. **Selected full previews:** same architecture, created only for changes needing evaluator feedback.
3. **Web preview against shared internal API:** fewer services, but preview API changes are not isolated/tested; CORS must explicitly allow each preview origin. Use only when shared API/data behavior is acceptable.
4. **No hosted previews initially:** PR CI plus local integration, with weekly shared internal evaluation.

These are design options derived from the supplied build-time URL and exact-origin CORS constraints. **UNVERIFIED:** any selected provider automatically wires its generated public API URL into this project's Docker build arguments and configures counterpart CORS. Verify that integration before adopting previews.

**Recommendation:** start with option 4; add option 2 when concrete review needs justify it. Full previews provide reviewable isolated stacks, but this project must manage two services, environment-specific builds, origins, credentials, lifecycle cleanup, and possibly data initialization. No numerical preview cost estimate is established.

## 6. Proposed pipeline shape

All steps below are recommendations, not implemented capabilities.

### Internal lane now

1. Keep current PR CI and CodeQL.
2. Trigger `release-internal.yml` weekly and manually.
3. Restrict source to intended main revision; snapshot SHA once.
4. Skip if it equals last successfully deployed SHA, unless explicit redeploy requested.
5. Validate exact source and production-style container builds.
6. Publish internal web build with internal API URL, plus API image.
7. Record candidate digest-pair manifest.
8. Deploy API/web in an explicitly defined compatible order.
9. Await platform readiness; run browser/API integration smoke.
10. On success, persist successful manifest and publish evaluator notes covering previous-successful-SHA → candidate-SHA.
11. On failure, notify and preserve failure evidence; retain last successful baseline.

Suggested internal identifier: `internal-2026-11-16-run-<id>`. Keep internal notes separate from production Releases initially to avoid ambiguity about what constitutes a shipped public release.

### Production lane later

1. Maintainer selects evaluated main commit and pushes `vMAJOR.MINOR.PATCH`.
2. Validate full version syntax, release policy, source ancestry, and exact-tag SHA.
3. Run release checks.
4. Build production web with production API URL; publish web/API artifacts.
5. Create draft GitHub Release with reviewed generated notes and digest-pair manifest.
6. Gate deployment through `production` environment approval where supported.
7. Deploy by digest; await readiness and browser/API verification.
8. Publish release after successful deployment.
9. On failure, keep deployment unsuccessful and release draft; use retained manifest for recovery.

### Recovery lane

Manual workflow accepts an environment and known retained manifest. It validates eligibility, reuses recorded image digests and compatible configuration, deploys, verifies, and records recovery. No source rebuild.

**Recommendation:** serialize changes to each environment and prevent overlapping deployments. Exact concurrency/queue policy remains an implementation decision requiring separate documentation verification.

## 7. Trade-offs

Project-specific judgments:

- Weekly releases prioritize stable evaluation windows over fastest possible feedback.
- Larger batches increase diagnostic scope; exact manifests and browser checks reduce uncertainty, not guarantee safety.
- Environment-specific web builds preserve current architecture but rule out unchanged-binary promotion across different API URLs.
- Separate web packages make environment mistakes more visible but add registry administration.
- Digest deployment improves artifact precision; retaining referenced images becomes part of recovery design.
- One maintainer can intentionally approve production, but cannot supply independent review alone.
- Automatic previews are deferred complexity, not rejected permanently.
- Avoiding `workflow_run` initially reduces cross-workflow identity and privilege reasoning.

## 8. Open questions for decision session

1. Which weekly day/time/timezone fits evaluation? Are urgent manual releases allowed?
2. What defines SemVer compatibility, and when should the project declare `1.0.0`?
3. What are repository visibility and GitHub plan? Is production approval a deliberate solo pause or independent review?
4. Separate web packages or environment-prefixed tags? Public or private GHCR images, and what production pull credentials are acceptable?
5. What readiness timeout, smoke scenarios, mixed-version compatibility, retention window, and recovery objective must deployment satisfy?
6. Are selected PR previews valuable now? Which budget, access restriction, data isolation, and expiry policy applies?
