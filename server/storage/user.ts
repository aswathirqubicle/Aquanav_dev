import { CompanyStorage } from "./company";
import bcrypt from "bcrypt";
import {
  InsertUser,
  User,
  users,
} from "@shared/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";

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
