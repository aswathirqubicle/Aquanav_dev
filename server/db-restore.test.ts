/**
 * The restore path replaces every row in the company's database, so its
 * guards are the part worth testing: the file check that stops someone
 * uploading the encrypted archive or a photo, and the credential handling
 * that keeps the database password out of `ps`.
 *
 * The pg_restore call itself is not exercised here — that needs a live
 * PostgreSQL and is verified against staging instead.
 */
import fs from "fs/promises";
import os from "os";
import path from "path";
import {
  CONFIRMATION_PHRASE,
  assertCustomFormatDump,
  pgEnvFromUrl,
} from "./lib/db-restore";

describe("pgEnvFromUrl", () => {
  it("splits a connection URL into Postgres environment variables", () => {
    expect(
      pgEnvFromUrl("postgresql://aquanav_uae:s3cret@localhost:5432/aquanav_uae"),
    ).toEqual({
      PGHOST: "localhost",
      PGPORT: "5432",
      PGUSER: "aquanav_uae",
      PGPASSWORD: "s3cret",
      PGDATABASE: "aquanav_uae",
    });
  });

  it("decodes percent-encoded credentials, so punctuation in a password survives", () => {
    const env = pgEnvFromUrl(
      "postgresql://user%40host:p%40ss%20word@db.internal:6543/books",
    );
    expect(env.PGUSER).toBe("user@host");
    expect(env.PGPASSWORD).toBe("p@ss word");
    expect(env.PGPORT).toBe("6543");
  });

  it("falls back to port 5432 when the URL omits it", () => {
    const env = pgEnvFromUrl("postgresql://me@db.internal/mydb");
    expect(env.PGHOST).toBe("db.internal");
    expect(env.PGPORT).toBe("5432");
  });

  it.each([
    ["not a url at all", /not a valid connection URL/],
    ["postgresql://user@localhost:5432/", /no database name/],
    ["postgresql://localhost:5432/mydb", /no username/],
  ])("rejects %s", (url, expected) => {
    expect(() => pgEnvFromUrl(url)).toThrow(expected);
  });
});

describe("assertCustomFormatDump", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "restore-check-"));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const write = async (name: string, contents: Buffer | string) => {
    const p = path.join(dir, name);
    await fs.writeFile(p, contents);
    return p;
  };

  it("accepts a custom-format dump", async () => {
    const p = await write("good.dump", Buffer.from("PGDMP\x01\x0e\x00", "latin1"));
    await expect(assertCustomFormatDump(p)).resolves.toBeUndefined();
  });

  it("rejects the encrypted archive, the most likely mistake", async () => {
    const p = await write(
      "db.tar.age",
      "age-encryption.org/v1\n-> X25519 abc\n",
    );
    await expect(assertCustomFormatDump(p)).rejects.toThrow(/not a PostgreSQL custom-format dump/);
  });

  it("rejects a plain-SQL dump", async () => {
    const p = await write("dump.sql", "--\n-- PostgreSQL database dump\n--\n");
    await expect(assertCustomFormatDump(p)).rejects.toThrow(/\.sql file/);
  });

  it("rejects a file too short to carry the magic bytes", async () => {
    const p = await write("tiny.dump", "PG");
    await expect(assertCustomFormatDump(p)).rejects.toThrow(/not a PostgreSQL custom-format dump/);
  });

  it("rejects an empty file", async () => {
    const p = await write("empty.dump", "");
    await expect(assertCustomFormatDump(p)).rejects.toThrow(/not a PostgreSQL custom-format dump/);
  });
});

describe("CONFIRMATION_PHRASE", () => {
  it("is explicit about what the action does", () => {
    // Guards against someone softening it to "yes" or "confirm" later: the
    // phrase is the last thing between a mistaken click and the company's data.
    expect(CONFIRMATION_PHRASE).toBe("REPLACE ALL DATA");
  });
});
