#!/usr/bin/env bash
# One-shot production deploy helper (backup -> migrate -> health checks)
# Usage: ensure env vars below are set, then run: sudo ./deploy_prod.sh
set -euo pipefail

echo "[deploy_prod] Starting deploy helper"

: ${PGHOST:?"PGHOST must be set"}
: ${PGUSER:?"PGUSER must be set"}
: ${PGPASSWORD:?"PGPASSWORD must be set"}
: ${PGDATABASE:?"PGDATABASE must be set"}
: ${PGPORT:=5432}
: ${FOOTBALLPRO_API_URL:?"FOOTBALLPRO_API_URL must be set"}

BACKUP_FILE="/tmp/footballpro_backup_$(date +%Y%m%d_%H%M).dump"

echo "[deploy_prod] Creating DB backup to $BACKUP_FILE"
pg_dump -h "$PGHOST" -U "$PGUSER" -Fc "$PGDATABASE" > "$BACKUP_FILE"

echo "[deploy_prod] Running migrations"
cd "$(dirname "$0")/.."/ || exit 1
chmod +x ./scripts/run_migrations_safe.sh
./scripts/run_migrations_safe.sh

echo "[deploy_prod] Waiting a few seconds for backend to restart (if using Render, trigger manual deploy)"
sleep 5

echo "[deploy_prod] Checking backend health at $FOOTBALLPRO_API_URL/health"
if curl -sS "$FOOTBALLPRO_API_URL/health" | grep -iq "ok"; then
  echo "[deploy_prod] Backend health OK"
else
  echo "[deploy_prod] WARNING: backend health check failed" >&2
fi

# Optional mediasoup health check if env provided
if [ -n "${MEDIASOUP_HOST:-}" ] && [ -n "${MEDIASOUP_PORT:-}" ]; then
  echo "[deploy_prod] Checking mediasoup health"
  if curl -sS "http://${MEDIASOUP_HOST}:${MEDIASOUP_PORT}/api/mediasoup/health" | grep -iq "ok"; then
    echo "[deploy_prod] Mediasoup health OK"
  else
    echo "[deploy_prod] WARNING: mediasoup health check failed" >&2
  fi
fi

echo "[deploy_prod] Done. Backup: $BACKUP_FILE"

echo "To start restream to YouTube once streamKey is active run:"
echo "  ./scripts/ffmpeg_restream_to_youtube.sh rtmp://localhost:1935/live/<streamKey> <YOUTUBE_STREAM_KEY>"
