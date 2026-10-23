#!/usr/bin/env bash
# Launch the standalone LOCAL window against a running local Vite server.
# Does not start Backend, Worker, or Frontend.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXE="$ROOT/undo-shell/bin/AceUndo"
PREFERRED_PORT=3000
PORT_SCAN_MAX=3010
VITE_PORT=""

usage_error() {
  echo "$1" >&2
  echo "This script does not start Backend, Worker, or Frontend." >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -VitePort|--VitePort)
      if [[ $# -lt 2 ]]; then
        usage_error "VitePort requires a value in the range ${PREFERRED_PORT}-${PORT_SCAN_MAX}."
      fi
      VITE_PORT="$2"
      shift 2
      ;;
    -VitePort=*|--VitePort=*)
      VITE_PORT="${1#*=}"
      shift
      ;;
    *)
      usage_error "Unknown argument: $1"
      ;;
  esac
done

test_ace_frontend_vite() {
  local port="$1"
  local host="$2"
  curl -fsS --max-time 2 "http://${host}:${port}/src/services/backendUrl.js" 2>/dev/null | grep -q "LOCAL_BACKEND_URL"
}

find_vite() {
  local host port
  for host in localhost 127.0.0.1; do
    for port in $(seq "$PREFERRED_PORT" "$PORT_SCAN_MAX"); do
      if test_ace_frontend_vite "$port" "$host"; then
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

if [[ -n "$VITE_PORT" ]]; then
  if ! [[ "$VITE_PORT" =~ ^[0-9]+$ ]] || (( VITE_PORT < PREFERRED_PORT || VITE_PORT > PORT_SCAN_MAX )); then
    usage_error "VitePort must be an integer in the range ${PREFERRED_PORT}-${PORT_SCAN_MAX}. Received: ${VITE_PORT}"
  fi
  if ! test_ace_frontend_vite "$VITE_PORT" "localhost"; then
    usage_error "No ACE-FRONTEND Vite server is running on localhost:${VITE_PORT}."
  fi
  FOUND="localhost:${VITE_PORT}"
else
  FOUND="$(find_vite || true)"
  if [[ -z "$FOUND" ]]; then
    usage_error "Local Vite is not running. Start the frontend first, then run this script."
  fi
fi

URL="http://${FOUND}/#/local-undo"
echo "Opening LOCAL: $URL"
exec "$EXE" --url "$URL"
