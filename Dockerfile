# syntax=docker/dockerfile:1

# One image, multiple roles (ROLE=bot|web|migrate). Built for self-hosting:
# no external services beyond Postgres are required.
FROM node:24-alpine AS base
RUN npm install -g pnpm@12.3.4
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/bot/package.json apps/bot/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/fluxer/package.json packages/fluxer/package.json
COPY packages/modules/package.json packages/modules/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
RUN pnpm --filter @fluxbot/web build

FROM base AS runner
ENV NODE_ENV=production

COPY --from=builder --chown=node:node /app /app
RUN cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static \
 && cp deploy/entrypoint.sh /entrypoint.sh \
 && chmod 755 /entrypoint.sh

USER node
EXPOSE 3000

# Health probes are defined per service in docker-compose.yml: the bot has no
# HTTP server, so a single image-level healthcheck would mark it unhealthy.

ENTRYPOINT ["/entrypoint.sh"]
