# Internal-environment protections research (retrieved 2026-11-16)

Covers research task 1.3.

All cited URLs retrieved **2026-11-16**. Recommendations below are proposed controls, not claims about implemented repository behavior. App architecture and existing banner/CORS behavior are supplied ground truth; implementation was not audited.

## Recommended control stack

1. **Require authentication before serving either web or API content.** Use HTTPS reverse-proxy Basic Auth for a small evaluator group, or identity-aware platform/edge access with explicit evaluator allowlists. Google expressly recommends password protection for private content and says this prevents indexing, or eventually removes already indexed content. [Google: control what you share](https://developers.google.com/search/docs/crawling-indexing/control-what-you-share); [MDN: HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Authentication).
2. **Prevent origin bypass.** Proposed deployment requirement: web port 5173 and API port 3000 remain reachable only through approved front door/private networking. Firewall restrictions and outbound-only tunnels are available mechanisms; select with deployment platform. [AWS security groups](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html); [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/).
3. **Add `X-Robots-Tag: noindex, nofollow` across internal-environment responses**, including web documents, static resources, API JSON, and authentication/error responses where front door permits. This is defense in depth, not authorization. Google supports both directives and non-HTML resources; MDN explicitly limits effectiveness to cooperative crawlers. [Google robots directives](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag); [MDN X-Robots-Tag](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Robots-Tag).
4. **Do not combine a blanket robots.txt crawl block with a claim that crawlers will observe `noindex`.** Proposed default: no blanket `Disallow: /`; authentication remains enforced. Google says a robots.txt block prevents discovery of indexing directives and can leave URLs indexed from external references. Do **not** weaken authentication merely to expose `noindex`. [Google robots.txt introduction](https://developers.google.com/search/docs/crawling-indexing/robots/intro); [Google combined rules](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag#combining).
5. **Make existing synthetic-data disclosure an enforced deployment invariant.** Proposed policy: banner defaults on; only explicitly approved production configuration may hide it. Verify actual deployed browser output before evaluator handoff. Build-time Vite environment flags are not container-runtime switches; production-optimized builds are not synonymous with production deployment environments. [Vite environment variables and modes](https://vite.dev/guide/env-and-mode); [Playwright assertions](https://playwright.dev/docs/test-assertions).
6. **Prefer private health probes**, with separate authenticated end-to-end smoke checks. If probes must traverse authentication, supply supported credentials/service authentication or narrowly restrict an exact health-route exception. Missing Basic Auth credentials produce 401; Cloudflare provides Service Auth without interactive login. [Caddy Basic Auth](https://caddyserver.com/docs/caddyfile/directives/basic_auth); [Cloudflare Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/).

## 1. Crawler exclusion

### HTTP indexing directives

- `noindex` asks Google not to show the page, media, or resource in search results. `nofollow` asks Google not to follow links on that page; it is not an access restriction. Comma-separated directives and multiple `X-Robots-Tag` headers are supported. [Google robots directives](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag).
- HTTP headers work beyond HTML: Google explicitly documents PDF, video, and image resources; MDN describes headers as useful for non-HTML documents and resources. **Recommendation/inference:** apply the same header globally to API JSON responses, rather than relying on HTML `<meta>` tags. This does not assert every JSON endpoint would otherwise be indexed. [Google robots directives](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag); [MDN X-Robots-Tag](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Robots-Tag).
- The header belongs on the actual HTTP response. Google documents setting it globally through web-server configuration. **Recommendation:** enforce at the internal virtual host/front door covering both services, or at each public service if no common response-header layer exists. [Google practical implementation](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag#practical-implementation-of-x-robots-tag).
- `noindex, nofollow, noarchive` is syntactically a combined directive list, but **Google now ignores `noarchive`** because its cached-link feature no longer exists. Do not describe it as Google cache, confidentiality, or deletion protection. [Google historical and unused rules](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag#noarchive).
- Bing's authoritative help page was discoverable through live search and its result explicitly states that supported tags can be sent as `X-Robots-Tag`, with comma-separated values such as `"noindex, noarchive"`. Direct fetch returned a JavaScript shell rather than the article. Consequently, **Bing's current detailed `noarchive` semantics are UNVERIFIED in this investigation**; no recommendation depends on them. [Bing supported robots tags](https://www.bing.com/webmasters/help/robots-meta-tags-and-attributes-that-bing-supports-5198d240).
- Live search of Bing's permanent-removal documentation explicitly confirms `NOINDEX`, removal after recrawl, and `X-Robots-Tag: noindex` for non-HTML files. Direct article extraction was unavailable; evidence is the live authoritative search result, not a successfully extracted article body. [Bing permanent removal](https://www.bing.com/webmasters/help/how-to-permanently-remove-a-url-or-page-from-bing-or-copilot-37c07477).

**Proposed header baseline:** `X-Robots-Tag: noindex, nofollow`. Add `noarchive` only as an optional engine-specific directive, not as essential protection.

### robots.txt: critical interaction

- robots.txt mainly controls crawler access/traffic; it is **not** a mechanism for reliably keeping web pages out of Google. A disallowed URL can still appear based on links from elsewhere, potentially without a description. [Google robots.txt introduction](https://developers.google.com/search/docs/crawling-indexing/robots/intro).
- Robots meta tags and HTTP indexing headers are discovered when a URL is crawled. If robots.txt disallows that URL, Google cannot discover those directives and ignores them. [Google combined rules](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag#combining).
- Therefore, when relying on publicly accessible `noindex`, do not disallow crawling of those URLs. For private content, use password protection instead; Google documents that as a separate permanent exclusion mechanism. [Google robots.txt introduction](https://developers.google.com/search/docs/crawling-indexing/robots/intro); [Google permanent removal](https://developers.google.com/search/docs/crawling-indexing/remove-information).
- Google distinguishes media files: robots.txt can prevent image/video/audio appearances, while text-based web-page URLs can still be indexed without crawling. This media-specific behavior does not make blanket robots.txt blocking sufficient for the whole app. [Google robots.txt file-type effects](https://developers.google.com/search/docs/crawling-indexing/robots/intro).
- The commonly described **"Indexed, though blocked by robots.txt"** phenomenon is real: Google's current help explains that a URL blocked by robots.txt can still be indexed using other information. Exact dashboard wording may change; the underlying behavior is documented. [Search Console indexing report](https://support.google.com/webmasters/answer/7440203?hl=en).

### Existing indexing or accidental exposure

- For urgent Google removal, use Search Console's Removals tool alongside a permanent measure. Google says removal requests last about six months; permanent measures include removal/update, password protection, or `noindex`. Protect all URL variants, not just the homepage. [Google removal instructions](https://developers.google.com/search/docs/crawling-indexing/remove-information).
- Password protection prevents private content appearing in Google, or eventually removes already indexed content. Existing search listings are therefore not guaranteed to disappear immediately when authentication is enabled. [Google access controls](https://developers.google.com/search/docs/crawling-indexing/control-what-you-share).
- `noindex` is cooperative, not security enforcement, and must first be read by a crawler. **Recommendation:** close access immediately after exposure; never temporarily publish private content merely to accelerate directive discovery. [MDN X-Robots-Tag](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Robots-Tag); [Google permanent removal](https://developers.google.com/search/docs/crawling-indexing/remove-information).

## 2. Access-control options

### HTTP Basic Auth

Basic Auth uses a 401 challenge and `WWW-Authenticate`; clients answer with `Authorization`. Credentials are encoded, not encrypted, so HTTPS/TLS is required. A reverse proxy protecting the application normally issues the application's 401 challenge, not the 407 challenge used for forward-proxy authentication. [MDN HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Authentication).

Current syntax summaries—not complete deployment configurations:

| Proxy | Authentication configuration | Password handling | Robots header |
|---|---|---|---|
| Caddy | `basic_auth { evaluator <hash> }` | Plaintext rejected; bcrypt default; argon2id also supported; generate with `caddy hash-password`. Current spelling is `basic_auth`, renamed from `basicauth` before v2.8.0. | `header >X-Robots-Tag "noindex, nofollow"` |
| Traefik | `http.middlewares.eval-auth.basicAuth.usersFile: /run/secrets/evaluators` or `users` entries in `name:hashed-password` format | MD5, SHA1, BCrypt supported. Proposed choice: BCrypt, not legacy formats. Compose inline label hashes require doubled `$`; external file avoids that interpolation issue. | `headers.customResponseHeaders.X-Robots-Tag: "noindex, nofollow"` |
| nginx | `auth_basic "Internal evaluation";` and `auth_basic_user_file /run/secrets/evaluators;` | Official module documents `crypt()` formats, Apache apr1, and RFC2307 schemes; explicitly warns against PLAIN and unsalted SHA. **Portable bcrypt support across nginx container platforms is UNVERIFIED**; test selected image's crypt implementation before requiring bcrypt. | `add_header X-Robots-Tag "noindex, nofollow" always;` |

Sources: [Caddy auth](https://caddyserver.com/docs/caddyfile/directives/basic_auth), [Caddy headers](https://caddyserver.com/docs/caddyfile/directives/header), [Traefik auth](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/basicauth/), [Traefik headers](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/headers/), [nginx auth](https://nginx.org/en/docs/http/ngx_http_auth_basic_module.html), [nginx headers](https://nginx.org/en/docs/http/ngx_http_headers_module.html).

Important implementation checks:

- nginx `always` applies the header regardless of response code. Without it, `add_header` covers only documented status codes. Nested `add_header` declarations can prevent normal inheritance; newer inheritance controls require compatible nginx versions. [nginx headers](https://nginx.org/en/docs/http/ngx_http_headers_module.html).
- Caddy's `>` header prefix defers setting until response writing, allowing replacement of upstream values. [Caddy headers](https://caddyserver.com/docs/caddyfile/directives/header).
- Traefik supports `removeHeader: true` to remove the authentication header before forwarding upstream. **Recommendation:** use it where application does not need those credentials. [Traefik BasicAuth](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/basicauth/).
- **Proposed acceptance requirement:** confirm headers on both authenticated responses and rejected requests. Middleware/configuration summaries do not prove coverage of platform-generated login, redirect, or error pages.

### Network/IP restrictions

- nginx supports ordered `allow <address-or-CIDR>;` and `deny all;`; first matching rule wins. Address and password requirements can be combined through `satisfy`. [nginx address access](https://nginx.org/en/docs/http/ngx_http_access_module.html).
- Caddy supports `client_ip` and `remote_ip` matchers. `remote_ip` represents the immediate peer; `client_ip` can use forwarded client information when trusted proxies are configured. **Recommendation:** explicitly define trusted front-door proxies rather than treating arbitrary client-supplied forwarding headers as trusted. [Caddy request matchers](https://caddyserver.com/docs/caddyfile/directives/matchers).
- Traefik provides an `ipAllowList` middleware with `sourceRange` and client-IP strategy settings. Select strategy only after actual proxy chain is known. [Traefik IPAllowList](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/ipallowlist/).
- Cloud security groups can restrict source, protocol, and port. AWS recommends limiting ports to required sources; it explicitly distinguishes IPv4 and IPv6 exposure. **Proposed deployment requirement:** allow only approved ingress paths and cover both address families. [AWS security groups](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html).

**Recommendation:** use IP restrictions as additional protection when evaluators have known stable egress networks. Their operational suitability for this evaluator group remains a decision, not a verified fact.

### Identity-aware/platform access

- Cloudflare Access is deny-by-default and supports policies based on evaluator emails, IdP groups, IP ranges, and other criteria. `Include` rules combine as OR; `Require` narrows eligibility. **Recommendation:** explicit evaluator identities rather than `Everyone` or all users with a valid email login. [Cloudflare Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/).
- Cloudflare documents a Free plan at `$0`, a **50-user limit**, included ZTNA, community support, and standard log retention up to 24 hours. Its description says "teams under 50," while its limit table says "50 users"; confirm seat eligibility during signup, especially at the boundary. Do not interpret this as free hosting or unlimited retention. [Cloudflare current SASE/Zero Trust pricing](https://www.cloudflare.com/plans/sase-zero-trust.md).
- Cloudflare Tunnel establishes outbound-only connections and allows inbound firewall closure, reducing direct-origin bypass. **Tunnel connectivity alone is not the proposed evaluator authorization policy**; pair it with Access. [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/); [Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/).
- Platform-native authentication remains a valid category, but selected platform, plan entitlement, default-domain protection, and API coverage are **UNVERIFIED/TBD** pending sibling deployment research.

### Unlinked/obscure hostname

**Assessment/inference:** an unlinked hostname offers reduced intentional discovery, not authorization. Google documents discovering URLs through external links and recommends authentication for private content. Do not treat obscurity, omitted sitemap entries, or lack of navigation links as a security boundary. [Google robots.txt limitations](https://developers.google.com/search/docs/crawling-indexing/robots/intro); [Google sharing controls](https://developers.google.com/search/docs/crawling-indexing/control-what-you-share).

### Healthchecks, headers, API, and CORS

- An unauthenticated health probe traversing Basic Auth receives 401, like any other unauthenticated request. **Recommendation:** probe API `/health` privately; separately verify public authentication and application functionality through an authenticated smoke test. [Caddy Basic Auth behavior](https://caddyserver.com/docs/caddyfile/directives/basic_auth).
- If external probes require exceptions, restrict the exact health route/method and trusted probe sources where supported. nginx supports cancelling inherited Basic Auth with `auth_basic off`; Cloudflare supports Service Auth, while Bypass disables Access security enforcement and logging. **Recommendation:** private probes or Service Auth before broad Bypass. [nginx auth](https://nginx.org/en/docs/http/ngx_http_auth_basic_module.html); [Cloudflare policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/).
- Existing exact-origin API CORS is supplied ground truth. CORS governs browser cross-origin resource access; **inference:** it is not a substitute for server-side authentication against direct HTTP clients. [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS).
- Cross-origin fetch does not send credentials by default; credentialed CORS requires appropriate settings and explicit origin responses. Preflight requests must not include credentials. **Recommendation:** test API Basic Auth/Access and OPTIONS behavior end-to-end; consider same-origin API routing to avoid creating an unnecessary cross-origin authentication boundary. Do not "fix" failures by broadly removing API authentication. [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS).

## 3. Guaranteeing synthetic-data disclosure

### Verified build-time behavior

- Vite statically replaces `import.meta.env` constants at build time. `VITE_*` values are exposed to client code, bundled into output, and parsed as strings—including values that look like booleans. They must not contain secrets. [Vite environment variables](https://vite.dev/guide/env-and-mode).
- Vite loads `.env` and `.env.local` generally, plus `.env.[mode]` and `.env.[mode].local` for selected mode. Mode-specific files override generic values; environment values already present when Vite executes have higher priority. [Vite environment-file precedence](https://vite.dev/guide/env-and-mode).
- `vite build` defaults to production mode; `--mode staging` selects staging environment files. `NODE_ENV` and mode are different concepts: a staging or development-mode build can still use `NODE_ENV=production`. **Therefore:** neither `import.meta.env.DEV` nor `!import.meta.env.PROD` correctly identifies all non-production deployment environments. [Vite modes and NODE_ENV](https://vite.dev/guide/env-and-mode).
- **Inference from static replacement:** setting `VITE_*` only when starting an already-built Docker image cannot change the compiled banner condition. Same-image promotion needs either a banner-on artifact appropriate everywhere or an explicitly designed runtime configuration mechanism. [Vite static replacement](https://vite.dev/guide/env-and-mode).

### Proposed invariant—not a documented Vite feature

1. Keep existing banner; enforce it centrally across the shared app UI.
2. Define a deployment-environment contract independently of build optimization.
3. Default disclosure **on**; missing/unknown environment cannot silently hide it.
4. Permit hiding only for explicitly approved production configuration.
5. Reject a non-production deployment with disclosure disabled or artifact/configuration mismatch.
6. Apply checks to local, CI, preview, staging, and internal-evaluation deployments—not only an environment literally named `staging`.

These are proposed engineering acceptance rules derived from the verified build-time risks above, not claims that a flag alone guarantees presentation.

An authoritative presentation precedent is GOV.UK's phase banner: it communicates service status and is shown across all service pages as a service-level message. It does **not** establish a universal synthetic-data or environment-flag standard. [GOV.UK phase banner](https://design-system.service.gov.uk/components/phase-banner/).

### Deployment verification

- SvelteKit documents that `ssr=false` produces an empty shell and renders the app in the browser. Given the supplied SPA-shell architecture, raw served-HTML text search is **not sufficient proof** that a component banner renders. [SvelteKit page options](https://svelte.dev/docs/kit/page-options#ssr).
- Playwright supports retrying visibility and text assertions, including test-ID locators. **Proposed release gate:** authenticate, open deployed app in a real browser, require existing banner marker to be visible and contain expected synthetic-data disclosure. [Playwright assertions](https://playwright.dev/docs/test-assertions).
- Proposed coverage: root page, representative deep links, reload, client navigation, and application error states that expose data. Exercise mobile and desktop layouts. If dismissibility exists, verify it cannot suppress required non-production disclosure.
- Proposed negative configuration tests: absent/unknown environment and attempted disclosure-off overrides. Bind test evidence to deployed artifact/revision.
- Served-HTML inspection remains useful **only when banner markup is intentionally server-rendered or placed directly in the shell**; it supplements, not replaces, rendered-browser checks for this SPA. [SvelteKit rendering behavior](https://svelte.dev/docs/kit/page-options#ssr).

## Limitations

- No crawler directive guarantees compliance by every bot. Authentication/network controls are the security boundary; indexing directives are supplementary. [MDN X-Robots-Tag](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Robots-Tag).
- Authentication plus `noindex` does not imply Google sees authenticated page headers. Keep authentication; use documented removal processes for prior exposure. [Google permanent removal](https://developers.google.com/search/docs/crawling-indexing/remove-information).
- Existing listings can persist until engines process changes; do not promise immediate worldwide disappearance. [Google sharing controls](https://developers.google.com/search/docs/crawling-indexing/control-what-you-share); [Bing removal documentation, live search result](https://www.bing.com/webmasters/help/how-to-permanently-remove-a-url-or-page-from-bing-or-copilot-37c07477).
- A banner variable or marker alone is not proof of visible disclosure. Proposed guarantee requires safe defaults, deployment validation, browser assertions, and route/layout coverage. These are assurance measures, not an absolute guarantee against every future defect.
- Repository banner implementation, supported runtime configuration path, exact dependency versions, selected platform entitlements, and production suppression requirements remain **UNVERIFIED**.
- Bing article bodies were unavailable through direct extraction; detailed Bing `noarchive` behavior remains **UNVERIFIED**. Google's current non-use of that directive was verified directly.

## Open questions for the decision session

1. **Access:** proxy Basic Auth with individual evaluator accounts, or identity-aware platform/edge access? Who provisions/revokes access and rotates credentials?
2. **Topology:** same-origin web/API routing or separate origins? How will default platform domains and direct origin ports be prevented from bypassing protection?
3. **Network/probes:** stable evaluator egress IPs available? Can health probes stay private, or must authenticated external probes/precise exceptions be supported?
4. **Artifact contract:** environment-specific builds or same-image promotion? May existing banner stay visible in production, avoiding a suppression path entirely?
5. **Acceptance scope:** must disclosure render without JavaScript, or is verified SPA rendering sufficient? Who owns browser release gates, ongoing checks, and accidental-indexing remediation?
