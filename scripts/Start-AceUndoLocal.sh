#!/usr/bin/env bash
# Launch the standalone UNDO window against a running local Vite server.
# Does not start Backend, Worker, or Frontend.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXE="$ROOT/undo-shell/bin/AceUndo"

find_vite() {
  local host port
  for host in localhost 127.0.0.1; do
    for port in $(seq 3000 3010); do
      if curl -fsS --max-time 2 "http://${host}:${port}/src/services/backendUrl.js" | grep -q "LOCAL_BACKEND_URL"; then
        echo "${host}:${port}"
        return 0
      fi
    done
  done
  return 1
}

if [[ ! -x "$EXE" ]]; then
  echo "UNDO shell is not built yet. Building..."
  bash "$ROOT/scripts/Build-AceUndoMac.sh"
fi

FOUND="$(find_vite || true)"
if [[ -z "$FOUND" ]]; then
  echo "Local Vite is not running. Start the frontend first, then run this script." >&2
  echo "This script does not start Backend, Worker, or Frontend." >&2
  exit 1
fi

URL="http://${FOUND}/#/local-undo"
echo "Opening UNDO: $URL"
exec "$EXE" --url "$URL"
