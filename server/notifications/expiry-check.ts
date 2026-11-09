import {
  selectExpiringForEmployees,
  todayInClientTz,
  type ExpiringDocumentWarning,
} from "./expiry";
import { getExpiringItems } from "./runner";

export type { ExpiringDocumentWarning } from "./expiry";

/**
 * Active documents and training records that expire within three months (or
 * already have), for every active employee, using the same data and Dubai
 * calendar as the expiry reminders. Feeds the warnings in the project team
 * picker.
 */
export async function findExpiringDocumentWarnings(
  now: Date = new Date(),
): Promise<ExpiringDocumentWarning[]> {
  const items = await getExpiringItems();
  return selectExpiringForEmployees(
    items,
    items.map((i) => i.employeeId),
    todayInClientTz(now),
  );
}
