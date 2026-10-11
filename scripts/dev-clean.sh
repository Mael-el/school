#!/usr/bin/env bash
# Stops this project's Electron Forge / Vite processes only.
# Do not match generic "Electron.app" — that would also kill Cursor.

set +e

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"

PATTERNS=(
  'electron-forge start'
  "Electron.*${APP_DIR}"
  "electron .*${APP_DIR}"
  'complex-scolaire/app/.vite'
)

stopped=0

for pattern in "${PATTERNS[@]}"; do
  if pgrep -f "$pattern" >/dev/null 2>&1; then
    pkill -f "$pattern" 2>/dev/null
    echo "Stopped processes matching: $pattern"
    stopped=$((stopped + 1))
  fi
done

sleep 1

if [ -d "$APP_DIR/.vite/build" ]; then
  rm -rf "$APP_DIR/.vite/build"
  echo "Cleared stale Vite main/preload build."
fi

if [ "$stopped" -eq 0 ]; then
  echo 'No leftover project Electron processes. Starting a fresh build.'
else
  echo 'Old processes stopped. Next: npm start'
fi
