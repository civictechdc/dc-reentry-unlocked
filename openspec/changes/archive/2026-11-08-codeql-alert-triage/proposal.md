# Proposal

## Why

CodeQL landed report-only by design (user decision 2026-11-07: triage the
baseline before gating). The baseline run surfaced four open high-severity
alerts — all `js/incomplete-sanitization`-family findings in
`packages/shared/src/docgen/render.ts`, its test, and
`apps/web/src/lib/i18n/audit.test.ts` (escape helpers doing
first-occurrence-only replacement). Until they are triaged, the planned
high/critical merge gate cannot be enabled: the ruleset would immediately
block every PR on alerts nobody has dispositioned. This change closes that
leftover: disposition each alert under the repo's exact-finding exception
discipline, then turn the gate on.

## What Changes

- Triage each of the four open CodeQL alerts: assess whether the escape
  helper's input path is real (fix it, with tests) or first-party/docgen
  or test-fixture only (dismiss with a documented reason and removal
  condition — same discipline as the `pnpm audit` ignore list, never a
  blanket rule or directory exclusion)
- If a fix is warranted, it lands in this change (expected small:
  replace-all or regex in the escape helpers) with the finding closed by
  the next scan rather than dismissed
- Enable the code-scanning merge-protection ruleset on `main`: code
  scanning results required, CodeQL tool, threshold high-or-worse —
  a settings/API action deferred until now
- Verify: alert states match the recorded dispositions, the ruleset is
  active and scoped to `main`, and dismissed/none remaining high alerts
  mean PRs are not blocked

## Capabilities

### New Capabilities

(none — spawned at proposal stage with `skip_specs`; delta specs, if the
planning session finds any behavior worth speccing, are authored then)

### Modified Capabilities

## Impact

- **Code:** possibly `packages/shared/src/docgen/render.ts` +
  `apps/web/src/lib/i18n/audit.test.ts` (only if triage says fix; no
  product-runtime code expected — all findings sit in docgen/test files)
- **Settings:** repository branch ruleset (code-scanning merge protection)
- **Sequencing:** independent of `live-walkthrough-feedback` (parallel
  OK); should land before heavy PR activity resumes (deployment-pipeline
  implementation) so the gate is on while code flows
