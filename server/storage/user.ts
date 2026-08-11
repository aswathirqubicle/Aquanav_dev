import { CompanyStorage } from "./company";
import bcrypt from "bcrypt";
import {
  employees,
  InsertUser,
  User,
  users,
} from "@shared/schema";
import { db } from "../db";
import { eq, sql } from "drizzle-orm";

export class UserStorage extends CompanyStorage {
  // User methods
  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);
      return result[0];
    } catch (error: any) {
      // Log to console only to avoid recursive database errors
      console.error("Error in getUserByUsername:", error);
      throw error;
    }
  }

  // Email uniqueness ignores case, so Admin@x.com and admin@x.com are the same
  // account. This matches the users_email_lower_unique index in migration 0077.
  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const result = await db
        .select()
        .from(users)
        .where(sql`lower(${users.email}) = lower(${email})`)
        .limit(1);
      return result[0];
    } catch (error: any) {
      // Log to console only to avoid recursive database errors
      console.error("Error in getUserByEmail:", error);
      throw error;
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    try {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getUser (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getUser",
        severity: "error",
      });
      throw error;
    }
  }

  /**
   * The name to show against something a user did — an edit, a cancellation.
   *
   * Resolved the same way the approval trails resolve theirs: employee full
   * name where the login is linked to an employee record, falling back to the
   * username. Without this, an Activity block showed the approval trail's
   * "Priya Menon" and the edit history's "pmenon" as if they were two people.
   */
  async getUserDisplayName(id: number): Promise<string | null> {
    try {
      const result = await db
        .select({
          displayName: sql<string>`COALESCE(NULLIF(CONCAT(${employees.firstName}, ' ', ${employees.lastName}), ' '), ${users.username}, '')`,
        })
        .from(users)
        .leftJoin(employees, eq(employees.userId, users.id))
        .where(eq(users.id, id))
        .limit(1);
      return result[0]?.displayName || null;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getUserDisplayName (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getUserDisplayName",
        severity: "error",
      });
      throw error;
    }
  }

  async getUsers(): Promise<User[]> {
    try {
      return await db.select().from(users);
    } catch (error: any) {
      await this.createErrorLog({
        message: "Error in getUsers: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getUsers",
        severity: "error",
      });
      throw error;
    }
  }

  async createUser(userData: InsertUser): Promise<User> {
    try {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const result = await db
        .insert(users)
        .values({
          ...userData,
          password: hashedPassword,
        })
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message: "Error in createUser: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createUser",
        severity: "error",
        // Optionally log parts of userData, but be careful with sensitive info
      });
      throw error;
    }
  }

  async updateUser(
    id: number,
    userData: Partial<InsertUser>,
  ): Promise<User | undefined> {
    try {
      const result = await db
        .update(users)
        .set(userData)
        .where(eq(users.id, id))
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateUser (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateUser",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteUser(id: number): Promise<boolean> {
    try {
      const result = await db.delete(users).where(eq(users.id, id)).returning();
      return result.length > 0;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deleteUser (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteUser",
        severity: "error",
      });
      throw error;
    }
  }

  //Profile
  async changePassword(
    id: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<boolean> {
    try {
      const user = await this.getUser(id);
      if (!user) {
        throw new Error("User not found");
      }

      const isValidPassword = await bcrypt.compare(
        currentPassword,
        user.password,
      );
      if (!isValidPassword) {
        throw new Error("Invalid current password");
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await this.updateUser(id, { password: hashedPassword });

      return true;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in changePassword (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "changePassword",
        severity: "error",
      });
      throw error;
    }
  }
}
