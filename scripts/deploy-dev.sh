#!/usr/bin/env bash
# Builds and pushes the next "Wine Tracker (Dev)" add-on iteration:
# runs the tests, syncs wine-tracker/ into wine-tracker-dev/ with the next
# -dev.N version, prepends auto-generated dev release notes to the dev
# CHANGELOG (shown in the HA add-on store) and commits + pushes.
# Usage: scripts/deploy-dev.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: working tree not clean - commit or stash first." >&2
  exit 1
fi

.venv/bin/python -m pytest wine-tracker/tests/ -q

BASE=$(sed -n 's/^version: "\(.*\)"$/\1/p' wine-tracker/config.yaml)
PREV=$(sed -n 's/^version: "\(.*\)"$/\1/p' wine-tracker-dev/config.yaml 2>/dev/null || true)
if [[ "$PREV" == "$BASE-dev."* ]]; then
  N=$(( ${PREV##*.} + 1 ))
else
  N=1
fi
VERSION="$BASE-dev.$N"

LAST_SYNC=$(git log -1 --format=%H -- wine-tracker-dev 2>/dev/null || true)
if [ -n "$LAST_SYNC" ]; then
  NOTES=$(git log "$LAST_SYNC"..HEAD --no-merges --pretty='- %s' -- wine-tracker)
else
  NOTES="- Initial dev build"
fi
if [ -z "$NOTES" ]; then
  NOTES="- No app changes since the last dev build (tooling only)"
fi

./scripts/sync-dev-addon.sh "dev.$N"

{
  echo "# Changelog"
  echo
  echo "## $VERSION"
  echo
  echo "$NOTES"
  echo
  tail -n +2 wine-tracker/CHANGELOG.md
} > wine-tracker-dev/CHANGELOG.md

git add wine-tracker-dev
git commit -m "Dev release $VERSION"
git push

echo
echo "Dev add-on $VERSION pushed - in HA: Add-on Store -> check for updates -> update Wine Tracker (Dev)."
