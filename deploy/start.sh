#!/usr/bin/env bash
set -euo pipefail
cd /srv/mysticweb/current
revision=$(cat .release-sha)
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid release revision" >&2; exit 1; }
export MYSTICWEB_REVISION="$revision"
exec /opt/mysticweb/node/bin/node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100
