/**
 * Restoring the database from an uploaded pg_dump archive.
 *
 * This replaces every row the company has. Four things make that survivable:
 *
 *  1. A safety dump is taken first, so the state being replaced is recoverable.
 *  2. The restore runs in ONE transaction. If anything in it fails, Postgres
 *     rolls the whole thing back and the live data is untouched — the failure
 *     mode is "nothing happened", not "half your data is gone".
 *  3. The upload must be a real PostgreSQL custom-format dump; anything else
 *     is rejected before a single command runs.
 *  4. Every attempt is appended to an audit log on disk, which survives the
 *     restore itself (a database table would not).
 *
 * Connection details are passed through the environment, never on the command
 * line: argv is readable by any local user through `ps`.
 */
import { execFile } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/** Typed by the admin before a restore proceeds. */
export const CONFIRMATION_PHRASE = "REPLACE ALL DATA";

/** First bytes of every pg_dump custom-format archive. */
const PGDUMP_MAGIC = "PGDMP";

/** Postgres environment variables derived from a connection URL. */
export interface PgEnv {
  PGHOST: string;
  PGPORT: string;
  PGUSER: string;
  PGPASSWORD: string;
  PGDATABASE: string;
}

/**
 * Split a connection URL into environment variables so no credential reaches
 * argv. Throws on a URL missing what pg_restore needs.
 */
export function pgEnvFromUrl(databaseUrl: string): PgEnv {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL is not a valid connection URL");
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!database) throw new Error("DATABASE_URL has no database name");
  if (!url.username) throw new Error("DATABASE_URL has no username");
  return {
    PGHOST: url.hostname || "localhost",
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password || ""),
    PGDATABASE: database,
  };
}

/**
 * Confirm the upload is a PostgreSQL custom-format dump. Guards against the
 * obvious mistakes — a plain-SQL dump, the encrypted .age file, a photo — all
 * of which would otherwise fail deep inside pg_restore with an opaque message.
 */
export async function assertCustomFormatDump(dumpPath: string): Promise<void> {
  const handle = await fs.open(dumpPath, "r");
  try {
    const buf = Buffer.alloc(PGDUMP_MAGIC.length);
    const { bytesRead } = await handle.read(buf, 0, buf.length, 0);
    if (bytesRead < buf.length || buf.toString("latin1") !== PGDUMP_MAGIC) {
      throw new Error(
        "That file is not a PostgreSQL custom-format dump. Decrypt the backup " +
          "first (age -d), then upload the .dump file from inside it — not the " +
          ".age file and not a .sql file.",
      );
    }
  } finally {
    await handle.close();
  }
}

export interface RestoreResult {
  safetyDumpPath: string;
  startedAt: string;
  finishedAt: string;
  /** pg_restore warnings; non-fatal, but worth showing. */
  warnings: string | null;
}

/** Appended per attempt; survives the restore because it is a file, not a row. */
async function audit(auditPath: string, line: string): Promise<void> {
  try {
    await fs.mkdir(path.dirname(auditPath), { recursive: true });
    await fs.appendFile(auditPath, line.endsWith("\n") ? line : `${line}\n`);
  } catch (err) {
    // An unwritable audit log must not block a recovery that is already underway.
    console.error("restore audit write failed:", err);
  }
}

export interface RestoreOptions {
  dumpPath: string;
  databaseUrl: string;
  /** Where the safety dump is written. */
  backupDir: string;
  auditPath: string;
  /** Recorded in the audit log. */
  actor: string;
  now?: Date;
}

/**
 * Take a safety dump, then replace the database contents from `dumpPath`.
 *
 * --clean --if-exists drops the existing objects, and --single-transaction
 * makes the drop-and-reload atomic: a failure leaves the database exactly as
 * it was. --no-owner/--no-privileges keep every object owned by the connecting
 * role, which is how these databases were built.
 */
export async function restoreFromDump(
  opts: RestoreOptions,
): Promise<RestoreResult> {
  const now = opts.now ?? new Date();
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
  const env = { ...process.env, ...pgEnvFromUrl(opts.databaseUrl) };
  const startedAt = now.toISOString();

  await assertCustomFormatDump(opts.dumpPath);
  await fs.mkdir(opts.backupDir, { recursive: true });
  const safetyDumpPath = path.join(opts.backupDir, `pre-restore-${stamp}.dump`);

  await audit(
    opts.auditPath,
    `${startedAt} RESTORE START by=${opts.actor} db=${env.PGDATABASE} dump=${path.basename(opts.dumpPath)}`,
  );

  try {
    await execFileAsync("pg_dump", ["-Fc", "-f", safetyDumpPath], {
      env,
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err: any) {
    const message = `safety dump failed, restore abandoned: ${err?.stderr || err?.message}`;
    await audit(opts.auditPath, `${new Date().toISOString()} RESTORE ABORTED ${message}`);
    throw new Error(message);
  }

  let warnings: string | null = null;
  try {
    const { stderr } = await execFileAsync(
      "pg_restore",
      [
        "--clean",
        "--if-exists",
        "--single-transaction",
        "--no-owner",
        "--no-privileges",
        "-d",
        env.PGDATABASE,
        opts.dumpPath,
      ],
      { env, maxBuffer: 64 * 1024 * 1024 },
    );
    warnings = stderr?.trim() ? stderr.trim() : null;
  } catch (err: any) {
    const detail = (err?.stderr || err?.message || "unknown error").trim();
    await audit(
      opts.auditPath,
      `${new Date().toISOString()} RESTORE FAILED by=${opts.actor} (data unchanged, rolled back) ${detail}`,
    );
    throw new Error(
      `Restore failed and was rolled back — your data is unchanged. ${detail}`,
    );
  }

  const finishedAt = new Date().toISOString();
  await audit(
    opts.auditPath,
    `${finishedAt} RESTORE OK by=${opts.actor} db=${env.PGDATABASE} safety=${path.basename(safetyDumpPath)}`,
  );

  return { safetyDumpPath, startedAt, finishedAt, warnings };
}
