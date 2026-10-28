import { db } from "../db";
import { vesselFinderSettings } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  decryptSecret,
  encryptSecret,
  isEncryptionConfigured,
} from "./secret-box";

/**
 * Access to the single vessel_finder_settings row.
 *
 * Two shapes deliberately: `getVesselFinderSettingsPublic` is what any API
 * response may contain, and it CANNOT carry the key — the field is not on the
 * type, so a route cannot leak it by spreading the object.
 * `getVesselFinderApiKey` returns the decrypted key and is for the VesselFinder
 * call only; nothing that serialises to a client should call it.
 */

export interface VesselFinderSettingsPublic {
  /** Whether a key is stored, never the key itself. */
  hasApiKey: boolean;
  /** False when EMAIL_ENCRYPTION_KEY is missing, so the UI can explain why. */
  encryptionConfigured: boolean;
  updatedAt: Date | null;
}

const getRow = async () => {
  const rows = await db.select().from(vesselFinderSettings).limit(1);
  return rows[0];
};

export async function getVesselFinderSettingsPublic(): Promise<VesselFinderSettingsPublic> {
  const row = await getRow();
  return {
    hasApiKey: !!row?.apiKeyEncrypted,
    encryptionConfigured: isEncryptionConfigured(),
    updatedAt: row?.updatedAt ?? null,
  };
}

/**
 * Save the key. A blank or absent apiKey LEAVES THE STORED ONE ALONE — the UI
 * never receives the key, so it cannot echo it back, and treating "not
 * supplied" as "clear it" would wipe it on any save that did not retype it.
 */
export async function saveVesselFinderSettings(
  input: { apiKey?: string | null },
  updatedById: number | null,
): Promise<void> {
  const apiKey = (input.apiKey ?? "").trim();
  if (!apiKey) return;

  // Throws when EMAIL_ENCRYPTION_KEY is missing rather than storing plaintext.
  const values = {
    apiKeyEncrypted: encryptSecret(apiKey),
    updatedAt: new Date(),
    updatedById,
  };

  const row = await getRow();
  if (row) {
    await db
      .update(vesselFinderSettings)
      .set(values)
      .where(eq(vesselFinderSettings.id, row.id));
  } else {
    await db.insert(vesselFinderSettings).values(values);
  }
}

/**
 * The decrypted key, or null when none is stored. Returning null rather than
 * throwing lets the vessel route fall back to sample data on a system where no
 * key has been entered yet.
 */
export async function getVesselFinderApiKey(): Promise<string | null> {
  const row = await getRow();
  if (!row?.apiKeyEncrypted) return null;
  return decryptSecret(row.apiKeyEncrypted);
}
