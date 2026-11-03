# Housing availability API (`apps/api`)

A read-only Fastify API serving the available-unit inventory and the
published filter schema. The TypeBox schemas in `packages/shared` are the
route schemas themselves — request validation and response projection come
from the shared contract, and the machine-readable OpenAPI document is
generated from those same schemas, so it cannot drift from the implemented
routes.

## Run it

```sh
pnpm -C apps/api dev        # tsx watch, http://127.0.0.1:3000
```

The server loads the frozen generated dataset (`data/units.v2.json`) at
boot and serves only units whose availability state is `available` — the
availability gate lives inside the data source module, so unavailable and
unverified-availability units never leave it.

### Response compression

`@fastify/compress` is registered globally (`global: true`): responses
negotiate with the client's `accept-encoding` (gzip/brotli — `br` wins for
the JSON card payload). Replies that already carry a content-encoding are
never double-compressed, and bodyless replies (CORS preflights, 204s) stay
untouched. The plugin's request-decompression hook is disabled
(`globalDecompression: false`): the API is read-only GET and never consumes
request bodies, so there is no decompression surface (and no
decompression-bomb surface).

### Environment

| Variable                        | Default                 | Meaning                                                    |
| ------------------------------- | ----------------------- | ---------------------------------------------------------- |
| `PORT`                          | `3000`                  | Listen port                                                |
| `HOST`                          | `127.0.0.1`             | Listen host                                                |
| `LOG_LEVEL`                     | `info`                  | pino log level (structured JSON on stdout)                 |
| `API_CORS_ORIGINS`              | `http://localhost:5173` | Comma-separated allowed origins; never `*` (read-only API) |
| `API_RATE_LIMIT_MAX`            | `100`                   | Requests per client IP per window                          |
| `API_RATE_LIMIT_TIME_WINDOW_MS` | `60000`                 | Rate-limit window in milliseconds                          |

## Endpoints

Four endpoints are served under these rules:

- Filter query parameters are **derived from the shared filter schema**
  (the same 11 definitions the `/filters` endpoint publishes): a schema
  addition appears as a parameter with no code change. Each parameter
  accepts a single value or repeated values (`?ward=1&ward=2`): selections
  of one filter union (any chosen value may match), selections of
  different filters narrow conjunctively. That is a deliberate permissive
  superset of the UI control semantics — single-select UIs send one value,
  API consumers may union.
- Unknown filter names or values are rejected with `400 invalid-filter`.
- Unknown-at-source handling: a "not publicly listed" policy field matches
  every **no** boolean selection and every enum value selection, and the
  unit card still carries its honest `"unknown"` value — the
  machine-readable "policy not listed" marker.
- Every response echoes its server-generated request id in the
  `x-request-id` header; error envelopes carry the same id as
  `correlationId` (a uuid the server generates — client headers are never
  trusted for this).
- Every response carries baseline security headers; every error — invalid
  request, unknown route, server failure, rate limiting — uses the shared
  stable error envelope (`schemaVersion`, machine `code`, public-safe
  `message`, `correlationId`). Failure detail goes to server logs only.
- CORS is allowed only for the configured origins (see the environment
  table). The origin list fails closed: a set-but-empty
  `API_CORS_ORIGINS=""` (or a value of nothing but separators) yields an
  empty allow list, so no origin is granted and no cross-origin request
  may proceed — and the wildcard `"*"` is rejected outright: it fails the
  boot with an explicit error, so no configuration can ever arrive at an
  allow-all.

### `GET /health`

```sh
curl -sS http://127.0.0.1:3000/health
# {"status":"ok"}
```

### `GET /filters`

The filter schema — the single source of truth for what filters exist
(4 single-select enums, 1 multi-select ward filter, 6 boolean policy
filters), published exactly as defined in `packages/shared`:

```sh
curl -sS http://127.0.0.1:3000/filters | head -c 400
```

### `GET /units`

Currently-available housing units as self-contained cards (unit specs +
program policies + provider contacts; no further lookups needed).
Coordinates are required and non-null on every served card — exact street
addresses only — and both the response envelope and each card carry
`schemaVersion` `"2.0"`:

```sh
curl -sS "http://127.0.0.1:3000/units" | head -c 400
```

Filtered (repeated parameters mean "any of"):

```sh
curl -sS "http://127.0.0.1:3000/units?ward=1&ward=2" | head -c 200
curl -sS "http://127.0.0.1:3000/units?housing-type=emergency-shelter&referral-required=no" | head -c 200
```

### `GET /openapi.json`

The machine-readable OpenAPI 3.1 document, generated from the route
schemas at request time (JSON only — no UI is mounted):

```sh
curl -sS http://127.0.0.1:3000/openapi.json | head -c 300
```

### Error paths

```sh
curl -sS "http://127.0.0.1:3000/units?housing-type=somewhere-else"
# {"schemaVersion":"2.0","code":"invalid-filter","message":"At least one filter name or value is not defined by the published filter schema — see GET /filters.","correlationId":"…"}
```

Browser preflight (what a SvelteKit dev-server request triggers before its
first cross-origin call):

```sh
curl -sS -X OPTIONS \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -D- -o /dev/null http://127.0.0.1:3000/units
# HTTP/1.1 204 No Content, Access-Control-Allow-Origin: http://localhost:5173
```

An unknown route answers `404` with the same envelope and code
`not-found`; a rate-limited client answers `429` with code `rate-limited`
and a `Retry-After` header. The code vocabulary is pinned in
`packages/shared` (`ERROR_CODES`, additive-only — see
`docs/shared-contracts.md`).

### Rate limiting and CORS residuals (honest edges)

The per-client budget counts **every** request the server accepts — real
routes, unknown routes, and CORS preflights — through one shared limiter,
so probing unknown routes with 404s is throttled like any other traffic.

Two CORS-plugin-internal responses are the residual: a malformed
preflight (a request claiming preflight without the required headers,
answered `400 Invalid Preflight Request`) and an allowed preflight reply
(`204`). Both are produced inside the CORS plugin's own request hook (the
limiter has already counted them), so by the plugin's design they carry
the security headers (helmet is registered first) and their request id,
but they bypass the JSON error envelope. The misbehaving party in the
malformed-preflight case is not a browser doing a genuine preflight, and
browsers gate real preflights on origin anyway.
