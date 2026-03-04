#!/usr/bin/env bash
# Safe migration runner for production-local testing
set -euo pipefail

echo "[run_migrations_safe] Starting"

if [ -z "${NODE_ENV:-}" ]; then
  echo "NODE_ENV not set, defaulting to development"
  export NODE_ENV=development
fi

echo "NODE_ENV=$NODE_ENV"

echo "Checking for sequelize-cli..."
if ! command -v npx >/dev/null 2>&1; then
  echo "npx not found. Install Node.js and npm." >&2
  exit 1
fi

echo "Running migrations (dry-run disabled)"
# This will run migrations using sequelize-cli; ensure DB env vars set before running in production
npx sequelize-cli db:migrate

echo "Migrations finished"
