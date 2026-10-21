#!/bin/sh
# Fluxbot container entrypoint. One image, three roles.
set -eu

role="${ROLE:-bot}"

case "$role" in
  migrate)
    exec pnpm --filter @fluxbot/db migrate
    ;;
  bot)
    exec pnpm --filter @fluxbot/bot start
    ;;
  web)
    export HOSTNAME="${HOSTNAME:-0.0.0.0}"
    export PORT="${PORT:-3000}"
    exec node apps/web/.next/standalone/apps/web/server.js
    ;;
  *)
    echo "Unknown ROLE '$role' (expected: bot, web, migrate)" >&2
    exit 1
    ;;
esac
