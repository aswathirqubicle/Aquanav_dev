# Offsite backup

Encrypted database and upload backups pushed to the client's FTP backup account
by a systemd timer on the host. The app does not run these; it only reports
what they last recorded (Settings → System → Offsite Backup, admin only).

## What runs when

| Job | Schedule | Contents | Remote file |
|---|---|---|---|
| `db` | daily 00:30 (host time) | `pg_dump -Fc` of `aquanav_uae` and `aquanav_uae_staging`, plus a `TAKEN_AT` marker | `/aquanav/db.tar.age` |
| `uploads` | daily 00:45 (host time) | the whole `uploads` tree (~5 GB) | `/aquanav/uploads.tar.age` |

One copy per job; each run replaces it. The new file is uploaded as
`<name>.part`, its size verified against the local file, and only then moved
over the old one — an interrupted transfer leaves the previous backup intact.

## Encryption, and the key you must not lose

Each archive is encrypted with [age](https://age-encryption.org) before it
leaves the host. Only the **public** key sits on the server, so a compromised
server or FTP account yields ciphertext and nothing else.

The **private key is not on the server by design.** It lives in the
administrator's password manager. Lose it and every backup becomes permanently
unreadable — there is no recovery path, and that is the trade for FTP being the
only available transport.

Why the local encryption matters: FTP sends credentials in clear text, and the
backup host's TLS certificate does not match the IP it is addressed by, so
certificate verification is disabled. The transport is TLS where the server
accepts it, but the archive's safety does not rely on that.

## Install

```bash
sudo install -m 750 ops/backup/aquanav-backup.sh /usr/local/bin/aquanav-backup.sh
sudo install -m 644 ops/backup/aquanav-backup-*.service ops/backup/aquanav-backup-*.timer /etc/systemd/system/
sudo install -m 600 ops/backup/aquanav-backup.env.example /etc/aquanav-backup.env
sudo nano /etc/aquanav-backup.env        # fill in FTP details and the age public key
sudo systemctl daemon-reload
sudo systemctl enable --now aquanav-backup-db.timer aquanav-backup-uploads.timer
```

Requires `age` and `lftp` (`apt-get install age lftp`).

Run either job by hand to check it:

```bash
sudo /usr/local/bin/aquanav-backup.sh db
systemctl list-timers 'aquanav-*'
journalctl -u aquanav-backup-db.service -n 50
```

## Restore

Both routes need the archive decrypted first, because the server has no
private key:

```bash
age -d -i ~/aquanav-backup.key db.tar.age | tar -xf - -C /tmp/restore
ls /tmp/restore          # uae.dump, uae-staging.dump, TAKEN_AT
```

### From the app, pulling from the backup account (the normal route)

**Settings → System → Restore From Offsite Backup.** The admin enters the
backup account's host, username and password, pastes the age **private** key,
chooses database and/or files, and types `REPLACE ALL DATA`.

The server then does the work over its own link: fetches the archives, decrypts
them with the supplied key, and restores. The browser never carries the 5 GB
uploads archive, and nothing is kept — the credentials and key are used for
that one request and discarded. The app deliberately cannot read
`/etc/aquanav-backup.env` (root-only), so compromising the app does not reach
the backup account.

Safety copies are taken first: the database as `pre-restore-<stamp>.dump`, and
the uploads tree renamed to `uploads.pre-restore-<stamp>` beside it — instant on
the same filesystem, and reversible by renaming it back. If extraction fails,
the previous files are put back automatically.

Restore **both halves together**. The two archives are written minutes apart
each night (00:30 and 00:45), so they pair cleanly; restoring a database
without its files leaves photo records pointing at files that aren't there.

### From the app, uploading a dump you already hold

An admin uploads `uae.dump`, types `REPLACE ALL DATA`, and confirms. The server
takes a safety dump to `/srv/aquanav/backups/pre-restore-<stamp>.dump`, then
runs `pg_restore --clean --if-exists --single-transaction`. Because it is one
transaction, a failure rolls back and leaves the live data untouched; the only
outcomes are "replaced" and "nothing happened". Every attempt is appended to
`/srv/aquanav/backups/restore-audit.log`, which survives the restore because
it is a file rather than a table.

This exists so the client can recover without waiting for anyone. What it
cannot do is protect against a correct-but-unwanted restore: if someone
uploads last month's backup and confirms, a month of work is gone until an
administrator restores the safety dump by hand.

### From the command line

```bash
pg_restore -d "$DATABASE_URL" --clean --if-exists --single-transaction \
  --no-owner --no-privileges /tmp/restore/uae.dump
```

To inspect a backup without touching live data, restore it into a scratch
database instead: `createdb check_restore && pg_restore -d check_restore ...`.

Uploads restore the same way: `age -d` then `tar -xf -` into place.

## Status file

Each run writes `/srv/aquanav/backups/status.json` (mode 644, written
atomically), recording per job whether it succeeded, when it finished, the
archive size, the remote path and any failure message. Failures are recorded
too — a page that only ever showed successes would make silence look like
health. `server/lib/backup-status.ts` reads it and flags a job as overdue after
36 hours (`db`) or 10 days (`uploads`). Override the path with
`BACKUP_STATUS_PATH` if the layout differs.

## Scratch space

Restores download and unpack under `/srv/aquanav/backups/restore-work`, on real
disk. Not `/tmp`: the app's systemd units set `PrivateTmp=true`, which gives
each service a RAM-backed tmpfs of a few GB, and writing a 5 GB archive there
would consume the server's memory rather than its disk. Allow roughly three
times the archive size free — the download, the decrypted tar, and the
extracted tree.

A database restore picks the dump matching the database it is connected to
(`uae-staging.dump` on staging, `uae.dump` on production), falling back to
`uae.dump`, so restoring on staging does not overwrite it with production data.

## Known limits

- **One copy per job.** If data is corrupted or deleted and nobody notices for
  a day, the only backup has already been replaced. Keeping a second weekly
  copy is a small change to `publish`.
- **Uploads go as a full archive**, not incrementally — about 5 GB a night.
  Incremental transfer would need rsync over SSH, which this FTP account does
  not offer.
- **The backup host shares a provider with nothing else here**, but verify it
  is not the same datacentre as production if that matters to the client.
