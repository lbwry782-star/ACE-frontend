#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/undo-shell/bin"
SRC="$ROOT/undo-shell/macos/main.swift"
OUT="$OUT_DIR/AceUndo"

if ! command -v swiftc >/dev/null 2>&1; then
  echo "swiftc was not found. Install Xcode Command Line Tools, then retry. No automatic install was performed." >&2
  exit 2
fi

mkdir -p "$OUT_DIR"
swiftc -O -o "$OUT" -framework Cocoa -framework WebKit "$SRC"
echo "Built $OUT"
