import crypto from "crypto";

/**
 * Encryption for secrets that have to live in the database.
 *
 * The Microsoft Graph client secret can send mail as the company, so storing it
 * in plaintext would mean every database dump — including the JSON that
 * GET /api/system/backup hands to any admin — carries a working credential.
 * These functions keep only ciphertext in the row; the key lives in the
 * environment, which is not in the dump.
 *
 * AES-256-GCM, so tampering with the stored value is detected on decrypt rather
 * than silently yielding garbage. Node's built-in crypto — no new dependency.
 *
 * If EMAIL_ENCRYPTION_KEY is not set, encrypt() and decrypt() THROW. They
 * deliberately do not fall back to storing plaintext: a missing key must be a
 * loud configuration error, not a silent downgrade of the thing this module
 * exists to provide.
 */

const ENV_KEY = "EMAIL_ENCRYPTION_KEY";
const PREFIX = "enc:v1";

/**
 * A 64-character hex string is used as the 32-byte key directly. Anything else
 * is treated as a passphrase and stretched with scrypt, so an operator who sets
 * a long random string rather than hex still gets a valid key. The salt is
 * fixed because the key must derive identically on every boot; scrypt's cost is
 * doing the work here, not the salt.
 */
const deriveKey = (raw: string): Buffer => {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return crypto.scryptSync(raw, "aquanav-email-secret", 32);
};

let cachedKey: Buffer | null = null;

const getKey = (): Buffer => {
  const raw = process.env[ENV_KEY];
  if (!raw || raw.trim() === "") {
    throw new Error(
      `${ENV_KEY} is not set. The email client secret cannot be stored or read without it. ` +
        `Set it to a 64-character hex string (or a long random passphrase) in the server environment.`,
    );
  }
  if (!cachedKey) {
    cachedKey = deriveKey(raw.trim());
  }
  return cachedKey;
};

/** Whether a secret can be stored or read at all. Lets the UI say so plainly. */
export const isEncryptionConfigured = (): boolean => {
  const raw = process.env[ENV_KEY];
  return !!raw && raw.trim() !== "";
};

export const encryptSecret = (plaintext: string): string => {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
};

export const decryptSecret = (stored: string): string => {
  const key = getKey();
  const parts = stored.split(":");
  // enc:v1:iv:tag:ciphertext
  if (parts.length !== 5 || `${parts[0]}:${parts[1]}` !== PREFIX) {
    throw new Error(
      "Stored email secret is not in the expected encrypted format. " +
        "It may predate encryption or have been written directly to the database; re-enter it in Settings.",
    );
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(parts[2], "base64"),
  );
  decipher.setAuthTag(Buffer.from(parts[3], "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(parts[4], "base64")),
    decipher.final(),
  ]).toString("utf8");
};
