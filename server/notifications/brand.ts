import { db } from "../db";
import { companies } from "@shared/schema";
import { brandFromCompany, type EmailBrand } from "./templates";

/**
 * The company row's footer details for emails. Callers load it once and pass
 * it into the templates, which never query anything themselves. Null when no
 * company row exists or the read fails; the footer then shows the name only.
 */
export async function loadEmailBrand(): Promise<EmailBrand | null> {
  try {
    const [company] = await db.select().from(companies).limit(1);
    return brandFromCompany(company);
  } catch (error) {
    console.error("[email] Failed to load company details for the footer:", error);
    return null;
  }
}
