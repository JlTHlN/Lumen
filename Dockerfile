# syntax=docker/dockerfile:1

# ---------- build ----------
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
# `npm ci` uses the lockfile, so builds are reproducible.
RUN npm ci

COPY . .

# A placeholder keeps the build step happy; the real value is injected at runtime.
ENV DATABASE_URL=postgresql://postgres:postgres@db:5432/mediatracker
RUN npm run build

# ---------- run ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# curl is a more reliable healthcheck than busybox wget.
RUN apk add --no-cache curl

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 3000

# /api/health returns 503 until the database is reachable AND the schema exists,
# so Portainer reflects reality rather than showing a healthy but broken app.
HEALTHCHECK --interval=20s --timeout=6s --start-period=90s --retries=5 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

CMD ["npm", "run", "start"]
