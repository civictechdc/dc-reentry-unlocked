# Proposal

## Why

Production `/_app/immutable/*` bundles are served by adapter-node's
static layer, which bypasses the SvelteKit hook chain — so the standard
hardening headers (`x-content-type-options: nosniff`,
`referrer-policy`, `x-frame-options`, `permissions-policy`) are absent
on exactly the responses a browser executes. The residual is
long-documented (`preview-headers.spec.ts` asserts reachability-only
there, and the split headers spec asserts headers only where the hook
chain runs), and the CI repair's security review flagged the gap: a
MIME-sniffing or type-confusion vector on bundle responses would be
unmitigated. Severity is tempered by the URLs being versioned,
same-origin, and content-hashed — but "immutable" is a caching
directive, not a trust boundary.

## What Changes

- Serve the hardening-header baseline from the static layer so every
  production response carries it (candidate mechanisms: adapter-node
  static `setHeaders`, or the compose reverse proxy in front of the
  web image — decide in design)
- Extend the production header coverage (the compose-matrix
  `headers-prod-csp` spec or the `e2e:prod` preview-headers spec) to
  assert headers on an immutable asset, then retire the
  reachability-only caveats in both specs' comments

## Capabilities

### New Capabilities

(none — deployment/serving hardening; `skip_specs` until planned)

### Modified Capabilities

## Impact

- **Code:** `apps/web` serving config (adapter/compose), plus the two
  header specs; no product runtime logic
- **Sequencing:** small and self-contained; pairs naturally with the
  deployment-pipeline planning (the same baseline applies wherever the
  app is fronted in production)
