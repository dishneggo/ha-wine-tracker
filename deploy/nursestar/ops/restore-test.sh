#!/bin/sh
# Restore the latest restic snapshot into a temp dir and check it against
# the live data. Exits non-zero on any failure. Read-only for live data.
set -eu

WT_ROOT=${WT_ROOT:-/opt/nursestar/wine-tracker}
BACKUP_ENV=${BACKUP_ENV:-/root/.config/wine-backup.env}
LIVE_DB="$WT_ROOT/data/wine-tracker/wine.db"
LIVE_UPLOADS="$WT_ROOT/data/wine-tracker/uploads"

set -a
# shellcheck disable=SC1090
. "$BACKUP_ENV"
set +a

target=$(mktemp -d /tmp/wine-restore.XXXXXX)
trap 'rm -rf "$target"' EXIT

restic snapshots --tag nightly --host wine-tracker --latest 1
restic restore latest --tag nightly --host wine-tracker --target "$target"

restored_db=$(find "$target" -type f -name 'wine-*.db' | sort | tail -n 1)
[ -n "$restored_db" ] || { echo "restore-test: no DB in snapshot" >&2; exit 1; }

python3 - "$restored_db" "$LIVE_DB" <<'PY'
import sqlite3, sys
restored, live = sys.argv[1], sys.argv[2]
r = sqlite3.connect(f"file:{restored}?mode=ro", uri=True)
ok = r.execute("PRAGMA integrity_check").fetchone()[0]
if ok != "ok":
    sys.exit(f"restore-test: integrity_check on restored DB: {ok}")
rc = r.execute("SELECT COUNT(*) FROM wines").fetchone()[0]
try:
    l = sqlite3.connect(f"file:{live}?mode=ro", uri=True)
    lc = l.execute("SELECT COUNT(*) FROM wines").fetchone()[0]
except sqlite3.Error as e:
    lc = None
    print(f"restore-test: live DB not readable ({e}), skipping comparison")
print(f"restore-test: restored wines={rc} live wines={lc}")
if lc is not None and abs(lc - rc) > max(5, lc // 10):
    sys.exit("restore-test: row count differs by more than a day's edits")
PY

restored_uploads=$(find "$target" -path '*uploads*' -type f | wc -l)
live_uploads=0
[ -d "$LIVE_UPLOADS" ] && live_uploads=$(find "$LIVE_UPLOADS" -type f | wc -l)
echo "restore-test: restored uploads=$restored_uploads live uploads=$live_uploads"
if [ "$live_uploads" -gt 0 ] && [ "$restored_uploads" -eq 0 ]; then
    echo "restore-test: uploads missing from snapshot" >&2
    exit 1
fi
echo "restore-test: ok"
