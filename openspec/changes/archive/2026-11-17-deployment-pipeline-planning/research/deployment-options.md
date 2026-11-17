# Deployment options research (retrieved 2026-11-16)

Covers research task 1.1.

All linked sources below were fetched directly on **2026-11-16**. Prices reflect those retrieved pages, not contractual quotes. Cost calculations are explicitly estimates; exclude taxes, domain registration, CI overages, and unspecified ancillary services. Stack details come from supplied brief, not independent investigation.

## TL;DR shortlist

1. **Fly.io:** strongest always-on, single-digit infrastructure candidate. Two single Machines, 512 MB web + 256 MB API, cost **$5.88/30 days** in Ashburn/New Jersey before traffic. Authentication gateway remains extra work. ([Pricing](https://docs.fly.io/about/pricing), retrieved 2026-11-16)
2. **Render:** straightforward managed-container alternative if **$14/month** is acceptable. Two smallest paid services cost $7 each; includes managed TLS and ongoing health checks. ([Pricing](https://render.com/pricing), [health checks](https://docs.render.com/health-checks), retrieved 2026-11-16)
3. **Cloud Run:** attractive usage-based candidate when cold starts are acceptable. Tiny workloads can fit compute free allowance, but registry, identity configuration, and cross-origin authentication need deliberate setup. ([Pricing](https://cloud.google.com/run/pricing), [deployment](https://docs.cloud.google.com/run/docs/deploying), [IAP sessions](https://cloud.google.com/iap/docs/sessions-howto), retrieved 2026-11-16)
4. **VM + Compose + Caddy:** simplest infrastructure match for existing Compose deployment and configurable access wall. DigitalOcean 1 GiB costs **$6/month**, but capacity needs testing; 2 GiB costs **$12/month**. Operator owns host maintenance. ([Droplet pricing](https://www.digitalocean.com/pricing/droplets), [Compose production](https://docs.docker.com/compose/how-tos/production/), retrieved 2026-11-16)

**Important current-state correction:** AWS App Runner is **closed to new customers**. Do not shortlist for a new account. ([AWS availability notice](https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html), retrieved 2026-11-16)

## Shared deployment constraints and registry

### Environment-specific web images

Given constraint: `VITE_API_URL` and CSP are fixed during image build. Consequently, proposed release unit is:

- API image digest;
- web image digest **for that environment's API origin**;
- runtime configuration, including exact `API_CORS_ORIGINS`;
- deployment/proxy configuration.

GitHub Actions can build and push images with Docker's action; its documented inputs include `build-args`, Dockerfile path, tags, platforms, and digest output. Thus per-environment CI builds are feasible independently of host choice. Changing runtime `VITE_API_URL` alone is **not** a solution for this supplied stack. ([Docker action](https://github.com/docker/build-push-action), retrieved 2026-11-16)

**Operational recommendation:** reserve stable API and web hostnames before building web. Retain matching image/config pairs for rollback. These are implications of supplied build-time constraint, not provider promises.

### GHCR

- Supports Docker and OCI images, private packages, granular permissions, and anonymous public pulls. New packages default private. Actions can publish repository-associated packages with `GITHUB_TOKEN`; external private pulls use a classic PAT with `read:packages`. ([Registry documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry), retrieved 2026-11-16)
- Container-registry image storage and bandwidth are **currently free**; GitHub promises at least one month's notice before changing that policy. Do not confuse generic private Packages allowances with this container-registry exception. ([Billing](https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-packages/about-billing-for-github-packages), retrieved 2026-11-16)
- Documented limits: **10 GB per layer**, **10-minute upload timeout**; digest-based pulls supported. ([Registry documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry), retrieved 2026-11-16)

### Authentication versus crawler exclusion

`X-Robots-Tag: noindex` is an indexing instruction for supporting crawlers, **not access control**. Google must fetch resource to see it; blocking crawling with `robots.txt` can prevent that. ([Google Search documentation](https://developers.google.com/search/docs/crawling-indexing/block-indexing), retrieved 2026-11-16)

For genuine internal access, protect **both web and API**, including alternate provider endpoints. A private service hostname alone does not solve browser access: supplied SPA calls API from user's browser. This conclusion follows supplied architecture.

Cross-origin auth must be validated in an actual browser; protecting web does not automatically authenticate API requests. Google explicitly documents separate target-origin sessions and credentialed fetch requirements for IAP. ([IAP sessions](https://cloud.google.com/iap/docs/sessions-howto), retrieved 2026-11-16)

## Fly.io

- **Services:** proposed two Fly Apps, one image each, internal ports 5173 and 3000. Fly deploy runs images on Machines and supports existing-image deployment. First deployment normally creates **two Machines per app** for redundancy: explicitly reduce count for quoted single-instance budget. ([Deployment](https://docs.fly.io/launch/deploy), retrieved 2026-11-16)
- **Health:** configure HTTP `/` and `/health`. Service checks remove unhealthy Machines from routing, but failed checks **do not restart Machines automatically**. ([Health checks](https://docs.fly.io/reference/health-checks), retrieved 2026-11-16)
- **Configuration/build:** runtime `[env]` and secrets; separate `[build.args]` or `--build-arg`. Existing-image deployment skips build. CI per-environment images therefore fit; alternatively Fly builds per environment. Set `kill_signal = "SIGTERM"` because documented default is SIGINT. ([Configuration](https://docs.fly.io/reference/configuration), retrieved 2026-11-16)
- **TLS:** built-in HTTP service terminates TLS; shared IPv4 and IPv6 included. First ten single-hostname certificates free. ([Configuration](https://docs.fly.io/reference/configuration), [pricing](https://docs.fly.io/about/pricing), retrieved 2026-11-16)
- **Prototype cost:** $3.69 + $2.19 = **$5.88/30 days** in `iad`/`ewr`; 10 GB North America internet egress adds $0.20. Two Machines per service approximately double compute. Actual memory sufficiency remains unmeasured. ([Pricing](https://docs.fly.io/about/pricing), retrieved 2026-11-16)
- **Rollback:** redeploy retained prior image using existing-image deployment. Blue-green and canary strategies supported. Image retention and matching runtime configuration remain operator responsibilities. ([Deployment](https://docs.fly.io/launch/deploy), retrieved 2026-11-16)
- **Exclusion/auth:** proxy supports custom response headers, enabling `X-Robots-Tag`. Native edge Basic Auth **UNVERIFIED**; configurable Caddy gateway is possible deployment work, not a verified built-in feature. ([Configuration](https://docs.fly.io/reference/configuration), [Caddy Basic Auth](https://caddyserver.com/docs/caddyfile/directives/basic_auth), retrieved 2026-11-16)

**Assessment:** moderate setup, attractive always-on price; less turnkey than Render, with important monitoring/restart distinction.

## Railway

- **Services:** two services within project/environment; accepts GitHub source or Docker images, including GHCR. **Private-registry deployment requires Pro**, not Hobby. ([Services](https://docs.railway.com/services), retrieved 2026-11-16)
- **Health:** endpoint checked before deployment activation; **no continuous endpoint monitoring afterward**. Set explicit `PORT` if retaining fixed target ports. ([Healthchecks](https://docs.railway.com/deployments/healthchecks), retrieved 2026-11-16)
- **Configuration/build:** service variables plus Dockerfile `ARG` enable environment-specific source builds. CI-built images skip platform build. Hobby can use public images or source builds; private GHCR means Pro pricing. ([Dockerfiles](https://docs.railway.com/builds/dockerfiles), [deployment reference](https://docs.railway.com/deployments/reference), [services](https://docs.railway.com/services), retrieved 2026-11-16)
- **TLS:** Railway domains and automatically provisioned SSL for custom domains documented. ([Networking](https://docs.railway.com/overview/advanced-concepts), retrieved 2026-11-16)
- **Cost:** Hobby **$5/month minimum including $5 usage**; Pro **$20 including $20 usage**. Consumption rates: RAM $10/GB-month, CPU $20/vCPU-month, egress $0.05/GB. At hypothetical aggregate 0.75 GB actual RAM, memory alone is $7.50/month; CPU and egress extra. Compose limits are not actual measured consumption. ([Pricing](https://railway.com/pricing), retrieved 2026-11-16)
- **Rollback/shutdown:** deployment rollback available subject to retention policy. Configure draining: default documented SIGTERM-to-forced-stop allowance is **zero seconds**. ([Deployment reference](https://docs.railway.com/deployments/reference), retrieved 2026-11-16)
- **Exclusion/auth:** native app password wall/custom edge response-header mechanism **UNVERIFIED**. Additional reverse-proxy service can implement auth/headers; cost and bypass-proof routing need separate design. ([Caddy Basic Auth](https://caddyserver.com/docs/caddyfile/directives/basic_auth), [Caddy headers](https://caddyserver.com/docs/caddyfile/directives/header), retrieved 2026-11-16)

**Assessment:** convenient source deployment; private-image Pro requirement weakens fit for single-digit budget.

## Render

- **Services:** two Docker web services; accepts Dockerfile builds or prebuilt images, including private GHCR with credentials. Image-backed services do not automatically redeploy when tag changes; CI can call deploy hook with image digest. ([Docker](https://docs.render.com/docker), [image deployment](https://docs.render.com/deploying-an-image), retrieved 2026-11-16)
- **Health:** ongoing HTTP checks; unhealthy running instances lose traffic and are restarted after sustained failure. Failed new deployment leaves old instances serving. Configure `/` and `/health`. ([Health checks](https://docs.render.com/health-checks), retrieved 2026-11-16)
- **Configuration/build:** Docker service environment variables become both build arguments and runtime variables for platform builds. Prebuilt images receive runtime variables but must already contain correct API URL/CSP. Images must include `linux/amd64`. ([Docker](https://docs.render.com/docker), [image requirements](https://docs.render.com/deploying-an-image), retrieved 2026-11-16)
- **TLS/cost:** automatic TLS. Hobby workspace $0 plus compute; smallest paid service $7/month, therefore **$14/month** for two. Hobby includes 5 GB bandwidth; then $0.15/GB. ([Pricing](https://render.com/pricing), retrieved 2026-11-16)
- **Free evaluation:** 750 instance-hours **shared per workspace**; two continuously running instances exceed that. Free services sleep after 15 idle minutes; wake-up about one minute. Render says not to use free instances for production. ([Free limitations](https://docs.render.com/free), retrieved 2026-11-16)
- **Rollback:** pricing lists five retained builds on Hobby. For image-backed rollback, original image/digest must still exist in external registry. ([Pricing](https://render.com/pricing), [image deployment](https://docs.render.com/deploying-an-image), retrieved 2026-11-16)
- **Exclusion/auth:** native password wall for these Docker web services **UNVERIFIED**. Configurable reverse-proxy container can provide auth/headers, but adds deployment work and possibly another paid service. ([Caddy Basic Auth](https://caddyserver.com/docs/caddyfile/directives/basic_auth), [Caddy headers](https://caddyserver.com/docs/caddyfile/directives/header), retrieved 2026-11-16)

**Assessment:** credible managed baseline if budget can move above $10; free tier suitable only for intermittent evaluation.

## Google Cloud Run

- **Services:** proposed two independent Cloud Run services, one container image each. Images deploy by digest; revisions immutable; service endpoint stable. Public GHCR images supported directly; private GHCR requires Artifact Registry remote repository or image mirroring. ([Deployment](https://docs.cloud.google.com/run/docs/deploying), retrieved 2026-11-16)
- **Health/TLS:** HTTP startup, liveness, and readiness probes documented; use existing endpoints. Cloud Run terminates TLS. Container must bind `0.0.0.0` and configured port; platform injects `PORT`. ([Health](https://docs.cloud.google.com/run/docs/configuring/healthchecks), [container contract](https://docs.cloud.google.com/run/docs/container-contract), retrieved 2026-11-16)
- **Configuration/build:** runtime environment variables are revision-specific. CI can build each environment's web image, then deploy existing image without source rebuild. Source deployment instead invokes Cloud Build and stores images in Artifact Registry, with separate charges. ([Environment variables](https://docs.cloud.google.com/run/docs/configuring/services/environment-variables), [deployment](https://docs.cloud.google.com/run/docs/deploying), [pricing](https://cloud.google.com/run/pricing), retrieved 2026-11-16)
- **Cost:** request-based free allowance: **180,000 vCPU-seconds, 360,000 GiB-seconds, two million requests/month**, aggregated by billing account. Tier-1 active rates beyond allowance: $0.000024/vCPU-second, $0.0000025/GiB-second, $0.40/million requests. Proposed minimum zero makes near-$0 compute plausible for sparse evaluation, **not a guaranteed total bill**; registry, builds, logs/networking require budgeting. ([Pricing](https://cloud.google.com/run/pricing), retrieved 2026-11-16)
- **Rollback:** direct traffic back to prior revision; traffic splitting supported. Rollback routing does not rerun deployment health checks. ([Rollbacks](https://docs.cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration), retrieved 2026-11-16)
- **Auth:** direct IAP protects default `run.app` endpoint as well as load-balancer ingress; no load balancer required. However cross-origin API calls require separate session establishment and credentialed browser requests. **Compatibility with unchanged supplied frontend is UNVERIFIED**; cannot promise "turn on IAP on both and done." ([IAP setup](https://docs.cloud.google.com/run/docs/securing/identity-aware-proxy-cloud-run), [sessions](https://cloud.google.com/iap/docs/sessions-howto), retrieved 2026-11-16)
- **Proxy option:** documented sidecars include reverse proxies and authentication filters. Useful infrastructure option, but changes deployment topology and needs explicit approval/testing. ([Deployment](https://docs.cloud.google.com/run/docs/deploying), retrieved 2026-11-16)

**Assessment:** strong cost/managed-runtime option; higher initial IAM/registry complexity and auth integration risk.

## AWS App Runner

- **Eligibility:** closed to new customers; existing customers may create more resources. AWS plans security/availability investment but no new features. ([Availability](https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html), retrieved 2026-11-16)
- **Existing-customer deployment:** two services from prebuilt images, but image sources limited to **ECR/ECR Public**, not direct GHCR. Build per environment in CI and mirror/push to ECR. ([Image sources](https://docs.aws.amazon.com/apprunner/latest/dg/service-source-image.html), retrieved 2026-11-16)
- **Health/config:** configurable TCP or HTTP health checks and path; image configuration supports port, runtime env, and secret references. ([Health](https://docs.aws.amazon.com/apprunner/latest/dg/manage-configure-healthcheck.html), [image configuration](https://docs.aws.amazon.com/apprunner/latest/dg/API_ImageConfiguration.html), retrieved 2026-11-16)
- **Cost:** smallest 0.25 vCPU/0.5 GB. US-region idle provisioned RAM $0.007/GB-hour gives **$5.04 per 720-hour month for two services**, before active CPU, ECR, logs, traffic, and deployment charges. Active CPU $0.064/vCPU-hour; one-minute CPU minimum per activation. ([Pricing](https://aws.amazon.com/apprunner/pricing/), retrieved 2026-11-16)
- **TLS:** AWS documentation describes ACM certificates for custom-domain HTTPS. Native end-user Basic Auth, exact rollback behavior, and custom response-header facility **UNVERIFIED** in this investigation. ([Availability/migration documentation](https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html), retrieved 2026-11-16)

**Assessment:** exclude unless already eligible; no reason to choose maintenance-mode service for this new deployment.

## Azure Container Apps

- **Services:** two container apps in shared environment; accepts public/private registries and Linux amd64 images. Smallest Consumption allocation per app is **0.25 vCPU/0.5 GiB**, not existing Compose's 256 MB API allocation. ([Containers](https://learn.microsoft.com/en-us/azure/container-apps/containers), retrieved 2026-11-16)
- **Health/config:** startup, liveness, readiness probes support HTTP(S)/TCP; runtime env supports secret references and new revisions. Build correct per-environment images in CI; deploy images rather than relying on runtime variables to repair web build. ([Health](https://learn.microsoft.com/en-us/azure/container-apps/health-probes), [environment variables](https://learn.microsoft.com/en-us/azure/container-apps/environment-variables), retrieved 2026-11-16)
- **TLS:** managed HTTP ingress terminates TLS and redirects HTTP to HTTPS by default. ([Ingress](https://learn.microsoft.com/en-us/azure/container-apps/ingress-overview), retrieved 2026-11-16)
- **Cost:** Consumption free grant **180,000 vCPU-seconds, 360,000 GiB-seconds, two million requests/subscription/month**. Scale-zero incurs no usage charges. Exact paid rates **UNVERIFIED**: fetched pricing table returned `$-` placeholders. Near-$0 compute possible inside grant; total bill not established. ([Pricing](https://azure.microsoft.com/en-us/pricing/details/container-apps/), retrieved 2026-11-16)
- **Rollback:** immutable revisions, default 100 inactive retained; reactivate/switch traffic to earlier revision. Some configuration—including secrets/ingress—is application-scoped, not rolled back simply by changing revision. ([Revisions](https://learn.microsoft.com/en-us/azure/container-apps/revisions), retrieved 2026-11-16)
- **Auth:** built-in Easy Auth supports Entra, GitHub, Google and others without app-specific SDK; can require authentication. Each app gets its own cookie/token by default. End-to-end two-origin SPA compatibility **UNVERIFIED**; do not assume web login authenticates API. ([Authentication](https://learn.microsoft.com/en-us/azure/container-apps/authentication), retrieved 2026-11-16)

**Assessment:** viable especially with existing Azure ownership; exact paid estimate and auth compatibility need follow-up before shortlist promotion.

## VM with Compose and Caddy

- **Deployment:** Docker documents single-server Compose production deployments and production override files. Proposed host runs existing containers, pulling environment-specific CI images; runtime config injected through Compose. Preserve loopback publishing from supplied stack. ([Compose production](https://docs.docker.com/compose/how-tos/production/), [CI image action](https://github.com/docker/build-push-action), retrieved 2026-11-16)
- **Proxy/TLS:** run Caddy **on host** so existing `127.0.0.1` published ports remain reachable without network changes. Caddy supports localhost upstreams, automatic certificate issuance/renewal and HTTP-to-HTTPS redirects. DNS, ports 80/443, and persistent writable certificate storage required. ([Reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [HTTPS](https://caddyserver.com/docs/automatic-https), retrieved 2026-11-16)
- **Health:** retain supplied Compose health checks; Caddy can additionally check backend `/` and `/health`. Automatic restart solely because Compose health status becomes unhealthy **UNVERIFIED** here; do not promise it. Docker separately recommends restart policies for production. ([Caddy health checks](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [Compose production](https://docs.docker.com/compose/how-tos/production/), retrieved 2026-11-16)
- **Access wall:** Caddy supports HTTP Basic Auth with hashed passwords and arbitrary response headers. Can add `X-Robots-Tag` and keep origin containers loopback-only. Two-origin browser credential behavior still requires testing. ([Basic Auth](https://caddyserver.com/docs/caddyfile/directives/basic_auth), [headers](https://caddyserver.com/docs/caddyfile/directives/header), retrieved 2026-11-16)
- **Cost example:** DigitalOcean regular Basic: **1 GiB/1 vCPU $6/month**, 25 GiB disk/1,000 GiB transfer; **2 GiB/1 vCPU $12/month**. Weekly percentage-based backup adds 20%: $7.20 or $14.40 total respectively. 1 GiB capacity is a hypothesis, not verified sufficient for application, OS, Docker, and proxy. ([Pricing](https://www.digitalocean.com/pricing/droplets), retrieved 2026-11-16)
- **Rollback:** proposed manual rollback resets retained image digests/runtime config and recreates containers; Compose documents recreation deployment workflow, not managed atomic two-service rollback. Expect potential interruption. ([Compose production](https://docs.docker.com/compose/how-tos/production/), retrieved 2026-11-16)

**Assessment:** highest host-operations burden. Explicit owner needed for OS/Docker/proxy patching, monitoring, backups, disk cleanup and recovery. This is assessment of responsibilities introduced by self-hosted topology, not measured labor estimate.

Hetzner/OVH/Lightsail prices **UNVERIFIED**; DigitalOcean provides sufficient verified representative VM comparison.

## Other options: Coolify and ECS Express Mode

- **Coolify:** self-hosted edition free; cloud control plane $5/month base **plus own servers**, not $5 all-in application hosting. Self-hosted guidance lists 2 cores, 2 GB RAM, 10 GB disk minimum, with additional workload resources needed. ([Pricing](https://coolify.io/pricing/), [installation](https://coolify.io/docs/get-started/installation), retrieved 2026-11-16)
- **Assessment:** potentially useful later for several applications; extra control plane weak fit for minimal two-container, tiny-budget deployment. Detailed Compose import/rollback/auth behavior **UNVERIFIED**.
- **ECS Express Mode:** AWS-recommended App Runner successor provisions Fargate service, load balancer, networking and autoscaling; no additional Express Mode fee, but underlying resources bill separately. Exact two-service cost **UNVERIFIED**; not shortlisted without cost calculation. ([AWS migration guide](https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html), retrieved 2026-11-16)

## Comparison table

Estimates reuse cited evidence above; operations ratings are research judgments.

| Option | Two-service prototype cost | Builds/config | Health/rollback | Internal-access caveat | Ops assessment |
|---|---:|---|---|---|---|
| Fly.io | $5.88 compute/30 days + traffic | CI images or platform build args; runtime env | Routing checks; redeploy retained image | Headers native; auth gateway extra | Medium-low |
| Railway Hobby | $5 minimum; usage-dependent | Source Docker ARG/public images | Deploy-only checks; retained deployment rollback | Native wall unverified | Low |
| Railway private GHCR | $20 Pro minimum | Private CI images supported | Same | Native wall unverified | Low |
| Render paid | $14/month + overages | CI private GHCR or Dockerfile ARG | Ongoing checks/restarts; retained image rollback | Native wall unverified | Low |
| Render free | $0 within limits | Same | Sleep and shared-hour limits | Auth still unresolved | Low, weaker experience |
| Cloud Run | Potentially $0 compute inside grants | CI images; private GHCR needs registry bridge | Probes; revision traffic rollback | IAP available; cross-origin compatibility unresolved | Medium initial, low host ops |
| App Runner | $5.04 idle floor + extras, existing customers only | CI → ECR | HTTP checks; rollback details unverified | Native wall unverified | Exclude for new account |
| Azure Container Apps | Potentially $0 compute inside grants; paid rates unverified | CI public/private registry images | Probes; revision rollback | Easy Auth; two-origin compatibility unresolved | Medium initial, low host ops |
| DO VM + Compose | $6/$12; $7.20/$14.40 with weekly backup | CI → GHCR; Compose runtime config | Existing checks; manual image/config revert | Caddy Basic Auth/headers; browser test needed | Highest |
| Coolify | VM + free self-hosted or $5 cloud control plane | Detailed workflow unverified | Detailed workflow unverified | Detailed workflow unverified | Extra platform maintenance |

## AWS addendum (Lightsail, verified 2026-11-16)

Added during the decision session after a user question; pricing fetched directly from the Lightsail pricing page ([aws.amazon.com/lightsail/pricing](https://aws.amazon.com/lightsail/pricing/), retrieved 2026-11-16).

- **Lightsail VM (Linux/Unix, public-IPv4 bundles):** $5/mo = 0.5 GB RAM, 2 vCPU, 20 GB SSD, 1 TB transfer; **$7/mo = 1 GB RAM**, 40 GB SSD, 2 TB transfer; **$12/mo = 2 GB RAM**, 60 GB SSD, 3 TB transfer. IPv6-only bundles are cheaper ($3.50/$5/$10 for 0.5/1/2 GB) but IPv6-only reachability is impractical for an arbitrary internal-evaluator audience. Snapshots $0.05/GB/mo. Static IP included.
- **Lightsail Container service:** Nano node $7/mo (0.25 shared vCPU, 512 MB RAM) per node, 500 GB/mo transfer quota per service, overage from $0.09/GB. Two nodes = $14/mo, and the Caddy-front-door Basic Auth pattern would need an additional node or a different auth design.
- **Fit assessment:** Lightsail VM is the AWS form of the "VM + Compose + Caddy" option at price parity with DigitalOcean ($7/1 GB vs $6/1 GB; $12/2 GB equal). App Runner remains excluded (closed to new customers, verified above). Standard ECS/Fargate remains a real but heavier path (VPC/IAM/load-balancer surface, metered pricing, cost UNVERIFIED in this research) — overkill for a two-container prototype.

## Recommendation and trade-offs

**Decision recommendation—not final technology selection:**

- Compare **Fly.io versus Render** first if priority is weekly releases without owning a host. Fly fits target compute budget; Render's $14 floor buys documented ongoing health recovery and simpler managed baseline.
- Keep **Cloud Run** as cost-oriented alternative if cold starts, Google Cloud setup, and auth validation are acceptable.
- Choose **VM + Compose + Caddy** only if named operator accepts maintenance ownership, or configurable access wall outweighs managed convenience.
- Railway remains reasonable via source builds, but **private GHCR → Pro minimum** materially changes economics.
- Azure is credible when organization already uses it; complete pricing/auth checks before choosing.
- Single-digit infrastructure cost is realistic; **single-digit, always-on, both origins authenticated, minimal operations** is not established by this research. Authentication topology is biggest remaining decision.

Before deployment approval, validate: memory under real container workload, correct baked API origin/CSP, exact CORS origin, health probes, graceful drain, unauthenticated denial of both services, alternate-domain bypass, and rollback of matching web/API/config release pair.

## Cloudflare Quick Tunnels addendum (verified 2026-11-16)

Added during the decision session after a user question about free test
builds; fetched from current Cloudflare documentation
([Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels),
retrieved 2026-11-16).

- `cloudflared tunnel --url <origin>` creates a temporary
  `*.trycloudflare.com` HTTPS URL for a local service; **no Cloudflare
  account or domain required**; anyone with the URL can reach the origin;
  the URL dies with the process.
- Documented limitations: no uptime guarantee; 200 in-flight requests per
  tunnel (excess returns 429); no Server-Sent Events; hostname changes each
  run; `--allowed-mail` email-gating exists but requires an interactive
  browser session.
- Stable hostnames and production traffic require a **named** Cloudflare
  Tunnel, which needs an account and a domain on Cloudflare DNS.
- **Fit for this stack**: a quick tunnel pointed at the Caddy front door
  preserves the entire control stack (Basic Auth, `X-Robots-Tag`, banner,
  no origin bypass). The baked-`VITE_API_URL` constraint means each random
  tunnel hostname needs its own web-image build (tunnel first, then build
  for that URL, then deploy behind it).

## Open questions for decision session

1. **Access policy:** true authentication wall for both services, or only crawler exclusion? Basic Auth acceptable, or named-user SSO required?
2. **Budget:** strict under-$10 total, or $14–20/month acceptable to reduce operational work? Must internal and public environments run concurrently?
3. **Operations:** who owns VM patching/recovery, or should host operations be delegated to platform?
4. **Origins:** which stable internal/public web and API hostnames will be reserved before image builds? May deployment proxy topology change without changing application code?
5. **Availability:** cold starts and brief release interruptions acceptable? What rollback-time target and image-retention window are required?
