# ── build ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN npm ci

COPY . .

# DATABASE_URL is only needed at build time to satisfy next.config / drizzle.
# The real URL is supplied at runtime via the environment.
ENV DATABASE_URL=postgresql://postgres:postgres@db:5432/mediatracker
RUN npm run build

# ── run ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

# pg_isready comes from postgresql-client; busybox wget handles the healthcheck.
RUN apk add --no-cache postgresql16-client

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules     ./node_modules
COPY --from=builder /app/.next            ./.next
COPY --from=builder /app/public           ./public
COPY --from=builder /app/next.config.ts   ./next.config.ts
COPY --from=builder /app/drizzle.config.json ./drizzle.config.json

# Startup script: waits for Postgres, pushes schema, then starts Next.js.
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000

# Docker/Podman healthcheck (also used by `depends_on: condition: service_healthy`)
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["entrypoint.sh"]
CMD ["npm", "run", "start"]