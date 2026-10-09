/**
 * Reads the status file written by the offsite backup job (ops/backup).
 *
 * The job runs outside the application — a systemd timer on the host — so the
 * only thing the app can honestly report is what that job last recorded. This
 * module reads that record and says how old it is, so the Settings page can
 * show "last backup succeeded 6 hours ago" or, more usefully, "the last run
 * failed" and "nothing has run for three days".
 *
 * Absence is a normal state, not an error: development machines and any server
 * without the job installed have no status file, and the page says so rather
 * than showing a scary red box.
 */
import fs from "fs/promises";

/** How long each job may go without a successful run before we call it stale. */
const STALE_AFTER_HOURS: Record<string, number> = {
  db: 36, // runs nightly; 36h tolerates one missed night
  uploads: 240, // runs weekly; 10 days tolerates one missed week
};
const DEFAULT_STALE_AFTER_HOURS = 36;

/** One job as the backup script recorded it. */
export interface RawBackupJob {
  ok?: boolean;
  finished_at?: string;
  bytes?: number;
  remote?: string;
  message?: string;
}

export interface BackupJobStatus {
  job: string;
  ok: boolean;
  finishedAt: string | null;
  ageHours: number | null;
  stale: boolean;
  bytes: number | null;
  remote: string | null;
  message: string | null;
}

export interface BackupStatus {
  /** False when no status file exists — the job is not installed here. */
  configured: boolean;
  jobs: BackupJobStatus[];
  /** Set when the file exists but could not be read or parsed. */
  error?: string;
}

const hoursBetween = (then: Date, now: Date) =>
  Math.round(((now.getTime() - then.getTime()) / 3_600_000) * 10) / 10;

/** Shape one recorded job, deciding staleness against `now`. */
export function summarizeJob(
  job: string,
  raw: RawBackupJob,
  now: Date,
): BackupJobStatus {
  const finished = raw.finished_at ? new Date(raw.finished_at) : null;
  const valid = finished !== null && !Number.isNaN(finished.getTime());
  const ageHours = valid ? hoursBetween(finished, now) : null;
  const limit = STALE_AFTER_HOURS[job] ?? DEFAULT_STALE_AFTER_HOURS;

  return {
    job,
    ok: raw.ok === true,
    finishedAt: valid ? finished.toISOString() : null,
    ageHours,
    // No usable timestamp counts as stale: we cannot show it as current.
    stale: ageHours === null || ageHours > limit,
    bytes: typeof raw.bytes === "number" ? raw.bytes : null,
    remote: raw.remote ?? null,
    message: raw.message ?? null,
  };
}

/** Turn the parsed file into the response shape, newest job first. */
export function summarize(
  parsed: Record<string, RawBackupJob>,
  now: Date,
): BackupJobStatus[] {
  return Object.entries(parsed)
    .map(([job, raw]) => summarizeJob(job, raw, now))
    .sort((a, b) => a.job.localeCompare(b.job));
}

/**
 * Read and summarize the status file. Never throws: a missing file means the
 * job is not installed, and unreadable content is reported as an error the
 * page can display, because a backup page that crashes tells you nothing.
 */
export async function readBackupStatus(
  path: string,
  now: Date = new Date(),
): Promise<BackupStatus> {
  let text: string;
  try {
    text = await fs.readFile(path, "utf8");
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      return { configured: false, jobs: [] };
    }
    return {
      configured: true,
      jobs: [],
      error: `Status file could not be read: ${err?.code ?? err?.message ?? "unknown error"}`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      configured: true,
      jobs: [],
      error: "Status file is not valid JSON",
    };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      configured: true,
      jobs: [],
      error: "Status file does not contain a job object",
    };
  }

  return {
    configured: true,
    jobs: summarize(parsed as Record<string, RawBackupJob>, now),
  };
}

/** Where the backup job writes its status, overridable for other layouts. */
export const BACKUP_STATUS_PATH =
  process.env.BACKUP_STATUS_PATH ?? "/srv/aquanav/backups/status.json";
