/**
 * Restoring from the offsite backup account, pulled by the server itself.
 *
 * The archives are several gigabytes, so the browser never carries them: the
 * admin supplies the backup account's details and the age private key for one
 * operation, and the server fetches, decrypts and restores over its own link.
 *
 * NOTHING HERE IS STORED. The FTP credentials and the private key arrive with
 * the request, are used, and are gone. The app deliberately cannot read
 * /etc/aquanav-backup.env (root-only, for the backup job), so an attacker who
 * compromises the application still cannot reach the backup account or read a
 * single archive.
 */
import { execFile, spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import { restoreFromDump } from "./db-restore";

const execFileAsync = promisify(execFile);

/** Remote layout written by ops/backup/aquanav-backup.sh. */
export const REMOTE_DIR = "/aquanav";
export const REMOTE_FILES: Record<RestorePart, string> = {
  db: "db.tar.age",
  uploads: "uploads.tar.age",
};

export type RestorePart = "db" | "uploads";

/**
 * Which dump inside db.tar.age belongs to a given database. The archive holds
 * one per environment, named after its directory (uae.dump, uae-staging.dump),
 * so staging restores staging rather than overwriting itself with production.
 */
export function dumpNameForDatabase(databaseName: string): string {
  const env = databaseName.replace(/^aquanav_/, "").replace(/_/g, "-");
  return `${env || "uae"}.dump`;
}

export interface OffsiteCredentials {
  host: string;
  user: string;
  password: string;
}

export interface RemoteFile {
  name: string;
  bytes: number;
  modified: string | null;
}

/** An age private key, as `age-keygen` prints it. */
export function assertAgeIdentity(identity: string): void {
  const trimmed = identity.trim();
  if (!trimmed) throw new Error("The backup key is required to decrypt an archive");
  if (trimmed.startsWith("age1") && !trimmed.includes("AGE-SECRET-KEY-")) {
    throw new Error(
      "That looks like the public key (age1...). Decryption needs the private " +
        "key, the line beginning AGE-SECRET-KEY-.",
    );
  }
  if (!/AGE-SECRET-KEY-1[0-9A-Z]+/i.test(trimmed)) {
    throw new Error(
      "That is not an age private key. Paste the line beginning " +
        "AGE-SECRET-KEY- from your backup key file.",
    );
  }
}

export function assertCredentials(c: Partial<OffsiteCredentials>): OffsiteCredentials {
  for (const field of ["host", "user", "password"] as const) {
    if (!c[field]?.trim()) {
      throw new Error(`The backup account's ${field} is required`);
    }
  }
  // A host with a scheme or path would be passed to lftp verbatim and fail
  // obscurely; say so plainly instead.
  const host = c.host!.trim().replace(/^ftps?:\/\//i, "").replace(/\/.*$/, "");
  if (!host) throw new Error("The backup account's host is required");
  return { host, user: c.user!.trim(), password: c.password! };
}

/**
 * Parse an FTP LIST listing into files. Field 5 is the size and field 9 on is
 * the name; anything that does not match that shape is skipped rather than
 * guessed at.
 */
export function parseRemoteListing(listing: string): RemoteFile[] {
  const files: RemoteFile[] = [];
  for (const line of listing.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 9 || line.startsWith("d")) continue;
    const bytes = Number(parts[4]);
    const name = parts.slice(8).join(" ");
    if (!Number.isFinite(bytes) || !name || name === "." || name === "..") continue;
    files.push({
      name,
      bytes,
      modified: parts.slice(5, 8).join(" ") || null,
    });
  }
  return files;
}

/** lftp invocation shared by listing and fetching. */
async function lftp(
  creds: OffsiteCredentials,
  commands: string,
): Promise<string> {
  // The password goes in the environment, never argv, which `ps` exposes.
  const script = [
    "set ssl:verify-certificate no",
    "set ftp:ssl-force true",
    "set ftp:ssl-protect-data true",
    "set net:max-retries 2",
    "set net:timeout 60",
    `open -u '${creds.user}' --env-password '${creds.host}'`,
    commands,
    "bye",
  ].join("; ");
  const { stdout } = await execFileAsync("lftp", ["-c", script], {
    env: { ...process.env, LFTP_PASSWORD: creds.password },
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout;
}

export async function listOffsiteBackups(
  creds: OffsiteCredentials,
): Promise<RemoteFile[]> {
  let listing: string;
  try {
    listing = await lftp(creds, `cd ${REMOTE_DIR}; ls -la`);
  } catch (err: any) {
    const detail = (err?.stderr || err?.message || "").trim();
    if (/Login failed|530/i.test(detail)) {
      throw new Error("The backup account rejected those details");
    }
    if (/No such file|550/i.test(detail)) {
      throw new Error(
        `Connected, but ${REMOTE_DIR} does not exist on that account — no backup has been uploaded to it`,
      );
    }
    throw new Error(`Could not reach the backup account: ${detail || "unknown error"}`);
  }
  return parseRemoteListing(listing).filter((f) =>
    Object.values(REMOTE_FILES).includes(f.name),
  );
}

export interface OffsiteRestoreOptions {
  credentials: OffsiteCredentials;
  identity: string;
  parts: RestorePart[];
  /**
   * Scratch space for the downloaded archives. Must be on real disk: the
   * service runs with PrivateTmp=true, so /tmp is a RAM-backed tmpfs of a few
   * GB and a 5 GB archive written there would consume the server's memory.
   */
  workDir: string;
  /** The app's working directory; `uploads` sits inside it. */
  appDir: string;
  databaseUrl: string;
  backupDir: string;
  auditPath: string;
  actor: string;
  now?: Date;
}

export interface OffsiteRestoreResult {
  parts: RestorePart[];
  /** Which dump inside the archive was restored. */
  databaseDumpUsed?: string;
  databaseSafetyDump?: string;
  uploadsSafetyDir?: string;
  filesRestored?: number;
  warnings: string[];
}

/** Free bytes on the filesystem holding `dir`, or null if it cannot be read. */
async function freeBytes(dir: string): Promise<number | null> {
  try {
    const s: any = await (fs as any).statfs(dir);
    return Number(s.bsize) * Number(s.bavail);
  } catch {
    return null;
  }
}

/**
 * Pull the requested archives, decrypt them and restore. Both halves get a
 * safety copy first: the database as a dump, the uploads tree as a renamed
 * directory (instant, same filesystem, and trivially reversible).
 */
/**
 * Decrypt with the key passed through a FIFO rather than a file.
 *
 * A private key written to disk outlives a crash: an earlier version wrote it
 * to the work directory, and a service restart during a restore left it there
 * for twenty minutes. A FIFO holds no data on disk — the bytes pass through
 * kernel memory between the two processes — so the worst a crash can leave
 * behind is an empty pipe.
 */
async function decryptWithIdentity(
  identity: string,
  archivePath: string,
  outPath: string,
  fifoDir: string,
): Promise<void> {
  const fifo = path.join(fifoDir, "identity.fifo");
  await execFileAsync("mkfifo", ["-m", "600", fifo]);
  try {
    const age = spawn("age", ["-d", "-i", fifo, "-o", outPath, archivePath], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    age.stderr.on("data", (c) => {
      stderr += c.toString();
    });

    // Opening a FIFO for writing blocks until the reader opens it, so this has
    // to happen after age is spawned.
    const writing = fs
      .writeFile(fifo, identity.trim() + "\n")
      .catch(() => {
        /* age exited before reading; its own error is the useful one */
      });

    const code: number = await new Promise((resolve, reject) => {
      age.once("error", reject);
      age.once("close", resolve);
    });
    await writing;

    if (code !== 0) {
      const detail = stderr.trim();
      throw new Error(
        /no identity matched|failed to decrypt/i.test(detail)
          ? `That key cannot decrypt ${path.basename(archivePath)}. It must be the key the backups were made with.`
          : `Could not decrypt ${path.basename(archivePath)}: ${detail || `age exited with ${code}`}`,
      );
    }
  } finally {
    await fs.rm(fifo, { force: true }).catch(() => {});
  }
}

/**
 * Remove anything a previous restore left behind. A killed process — a deploy
 * mid-restore, an OOM, a reboot — skips its own cleanup, and a half-downloaded
 * 5 GB archive should not sit there until someone notices.
 */
export async function sweepRestoreWorkDir(workDir: string): Promise<number> {
  let removed = 0;
  let entries: string[];
  try {
    entries = await fs.readdir(workDir);
  } catch {
    return 0;
  }
  for (const entry of entries) {
    if (!entry.startsWith("offsite-") && !entry.startsWith("aquanav-restore-")) continue;
    await fs.rm(path.join(workDir, entry), { recursive: true, force: true }).catch(() => {});
    removed += 1;
  }
  return removed;
}

export async function restoreFromOffsite(
  opts: OffsiteRestoreOptions,
): Promise<OffsiteRestoreResult> {
  const now = opts.now ?? new Date();
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
  const creds = assertCredentials(opts.credentials);
  assertAgeIdentity(opts.identity);
  if (opts.parts.length === 0) {
    throw new Error("Choose what to restore: the database, the files, or both");
  }

  await fs.mkdir(opts.workDir, { recursive: true });
  const work = await fs.mkdtemp(path.join(opts.workDir, "offsite-"));

  const result: OffsiteRestoreResult = { parts: opts.parts, warnings: [] };

  try {
    const available = await listOffsiteBackups(creds);
    for (const part of opts.parts) {
      const wanted = REMOTE_FILES[part];
      const found = available.find((f) => f.name === wanted);
      if (!found) {
        throw new Error(
          `${wanted} is not on the backup account, so ${part === "db" ? "the database" : "the files"} cannot be restored`,
        );
      }
      // Downloaded archive, plus its decrypted form, plus the extracted tree.
      const free = await freeBytes(work);
      if (free !== null && free < found.bytes * 3) {
        throw new Error(
          `Not enough free disk space: ${wanted} needs roughly ${Math.ceil((found.bytes * 3) / 1e9)} GB free to restore and only ${Math.floor(free / 1e9)} GB is available`,
        );
      }

      const archive = path.join(work, wanted);
      await lftp(creds, `cd ${REMOTE_DIR}; get ${wanted} -o '${archive}'`);
      const tarPath = archive.replace(/\.age$/, "");
      await decryptWithIdentity(opts.identity, archive, tarPath, work);
      await fs.rm(archive, { force: true });

      if (part === "db") {
        const extracted = path.join(work, "db");
        await fs.mkdir(extracted, { recursive: true });
        await execFileAsync("tar", ["-xf", tarPath, "-C", extracted]);
        // Prefer this environment's own dump; fall back to production's, which
        // is what a single-environment archive will contain.
        const dbName = new URL(opts.databaseUrl).pathname.replace(/^\//, "");
        const candidates = [dumpNameForDatabase(dbName), "uae.dump"];
        let dumpPath = "";
        for (const candidate of candidates) {
          const p = path.join(extracted, candidate);
          try {
            await fs.access(p);
            dumpPath = p;
            break;
          } catch {
            /* try the next name */
          }
        }
        if (!dumpPath) {
          const found = (await fs.readdir(extracted)).join(", ");
          throw new Error(
            `Neither ${candidates.join(" nor ")} is in that archive (it holds: ${found})`,
          );
        }
        result.databaseDumpUsed = path.basename(dumpPath);
        const dbResult = await restoreFromDump({
          dumpPath,
          databaseUrl: opts.databaseUrl,
          backupDir: opts.backupDir,
          auditPath: opts.auditPath,
          actor: opts.actor,
          now,
        });
        result.databaseSafetyDump = dbResult.safetyDumpPath;
        if (dbResult.warnings) result.warnings.push(dbResult.warnings);
      } else {
        const uploads = path.join(opts.appDir, "uploads");
        const safety = path.join(opts.appDir, `uploads.pre-restore-${stamp}`);
        let moved = false;
        try {
          await fs.rename(uploads, safety);
          moved = true;
        } catch (err: any) {
          if (err?.code !== "ENOENT") throw err; // nothing to preserve is fine
        }
        try {
          // The archive carries a leading `uploads/`, so it unpacks into place.
          await execFileAsync("tar", ["-xf", tarPath, "-C", opts.appDir], {
            maxBuffer: 16 * 1024 * 1024,
          });
        } catch (err: any) {
          if (moved) {
            // Put the old tree back rather than leave the app with no files.
            await fs.rm(uploads, { recursive: true, force: true }).catch(() => {});
            await fs.rename(safety, uploads).catch(() => {});
          }
          throw new Error(
            `Extracting the files failed, the previous files were put back: ${(err?.stderr || err?.message || "").trim()}`,
          );
        }
        if (moved) result.uploadsSafetyDir = safety;
        result.filesRestored = await countFiles(uploads);
      }

      await fs.rm(tarPath, { force: true });
    }
    return result;
  } finally {
    // Takes every downloaded and decrypted archive with it.
    await fs.rm(work, { recursive: true, force: true }).catch(() => {});
  }
}

async function countFiles(dir: string): Promise<number> {
  let total = 0;
  const walk = async (d: string) => {
    let entries;
    try {
      entries = await fs.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) await walk(path.join(d, e.name));
      else total += 1;
    }
  };
  await walk(dir);
  return total;
}
