import { db } from "../db";
import { emailSettings } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  decryptSecret,
  encryptSecret,
  isEncryptionConfigured,
} from "./secret-box";

/**
 * Access to the single email_settings row.
 *
 * Two shapes deliberately: `getEmailSettingsPublic` is what any API response
 * may contain, and it CANNOT carry the secret — the field is not on the type,
 * so a route cannot leak it by spreading the object. `getEmailConfig` returns
 * the decrypted secret and is for the mailer only; nothing that serialises to a
 * client should call it.
 */

export interface EmailSettingsPublic {
  tenantId: string | null;
  clientId: string | null;
  clientSecretId: string | null;
  senderEmail: string | null;
  isEnabled: boolean;
  /** Whether a secret is stored, never the secret itself. */
  hasClientSecret: boolean;
  /** False when EMAIL_ENCRYPTION_KEY is missing, so the UI can explain why. */
  encryptionConfigured: boolean;
  updatedAt: Date | null;
}

export interface EmailConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  senderEmail: string;
}

const getRow = async () => {
  const rows = await db.select().from(emailSettings).limit(1);
  return rows[0];
};

export async function getEmailSettingsPublic(): Promise<EmailSettingsPublic> {
  const row = await getRow();
  return {
    tenantId: row?.tenantId ?? null,
    clientId: row?.clientId ?? null,
    clientSecretId: row?.clientSecretId ?? null,
    senderEmail: row?.senderEmail ?? null,
    isEnabled: row?.isEnabled ?? false,
    hasClientSecret: !!row?.clientSecretEncrypted,
    encryptionConfigured: isEncryptionConfigured(),
    updatedAt: row?.updatedAt ?? null,
  };
}

/**
 * Save settings. A blank or absent clientSecret LEAVES THE STORED ONE ALONE —
 * the UI never receives the secret, so it cannot echo it back, and treating
 * "not supplied" as "clear it" would wipe the credential every time someone
 * edited the sender address.
 */
export async function saveEmailSettings(
  input: {
    tenantId?: string | null;
    clientId?: string | null;
    clientSecretId?: string | null;
    clientSecret?: string | null;
    senderEmail?: string | null;
    isEnabled?: boolean;
  },
  updatedById: number | null,
): Promise<void> {
  const row = await getRow();

  const values: Record<string, unknown> = {
    updatedAt: new Date(),
    updatedById,
  };
  if (input.tenantId !== undefined) values.tenantId = input.tenantId || null;
  if (input.clientId !== undefined) values.clientId = input.clientId || null;
  if (input.clientSecretId !== undefined)
    values.clientSecretId = input.clientSecretId || null;
  if (input.senderEmail !== undefined)
    values.senderEmail = input.senderEmail || null;
  if (input.isEnabled !== undefined) values.isEnabled = input.isEnabled;

  if (input.clientSecret) {
    // Throws when EMAIL_ENCRYPTION_KEY is missing rather than storing plaintext.
    values.clientSecretEncrypted = encryptSecret(input.clientSecret);
  }

  if (row) {
    await db
      .update(emailSettings)
      .set(values)
      .where(eq(emailSettings.id, row.id));
  } else {
    await db.insert(emailSettings).values(values as any);
  }
}

/**
 * The decrypted config, or null when email is not usable yet. Returning null
 * rather than throwing is what lets the jobs no-op quietly on an unconfigured
 * system instead of erroring every hour.
 */
export async function getEmailConfig(): Promise<EmailConfig | null> {
  const row = await getRow();
  if (
    !row ||
    !row.isEnabled ||
    !row.tenantId ||
    !row.clientId ||
    !row.clientSecretEncrypted ||
    !row.senderEmail
  ) {
    return null;
  }

  return {
    tenantId: row.tenantId,
    clientId: row.clientId,
    clientSecret: decryptSecret(row.clientSecretEncrypted),
    senderEmail: row.senderEmail,
  };
}
