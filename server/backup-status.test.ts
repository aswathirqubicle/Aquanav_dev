/**
 * The Settings page reports backup health from this module, so its failure
 * modes matter more than its happy path: a missing file must read as "not
 * installed" rather than "broken", a failed run must not be shown as fine,
 * and an old-but-successful run must be flagged, because the dangerous state
 * is a backup everyone believes in that stopped working weeks ago.
 */
import fs from "fs/promises";
import os from "os";
import path from "path";
import { readBackupStatus, summarizeJob } from "./lib/backup-status";

const NOW = new Date("2026-10-10T06:00:00Z");

describe("summarizeJob", () => {
  it("reports a recent successful db run as current", () => {
    const s = summarizeJob(
      "db",
      { ok: true, finished_at: "2026-10-10T00:30:00Z", bytes: 2212568, remote: "/aquanav/db.tar.age" },
      NOW,
    );
    expect(s).toMatchObject({ ok: true, stale: false, ageHours: 5.5, bytes: 2212568 });
  });

  it("flags a successful db run that is older than a missed night", () => {
    const s = summarizeJob("db", { ok: true, finished_at: "2026-10-08T00:30:00Z" }, NOW);
    expect(s.ok).toBe(true);
    expect(s.stale).toBe(true); // 53.5h > 36h
  });

  it("does not report a failed run as ok, and keeps its message", () => {
    const s = summarizeJob(
      "db",
      { ok: false, finished_at: "2026-10-10T00:30:00Z", message: "size mismatch" },
      NOW,
    );
    expect(s.ok).toBe(false);
    expect(s.message).toBe("size mismatch");
  });

  it("allows the weekly uploads job a longer window than the nightly one", () => {
    const fiveDaysAgo = { ok: true, finished_at: "2026-10-05T03:00:00Z" };
    expect(summarizeJob("uploads", fiveDaysAgo, NOW).stale).toBe(false);
    expect(summarizeJob("db", fiveDaysAgo, NOW).stale).toBe(true);
  });

  it("treats a missing or unparseable timestamp as stale rather than current", () => {
    expect(summarizeJob("db", { ok: true }, NOW)).toMatchObject({ stale: true, ageHours: null });
    expect(summarizeJob("db", { ok: true, finished_at: "not a date" }, NOW)).toMatchObject({
      stale: true,
      finishedAt: null,
    });
  });
});

describe("readBackupStatus", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "backup-status-"));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("reports not-configured when no status file exists", async () => {
    const r = await readBackupStatus(path.join(dir, "absent.json"), NOW);
    expect(r).toEqual({ configured: false, jobs: [] });
  });

  it("reads both jobs and sorts them by name", async () => {
    const p = path.join(dir, "status.json");
    await fs.writeFile(
      p,
      JSON.stringify({
        uploads: { ok: true, finished_at: "2026-10-09T03:00:00Z", bytes: 5_200_000_000 },
        db: { ok: true, finished_at: "2026-10-10T00:30:00Z", bytes: 2212568 },
      }),
    );
    const r = await readBackupStatus(p, NOW);
    expect(r.configured).toBe(true);
    expect(r.jobs.map((j) => j.job)).toEqual(["db", "uploads"]);
    expect(r.jobs[0].stale).toBe(false);
  });

  it("surfaces malformed content as an error instead of throwing", async () => {
    const p = path.join(dir, "status.json");
    await fs.writeFile(p, "{ this is not json");
    const r = await readBackupStatus(p, NOW);
    expect(r.configured).toBe(true);
    expect(r.error).toMatch(/not valid JSON/);
    expect(r.jobs).toEqual([]);
  });

  it("rejects a file that parses but is not a job object", async () => {
    const p = path.join(dir, "status.json");
    await fs.writeFile(p, JSON.stringify(["db"]));
    const r = await readBackupStatus(p, NOW);
    expect(r.error).toMatch(/job object/);
  });
});
