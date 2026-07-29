/**
 * The Graph client secret can send mail as the company, so what is stored must
 * never be the secret itself, and a missing key must fail loudly rather than
 * quietly downgrading to plaintext.
 */
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";

const ENV_KEY = "EMAIL_ENCRYPTION_KEY";
const HEX_KEY = "a".repeat(64);

/**
 * secret-box caches the derived key at module scope, so each test needs a fresh
 * module registry or a key change would not take effect.
 */
const loadFresh = () => {
  let mod: typeof import("./lib/secret-box");
  jest.isolateModules(() => {
    mod = require("./lib/secret-box");
  });
  return mod!;
};

describe("secret-box", () => {
  const original = process.env[ENV_KEY];

  beforeEach(() => {
    process.env[ENV_KEY] = HEX_KEY;
  });

  afterEach(() => {
    if (original === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = original;
  });

  it("round-trips a secret", () => {
    const { encryptSecret, decryptSecret } = loadFresh();
    const secret = "Xy7~qL2.aB9_ThisIsAClientSecret";
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it("never stores the plaintext", () => {
    const { encryptSecret } = loadFresh();
    const secret = "SUPER-SECRET-VALUE";
    const stored = encryptSecret(secret);

    // The regression that matters: the stored column must not contain the
    // secret in any recoverable-by-eye form.
    expect(stored).not.toContain(secret);
    expect(stored).not.toContain("SUPER");
    expect(stored.startsWith("enc:v1:")).toBe(true);
  });

  it("produces different ciphertext each time, so equal secrets are not comparable", () => {
    const { encryptSecret } = loadFresh();
    const a = encryptSecret("same-secret");
    const b = encryptSecret("same-secret");
    expect(a).not.toBe(b);
  });

  it("detects tampering rather than returning garbage", () => {
    const { encryptSecret, decryptSecret } = loadFresh();
    const stored = encryptSecret("original-secret");
    const parts = stored.split(":");
    // Flip the ciphertext segment.
    const tampered = [
      parts[0],
      parts[1],
      parts[2],
      parts[3],
      Buffer.from("different-content").toString("base64"),
    ].join(":");

    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("refuses a value that is not in the encrypted format", () => {
    const { decryptSecret } = loadFresh();
    // e.g. a plaintext secret written straight into the column.
    expect(() => decryptSecret("raw-plaintext-secret")).toThrow(
      /not in the expected encrypted format/i,
    );
  });

  it("throws instead of falling back to plaintext when the key is missing", () => {
    delete process.env[ENV_KEY];
    const { encryptSecret, isEncryptionConfigured } = loadFresh();

    expect(isEncryptionConfigured()).toBe(false);
    expect(() => encryptSecret("anything")).toThrow(/EMAIL_ENCRYPTION_KEY/);
  });

  it("accepts a passphrase as well as a hex key", () => {
    process.env[ENV_KEY] = "a long random passphrase that is not hex";
    const { encryptSecret, decryptSecret, isEncryptionConfigured } = loadFresh();

    expect(isEncryptionConfigured()).toBe(true);
    expect(decryptSecret(encryptSecret("secret"))).toBe("secret");
  });

  it("cannot decrypt with a different key", () => {
    const first = loadFresh();
    const stored = first.encryptSecret("secret");

    process.env[ENV_KEY] = "b".repeat(64);
    const second = loadFresh();

    expect(() => second.decryptSecret(stored)).toThrow();
  });
});
