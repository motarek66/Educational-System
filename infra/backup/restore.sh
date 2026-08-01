#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
FILE="${1:?Usage: restore.sh <backup.dump>}"

pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$DATABASE_URL" "$FILE"
echo "Restore completed from: $FILE"
