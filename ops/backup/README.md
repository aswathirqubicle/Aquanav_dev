# Offsite backup

Encrypted database and upload backups pushed to the client's FTP backup account
by a systemd timer on the host. The app does not run these; it only reports
what they last recorded (Settings → System → Offsite Backup, admin only).

## What runs when

| Job | Schedule | Contents | Remote file |
|---|---|---|---|
| `db` | daily 00:30 (host time) | `pg_dump -Fc` of `aquanav_uae` and `aquanav_uae_staging`, plus a `TAKEN_AT` marker | `/aquanav/db.tar.age` |
| `uploads` | Sunday 03:00 | the whole `uploads` tree (~5 GB) | `/aquanav/uploads.tar.age` |

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

Fetch `db.tar.age` from the FTP account, then, with the private key to hand:

```bash
age -d -i ~/aquanav-backup.key db.tar.age | tar -xf - -C /tmp/restore
ls /tmp/restore          # uae.dump, uae-staging.dump, TAKEN_AT
pg_restore -d "$DATABASE_URL" --no-owner --no-privileges /tmp/restore/uae.dump
```

Restore into a **new** database first and check it, rather than over a live
one. Uploads restore the same way: `age -d` then `tar -xf -` into place.

## Status file

Each run writes `/srv/aquanav/backups/status.json` (mode 644, written
atomically), recording per job whether it succeeded, when it finished, the
archive size, the remote path and any failure message. Failures are recorded
too — a page that only ever showed successes would make silence look like
health. `server/lib/backup-status.ts` reads it and flags a job as overdue after
36 hours (`db`) or 10 days (`uploads`). Override the path with
`BACKUP_STATUS_PATH` if the layout differs.

## Known limits

- **One copy per job.** If data is corrupted or deleted and nobody notices for
  a day, the only backup has already been replaced. Keeping a second weekly
  copy is a small change to `publish`.
- **Uploads go as a full archive**, not incrementally — about 5 GB a week.
  Incremental transfer would need rsync over SSH, which this FTP account does
  not offer.
- **The backup host shares a provider with nothing else here**, but verify it
  is not the same datacentre as production if that matters to the client.
