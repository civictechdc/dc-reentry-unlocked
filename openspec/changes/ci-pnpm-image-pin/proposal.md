# Proposal

## Why

Every PR's "Compose e2e matrix" check has failed since 2026-11-22 during
the image build — the e2e suites never ran. Root cause, established from
PR #18's failed runs (both attempts) and pnpm's release notes:

- Both Dockerfiles copy pnpm from the floating major tag
  `ghcr.io/pnpm/pnpm:12` ("pinned at tag level" per the Dockerfile
  comment).
- pnpm 12.23.0 — released 2026-11-22, hours before the first failure —
  regressed offline lockfile supply-chain verification. The Docker
  recipe's `pnpm install --offline --frozen-lockfile` step re-verifies
  the lockfile and needs registry metadata it cannot fetch offline:
  `ERR_PNPM_META_FETCH_FAIL` → `ERR_PNPM_NO_OFFLINE_META` (first
  failing entries: `@commitlint/format`, `@commitlint/cli`).
- pnpm 12.22.0 — what the floating tag delivered on 2026-11-18, the
  last green run of this exact pipeline — contains the offline fix for
  precisely this error (pnpm issue #18063, in the 12.22.0 release
  notes: "Fixed an offline install failing the `minimumReleaseAge`
  lockfile check with `ERR_PNPM_NO_OFFLINE_META` … The check now reads
  publish times from the metadata that the resolution cached").

Deterministic, not transient: a re-run of PR #18's failed job reproduced
the identical failure signature. Not caused by any repo change — the
floating tag moved under us.

## What Changes

- Pin the pnpm image in `apps/api/Dockerfile` and `apps/web/Dockerfile`
  from `ghcr.io/pnpm/pnpm:12` to the exact version
  `ghcr.io/pnpm/pnpm:12.22.0` (registry tag existence verified), and
  update each Dockerfile's base-image comment to record that the pnpm
  image is pinned to an exact version and why (12.23.0 regressed the
  offline verification; bumps are deliberate, reviewed changes).
- No product or spec behavior changes. Deliberately NOT pinned to
  `packageManager`'s `pnpm@12.15.0`: that version predates the offline
  fix (#18063 landed in 12.22.0), so it could reintroduce the failure.
  Moving past 12.23.0 later is a deliberate, reviewed bump once upstream
  restores offline verification (no 12.23.1 exists as of 2026-11-23).

## Capabilities

### New Capabilities

### Modified Capabilities

## Impact

- **Code:** `apps/api/Dockerfile`, `apps/web/Dockerfile` (image tag +
  comment lines only).
- **Verification:** a local `docker compose build` of both images must
  complete the offline install with the lockfile supply-chain check
  passing; CI's "Compose e2e matrix" must go green on this change's PR.
- **Sequencing:** blocks PR #18 (its e2e check cannot pass until this
  lands and its branch is updated onto the fix); unblocks every other
  open PR's e2e check. Independently useful to the rest of the queue.
