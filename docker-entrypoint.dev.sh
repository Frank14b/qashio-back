#!/bin/sh
set -e

# Bind-mounted source uses a volume for /app/node_modules. That volume can go
# stale when package.json/lockfile gain new deps after the first compose up.
MARKER=node_modules/.docker-deps-hash
CURRENT="$(cksum package-lock.json | awk '{print $1" "$2}')"

if [ ! -d node_modules ] || [ ! -f "$MARKER" ] || [ "$(cat "$MARKER")" != "$CURRENT" ]; then
  echo "Installing npm dependencies into container volume..."
  npm ci --ignore-scripts
  echo "$CURRENT" > "$MARKER"
fi

exec "$@"
