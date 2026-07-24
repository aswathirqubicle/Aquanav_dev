import {
  CountResult,
  PaginatedResponse,
} from "./types";
import {
  Location,
  errorLogs,
  locations,
  users,
} from "@shared/schema";
import {
  and,
  asc,
  desc,
  eq,
  sql,
} from "drizzle-orm";
import { db } from "../db";

export class StorageBase {
  public async generateNextNumber(
    prefix: string,
    table: any,
    column: any,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const pattern = `${prefix}-AQNV-${year}-%`;

    const latest = await db
      .select({ number: column })
      .from(table)
      .where(sql`${column} LIKE ${pattern}`)
      .orderBy(desc(column))
      .limit(1);

    let nextSerial = 1;
    if (latest.length > 0 && latest[0].number) {
      const parts = latest[0].number.split("-");
      const lastSerial = parseInt(parts[parts.length - 1]);
      if (!isNaN(lastSerial)) {
        nextSerial = lastSerial + 1;
      }
    }

    return `${prefix}-AQNV-${year}-${nextSerial.toString().padStart(3, "0")}`;
  }

  protected _cleanDateValue(value: any): Date | null | undefined {
    // Test comment
    if (value === null || value === "") {
      return null;
    }
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? undefined : value;
    }
    if (typeof value === "string") {
      const parsedDate = new Date(value);
      return isNaN(parsedDate.getTime()) ? undefined : parsedDate;
    }
    return undefined;
  }

  protected async _getPaginatedResults<TData>(
    dataQueryBuilder: Select,
    countQueryBuilder: Select<CountResult>,
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<TData>> {
    try {
      const totalResult = await countQueryBuilder;
      const total = Number(totalResult[0].count);
      const totalPages = Math.ceil(total / limit);

      // The dataQueryBuilder should already have conditions and ordering applied.
      // We just add limit and offset here.
      const data = await dataQueryBuilder
        .limit(limit)
        .offset((page - 1) * limit);

      return {
        data: data as TData[], // We cast here, assuming TData is the correct shape
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      console.error("Error in _getPaginatedResults:", error);
      throw error;
    }
  }

  async getLocations(): Promise<Location[]> {
    try {
      return await db.select().from(locations).orderBy(asc(locations.name));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getLocations: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getLocations",
        severity: "error",
      });
      throw error;
    }
  }

  protected calculateWorkingDays(startDate: Date, endDate: Date): number {
    // Ensure we have valid dates
    if (!startDate || !endDate) {
      return 0;
    }

    // If end date is before start date, return 0
    if (endDate < startDate) {
      return 0;
    }

    let workingDays = 0;
    let currentDate = new Date(startDate.getTime()); // Create a copy to avoid modifying original

    while (currentDate <= endDate) {
      // Count only weekdays (Monday = 1, Sunday = 0)
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Not Sunday or Saturday
        workingDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return workingDays;
  }

  // Error Log methods
  async createErrorLog(errorData: {
    message: string;
    stack?: string;
    url?: string;
    userAgent?: string;
    userId?: number;
    severity?: string;
    component?: string;
  }): Promise<any> {
    try {
      const result = await db
        .insert(errorLogs)
        .values({
          message: errorData.message,
          stack: errorData.stack || null,
          url: errorData.url || null,
          userAgent: errorData.userAgent || null,
          userId: errorData.userId || null,
          severity: errorData.severity || "error",
          component: errorData.component || null,
          resolved: false,
        })
        .returning();
      return result[0];
    } catch (error) {
      // Don't throw here to avoid recursive errors when DB is down
      console.error("Error creating error log:", error);
      return null;
    }
  }

  async getErrorLogs(
    page: number = 1,
    limit: number = 20,
    severity?: string,
    resolved?: string,
  ): Promise<{
    data: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const queryConditions = [];
      if (severity && severity !== "all") {
        queryConditions.push(eq(errorLogs.severity, severity));
      }
      if (resolved !== undefined && resolved !== "all") {
        // Check for undefined explicitly
        queryConditions.push(eq(errorLogs.resolved, resolved === "true"));
      }

      const finalConditions =
        queryConditions.length > 0 ? and(...queryConditions) : undefined;

      const dataQueryBuilder = db
        .select({
          id: errorLogs.id,
          message: errorLogs.message,
          stack: errorLogs.stack,
          url: errorLogs.url,
          userAgent: errorLogs.userAgent,
          userId: errorLogs.userId,
          userName: users.username,
          timestamp: errorLogs.timestamp,
          severity: errorLogs.severity,
          component: errorLogs.component,
          resolved: errorLogs.resolved,
        })
        .from(errorLogs)
        .leftJoin(users, eq(errorLogs.userId, users.id))
        .where(finalConditions)
        .orderBy(desc(errorLogs.timestamp));

      // Count query needs to join as well if conditions depend on joined table,
      // though in this case, `users.username` is not part of filters.
      // For consistency, joining for count if data query joins.
      const countQueryBuilder = db
        .select({ count: sql<number>`count(*)` })
        .from(errorLogs)
        .leftJoin(users, eq(errorLogs.userId, users.id)) // Added join here for count
        .where(finalConditions);

      return this._getPaginatedResults<any>( // Using any for TData due to custom select shape
        dataQueryBuilder,
        countQueryBuilder,
        page,
        limit,
      );
    } catch (error) {
      console.error("Error getting error logs paginated:", error);
      throw error;
    }
  }

  async updateErrorLog(id: number, data: { resolved?: boolean }): Promise<any> {
    try {
      const result = await db
        .update(errorLogs)
        .set(data)
        .where(eq(errorLogs.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating error log:", error);
    }
  }

  async clearErrorLogs(): Promise<number> {
    try {
      const result = await db.delete(errorLogs);
      return result.rowCount || 0;
    } catch (error) {
      console.error("Error clearing error logs:", error);
      throw error;
    }
  }

  async clearResolvedErrorLogs(): Promise<number> {
    try {
      const result = await db
        .delete(errorLogs)
        .where(eq(errorLogs.resolved, true));
      return result.rowCount || 0;
    } catch (error) {
      console.error("Error clearing resolved error logs:", error);
      throw error;
    }
  }

  // Helper methods for payroll
  protected getMonthName(month: number): string {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return months[month - 1] || "Unknown";
  }

  protected getCalendarDaysInMonth(month: number, year: number): number {
    return new Date(year, month, 0).getDate();
  }

  protected getWorkingDaysInMonth(month: number, year: number): number {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    return this.calculateWorkingDays(startDate, endDate);
  }
}
