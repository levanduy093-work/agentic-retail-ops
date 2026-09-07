#!/bin/sh
set -e

echo "[Medusa Entrypoint] Starting container entrypoint..."

# Wait for PostgreSQL if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
  echo "[Medusa Entrypoint] Checking database connectivity..."
  DB_HOST=$(echo "$DATABASE_URL" | sed -E 's/.*@([^:/]+).*/\1/')
  DB_PORT=$(echo "$DATABASE_URL" | sed -E 's/.*:([0-9]+)\/.*/\1/')
  if [ -z "$DB_PORT" ] || [ "$DB_PORT" = "$DATABASE_URL" ]; then
    DB_PORT=5432
  fi

  echo "[Medusa Entrypoint] Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."
  while ! nc -z -w 3 "$DB_HOST" "$DB_PORT" 2>/dev/null; do
    echo "[Medusa Entrypoint] Database not ready yet, retrying in 2 seconds..."
    sleep 2
  done
  echo "[Medusa Entrypoint] Database is ready and reachable!"
fi

# Run migrations automatically unless disabled
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[Medusa Entrypoint] Running database migrations (pnpm exec medusa db:migrate)..."
  pnpm exec medusa db:migrate || {
    echo "[Medusa Entrypoint] Warning: Migration exited with an error. Continuing startup..."
  }
fi

echo "[Medusa Entrypoint] Executing CMD: $@"
exec "$@"
