#!/bin/sh
set -e

# ── Wait for Postgres ──────────────────────────────────────────────
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
TRIES="${DB_STARTUP_TRIES:-30}"

echo "⏳  Waiting for Postgres at ${DB_HOST}:${DB_PORT} …"

attempt=0
while [ "$attempt" -lt "$TRIES" ]; do
  attempt=$((attempt + 1))
  if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -q 2>/dev/null; then
    echo "✅  Postgres is accepting connections (attempt ${attempt})"
    break
  fi
  if [ "$attempt" -ge "$TRIES" ]; then
    echo "❌  Postgres not reachable after ${TRIES} attempts – aborting."
    exit 1
  fi
  echo "   … attempt ${attempt}/${TRIES}"
  sleep 1
done

# ── Generate drizzle config from the live DATABASE_URL ─────────────
# drizzle-kit v0.31.x does not expand ${DATABASE_URL} from the config
# file, so we write the real connection string into the config at
# startup. The app itself reads DATABASE_URL directly and never uses
# this file at runtime.
cat > /app/drizzle.config.json << DREOF
{
  "dialect": "postgresql",
  "schema": "./src/db/schema.ts",
  "dbCredentials": {
    "url": "${DATABASE_URL}"
  }
}
DREOF
echo "📦  drizzle.config.json written for $(echo "$DATABASE_URL" | sed 's|://[^@]*@|://***@|')"

# ── Push / create schema ───────────────────────────────────────────
# Idempotent: only touches tables that differ from the TS schema.
echo "📦  Synchronising database schema …"
npx drizzle-kit push --force
echo "✅  Schema up to date"

# ── Hand off to the CMD ────────────────────────────────────────────
# exec replaces this shell with the target process so SIGTERM reaches
# the node server directly and Docker sees the right PID.
exec "$@"