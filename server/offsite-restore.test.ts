/**
 * Guards on the offsite restore path. The FTP transfer and decryption need a
 * real backup account and are verified against staging; what is tested here is
 * everything that decides whether those commands run at all, plus the listing
 * parser, because a misread listing could have the server restore the wrong
 * archive.
 */
import {
  REMOTE_FILES,
  assertAgeIdentity,
  assertCredentials,
  parseRemoteListing,
} from "./lib/offsite-restore";

describe("assertAgeIdentity", () => {
  const PRIVATE =
    "AGE-SECRET-KEY-1QQPQZRFR0DWXZ5YQHF9HG0MS7AEMRZ8KLQZ2QW2N6ATPSZ9A6QCSGQ4K7N2";

  it("accepts a private key", () => {
    expect(() => assertAgeIdentity(PRIVATE)).not.toThrow();
  });

  it("accepts the whole key file, comments and all", () => {
    const file = `# created: 2026-10-10T03:55:44+05:30\n# public key: age1um42nx\n${PRIVATE}\n`;
    expect(() => assertAgeIdentity(file)).not.toThrow();
  });

  it("tells you when you pasted the public key by mistake", () => {
    expect(() =>
      assertAgeIdentity("age1um42nxqryvd576xajkjs3qhe2t8vujnc0pr2swupmwecgduyte6q9h6xx3"),
    ).toThrow(/public key/);
  });

  it("rejects empty input and unrelated text", () => {
    expect(() => assertAgeIdentity("   ")).toThrow(/required/);
    expect(() => assertAgeIdentity("hunter2")).toThrow(/not an age private key/);
  });
});

describe("assertCredentials", () => {
  it("strips a scheme and path from the host, which lftp would choke on", () => {
    const c = assertCredentials({
      host: "ftp://147.93.17.154/some/path",
      user: "u265883365.aquasoftBackup",
      password: "!dX!Se;k6",
    });
    expect(c.host).toBe("147.93.17.154");
  });

  it("keeps a password exactly as given, spaces and punctuation included", () => {
    const c = assertCredentials({ host: "h", user: "u", password: " p@ss word; " });
    expect(c.password).toBe(" p@ss word; ");
  });

  it.each(["host", "user", "password"])("requires %s", (missing) => {
    const base: any = { host: "h", user: "u", password: "p" };
    delete base[missing];
    expect(() => assertCredentials(base)).toThrow(new RegExp(missing));
  });
});

describe("parseRemoteListing", () => {
  const LISTING = [
    "drwxr-xr-x   2 u265883365.aquasoftBackup o1006675442     4096 Oct  9 22:42 .",
    "drwxr-xr-x   3 u265883365.aquasoftBackup o1006675442     4096 Oct  9 22:39 ..",
    "-rw-r--r--   1 u265883365.aquasoftBackup o1006675442  2212568 Oct  9 22:39 db.tar.age",
    "-rw-r--r--   1 u265883365.aquasoftBackup o1006675442 5404547496 Oct  9 22:49 uploads.tar.age",
  ].join("\n");

  it("reads names and sizes, skipping directories", () => {
    const files = parseRemoteListing(LISTING);
    expect(files).toHaveLength(2);
    expect(files[0]).toMatchObject({ name: "db.tar.age", bytes: 2212568 });
    expect(files[1]).toMatchObject({ name: "uploads.tar.age", bytes: 5404547496 });
  });

  it("keeps the modification date for display", () => {
    expect(parseRemoteListing(LISTING)[0].modified).toBe("Oct 9 22:39");
  });

  it("ignores partial-upload and unrelated entries once filtered by name", () => {
    const withPart =
      LISTING +
      "\n-rw-r--r--   1 u o 3389210624 Oct  9 22:47 .in.uploads.tar.age.part.";
    const names = parseRemoteListing(withPart)
      .filter((f) => Object.values(REMOTE_FILES).includes(f.name))
      .map((f) => f.name);
    expect(names).toEqual(["db.tar.age", "uploads.tar.age"]);
  });

  it("returns nothing for empty or malformed output rather than guessing", () => {
    expect(parseRemoteListing("")).toEqual([]);
    expect(parseRemoteListing("some error text\nanother line")).toEqual([]);
  });
});
