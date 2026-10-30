# Production web image (`apps/web`, SvelteKit adapter-node). Build context:
# the repository root.
#
# Follows the pnpm-documented monorepo Docker recipe for the build stage
# (full frozen install, workspace-scoped build), then ships only the
# adapter-node output (build/), which is self-contained — the SSR server
# bundles its dependencies and runs on bare Node.
#
# The SPA runs in the host browser, so the API base URL must resolve from
# the host: it is baked at image build time (VITE_API_URL, also blessed into
# the served CSP). Leave it at the local default or override the build arg
# in compose (`docker compose build --build-arg VITE_API_URL=https://api.example.com`).
#
# Base images are pinned at tag level (`node:22-slim`, `ghcr.io/pnpm/pnpm:12`)
# rather than by digest here — digest pinning is a deliberate follow-up while
# the prototype calibrates its dependency surface.
FROM node:22-slim AS base
COPY --from=ghcr.io/pnpm/pnpm:12 /opt/pnpm /opt/pnpm
RUN for bin in pnpm pn pnpx pnx; do ln -s "/opt/pnpm/$bin" "/usr/local/bin/$bin"; done

FROM base AS build
WORKDIR /app
ENV NODE_ENV=production
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch --store-dir /pnpm/store
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --store-dir /pnpm/store
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=${VITE_API_URL}
RUN pnpm --filter @dc-reentry/web build

# Runtime stage: bare node, no pnpm tooling — the adapter-node build output
# is self-contained and runs as the unprivileged `node` user.
FROM node:22-slim
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/build /app/build

ENV PORT=5173
EXPOSE 5173
USER node
CMD ["node", "build/index.js"]
