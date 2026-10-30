# Production API image (`apps/api`). Build context: the repository root.
#
# Follows the pnpm-documented monorepo Docker recipe: a full frozen install,
# then `pnpm deploy --prod` to extract only the API and its runtime
# dependencies (including the packed `@dc-reentry/shared` workspace package).
# The API serves TypeScript source directly (`pnpm start` = `tsx`), so tsx
# is a runtime dependency and carries into the deploy; the frozen dataset is
# copied to the repository-root-relative `data/` location the data source
# module resolves.
#
# Base images are pinned at tag level (`node:22-slim`, `ghcr.io/pnpm/pnpm:12`)
# rather than by digest here — digest pinning is a deliberate follow-up while
# the prototype calibrates its dependency surface.
FROM node:22-slim AS base
COPY --from=ghcr.io/pnpm/pnpm:12 /opt/pnpm /opt/pnpm
RUN for bin in pnpm pn pnpx pnx; do ln -s "/opt/pnpm/$bin" "/usr/local/bin/$bin"; done

FROM base AS build
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch --store-dir /pnpm/store
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --store-dir /pnpm/store
RUN pnpm --filter @dc-reentry/api deploy --prod /prod/apps/api

# Runtime stage: bare node, no pnpm tooling — the deployed tree is
# self-contained and runs as the unprivileged `node` user.
FROM node:22-slim
WORKDIR /app
COPY --from=build --chown=node:node /prod/apps/api /app/apps/api
COPY --from=build --chown=node:node /app/data/units.v1.json /app/data/units.v1.json

ENV HOST=0.0.0.0 \
    PORT=3000 \
    LOG_LEVEL=info \
    API_CORS_ORIGINS=http://localhost:5173

EXPOSE 3000
USER node
WORKDIR /app/apps/api
CMD ["node", "node_modules/tsx/dist/cli.mjs", "src/server.ts"]
