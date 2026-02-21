#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ASSETS_DIR="$SCRIPT_DIR/../assets"
APP_DIR="$SCRIPT_DIR/../app"
URL="https://www.data.gouv.fr/api/1/datasets/r/092bd7bb-1543-405b-b53c-932ebb49bb8e"
DEST="$ASSETS_DIR/deputes-active.csv"

echo "Downloading deputes-active.csv..."
wget -q -O "$DEST" "$URL"
echo "Downloaded: $DEST"

echo "Updating database..."
cd "$APP_DIR"
npm run db:seed-deputes
echo "Database updated."
