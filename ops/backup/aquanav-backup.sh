#!/bin/bash
# Offsite backup for an Aquanav host.
#
#   aquanav-backup.sh db        every night: both databases
#   aquanav-backup.sh uploads   weekly: the uploads tree (several GB)
#
# WHY IT LOOKS LIKE THIS
#
# The destination is an FTP account, which is all the client's backup host
# offers. Two consequences shape the script:
#
#  * Everything is encrypted with age BEFORE it leaves the machine. FTP sends
#    credentials in clear, the server's certificate does not match the IP we
#    address it by, and the dumps contain salaries and bank details. The
#    channel is still TLS where the server accepts it, but the file's safety
#    does not depend on that.
#  * The age PRIVATE key is deliberately NOT on this machine. Only the public
#    key is, so a compromised host (or FTP account) yields ciphertext. Losing
#    the private key means losing every backup: it belongs in a password
#    manager, nowhere else.
#
# One copy is kept per kind and each run replaces it, as the client asked. The
# new file is uploaded under a .part name and swapped in only after its size is
# verified, so an interrupted transfer leaves the previous backup intact rather
# than destroying it.
#
# RESTORE
#   age -d -i <private-key-file> db.tar.age | tar -xf - -C /tmp/restore
#   pg_restore -d "<DATABASE_URL>" --no-owner --no-privileges /tmp/restore/uae.dump
set -euo pipefail

MODE=${1:-db}
CONF=/etc/aquanav-backup.env
STAGE=/srv/aquanav/backups/offsite
STATUS=/srv/aquanav/backups/status.json

[ -r "$CONF" ] || { echo "FATAL: $CONF missing - backup not configured yet"; exit 78; }

# Parsed literally, never sourced: a password may contain spaces, quotes, $ or
# backticks, and sourcing would split or expand them.
read_conf() { sed -n "s/^$1=//p" "$CONF" | tail -1; }
FTP_HOST=$(read_conf FTP_HOST); FTP_USER=$(read_conf FTP_USER)
FTP_PASS=$(read_conf FTP_PASS); AGE_RECIPIENT=$(read_conf AGE_RECIPIENT)
for v in FTP_HOST FTP_USER FTP_PASS AGE_RECIPIENT; do
  [ -n "${!v:-}" ] || { echo "FATAL: $v not set in $CONF"; exit 78; }
done

mkdir -p "$STAGE"

# The Settings page reads this file, so record the outcome of every run,
# failures included - a backup page that only reports successes is worse than
# none, because silence looks like health.
write_status() { # write_status <ok:true|false> <message> [bytes] [remote]
  python3 - "$STATUS" "$MODE" "$1" "$2" "${3:-}" "${4:-}" <<'PY'
import json, os, sys, datetime
path, job, ok, message, size, remote = sys.argv[1:7]
data = {}
if os.path.exists(path):
    try:
        with open(path) as fh:
            loaded = json.load(fh)
        if isinstance(loaded, dict):
            data = loaded
    except Exception:
        data = {}          # a corrupt file must not stop us recording this run
data[job] = {
    "ok": ok == "true",
    "finished_at": datetime.datetime.now(datetime.timezone.utc)
        .isoformat(timespec="seconds").replace("+00:00", "Z"),
    "bytes": int(size) if size else None,
    "remote": remote or None,
    "message": message or None,
}
tmp = path + ".tmp"
with open(tmp, "w") as fh:
    json.dump(data, fh, indent=2, sort_keys=True)
os.replace(tmp, path)       # atomic: the app may read this at any moment
os.chmod(path, 0o644)       # the app runs as a different user and must read it
PY
}

# Any unplanned exit is a failed run, and the page should say so.
FAILED_MESSAGE="interrupted before completion"
on_exit() {
  local rc=$?
  [ "$rc" -eq 0 ] || write_status false "$FAILED_MESSAGE (exit $rc)" || true
}
trap on_exit EXIT

ftp_do() { # ftp_do <ssl-force> <commands>
  # The password goes through the environment (--env-password), never on the
  # command line: argv is world-readable through `ps`, so a credential there
  # leaks to every local user and into any log that captures a process list.
  #
  # verify-certificate is off because the host is addressed by IP and its
  # certificate names something else. The channel is still TLS-encrypted; an
  # active man-in-the-middle could see the FTP password, but never the backup,
  # which is encrypted before it leaves this machine.
  LFTP_PASSWORD="$FTP_PASS" lftp -c "set ssl:verify-certificate no; set ftp:ssl-force $1; set ftp:ssl-protect-data true; set net:max-retries 2; set net:timeout 60; open -u '$FTP_USER' --env-password '$FTP_HOST'; $2; bye"
}

publish() { # publish <localfile> <remotedir> <remotename>
  local f=$1 dir=$2 name=$3 tls=true
  if ! ftp_do true "mkdir -p $dir; cd $dir; put '$f' -o $name.part" 2>/dev/null; then
    echo 'WARNING: FTPS refused, falling back to plain FTP (payload stays encrypted)'
    tls=false
    ftp_do false "mkdir -p $dir; cd $dir; put '$f' -o $name.part"
  fi
  local local_size remote_size
  local_size=$(stat -c%s "$f")
  # LIST output field 5 is bytes. lftp's own `cls --size` rounds to KiB, which
  # makes a perfectly good upload look like a size mismatch.
  remote_size=$(ftp_do $tls "cd $dir; ls $name.part" 2>/dev/null | awk 'NF>=5 {print $5}' | tail -1)
  if [ "${remote_size:-0}" != "$local_size" ]; then
    FAILED_MESSAGE="upload incomplete: local $local_size bytes, remote ${remote_size:-none}. Previous backup kept."
    echo "FATAL: $FAILED_MESSAGE"
    exit 1
  fi
  echo "verified $local_size bytes on remote"
  # Swap in only now that the new file is known to be complete.
  ftp_do $tls "cd $dir; rm -f $name; mv $name.part $name"
  echo "published $dir/$name"
}

case "$MODE" in
  db)
    OUT=$STAGE/aquanav-db.tar.age
    TMP=$(mktemp -d); trap 'rm -rf "$TMP"; on_exit' EXIT
    for env in uae uae-staging; do
      [ -r "/srv/aquanav/$env/.env" ] || continue
      ( set -a; . "/srv/aquanav/$env/.env"; set +a
        pg_dump -Fc "$DATABASE_URL" -f "$TMP/$env.dump" )
      echo "dumped $env: $(stat -c%s "$TMP/$env.dump") bytes"
    done
    date -Is > "$TMP/TAKEN_AT"
    tar -cf - -C "$TMP" . | age -r "$AGE_RECIPIENT" -o "$OUT"
    echo "encrypted $(stat -c%s "$OUT") bytes"
    publish "$OUT" /aquanav db.tar.age
    write_status true "" "$(stat -c%s "$OUT")" /aquanav/db.tar.age
    ;;
  uploads)
    OUT=$STAGE/aquanav-uploads.tar.age
    tar -cf - -C /srv/aquanav/uae uploads | age -r "$AGE_RECIPIENT" -o "$OUT"
    echo "encrypted $(stat -c%s "$OUT") bytes"
    publish "$OUT" /aquanav uploads.tar.age
    write_status true "" "$(stat -c%s "$OUT")" /aquanav/uploads.tar.age
    ;;
  *) echo "usage: $0 db|uploads"; exit 2 ;;
esac

echo "OK $MODE $(date -Is)"
