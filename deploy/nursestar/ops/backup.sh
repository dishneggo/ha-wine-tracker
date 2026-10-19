#!/bin/sh
# Nightly off-server backup of the Wine Tracker SQLite DB and uploads to
# Cloudflare R2 (S3 API) with restic. Client-side encrypted.
#
# Credentials: /root/.config/wine-backup.env (root:root 0600) with
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, RESTIC_REPOSITORY, RESTIC_PASSWORD
# See deploy/nursestar/backup.env.example.
set -eu

WT_ROOT=${WT_ROOT:-/opt/nursestar/wine-tracker}
BACKUP_ENV=${BACKUP_ENV:-/root/.config/wine-backup.env}
DB="$WT_ROOT/data/wine-tracker/wine.db"
UPLOADS="$WT_ROOT/data/wine-tracker/uploads"
SNAPDIR="$WT_ROOT/backups"

[ -r "$BACKUP_ENV" ] || { echo "backup: $BACKUP_ENV not readable" >&2; exit 1; }
set -a
# shellcheck disable=SC1090
. "$BACKUP_ENV"
set +a
: "${RESTIC_REPOSITORY:?missing in $BACKUP_ENV}"
: "${RESTIC_PASSWORD:?missing in $BACKUP_ENV}"

[ -f "$DB" ] || { echo "backup: database $DB not found" >&2; exit 1; }
mkdir -p "$SNAPDIR"
chmod 700 "$SNAPDIR"
snap="$SNAPDIR/wine-$(date +%Y%m%d-%H%M%S).db"

# Consistent copy through SQLite's online backup API (safe while the app runs).
python3 - "$DB" "$snap" <<'PY'
import sqlite3, sys
src = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
dst = sqlite3.connect(sys.argv[2])
with dst:
    src.backup(dst)
ok = dst.execute("PRAGMA integrity_check").fetchone()[0]
dst.close()
src.close()
if ok != "ok":
    print(f"backup: integrity_check failed: {ok}", file=sys.stderr)
    sys.exit(1)
PY
chmod 600 "$snap"

paths="$snap"
[ -d "$UPLOADS" ] && paths="$paths $UPLOADS"
# shellcheck disable=SC2086
restic backup --tag nightly --host wine-tracker $paths
restic forget --tag nightly --host wine-tracker \
    --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --prune

# Keep three days of local snapshots for quick rollbacks.
find "$SNAPDIR" -name 'wine-*.db' -type f -mtime +3 -delete
echo "backup: ok $(basename "$snap")"
