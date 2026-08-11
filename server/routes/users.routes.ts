import { Router } from "express";
import bcrypt from "bcrypt";
import { ZodError } from "zod";
import { insertUserSchema } from "@shared/schema";
import {
  requireAuth,
  requireRole,
} from "../middleware/auth";
import { storage } from "../storage";
import { users } from "../../migrations/schema";

export const usersRoutes = Router();

// Authentication routes
usersRoutes.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username and password are required" });
    }

    const user = await storage.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: "Account is disabled" });
    }

    req.session.userId = user.id;
    req.session.userRole = user.role;

    // Ensure session is saved before responding to avoid race conditions
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res
          .status(500)
          .json({ message: "Login failed to save session" });
      }
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

usersRoutes.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ message: "Logout failed" });
    }
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out successfully" });
  });
});

usersRoutes.get("/api/auth/me", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = await storage.getUser(req.session.userId!); // Added non-null assertion
    if (!user || !user.isActive) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "User not found or inactive" });
    }

    // Update session timestamp to keep it alive
    req.session.touch();

    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ message: "Failed to get user info" });
  }
});

// User management routes
usersRoutes.get(
  "/api/users",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const users = await storage.getUsers();
      const usersWithoutPasswords = users.map(
        ({ password, ...user }) => user,
      );
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ message: "Failed to get users" });
    }
  },
);

usersRoutes.get(
  "/api/users/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Failed to get user" });
    }
  },
);

usersRoutes.post(
  "/api/users",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const { employeeId, ...userData } = req.body;
      const parsedUserData = insertUserSchema.parse(userData);

      // Validate employeeId if provided
      if (
        employeeId !== undefined &&
        employeeId !== null &&
        employeeId !== ""
      ) {
        const empId = parseInt(employeeId);
        if (isNaN(empId)) {
          return res
            .status(400)
            .json({ message: "Invalid employee ID format" });
        }
        const employee = await storage.getEmployee(empId);
        if (!employee) {
          return res.status(404).json({ message: "Employee not found" });
        }
        if (employee.userId) {
          return res.status(400).json({
            message: "This employee is already linked to another user",
          });
        }
      }

      const existingUsername = await storage.getUserByUsername(
        parsedUserData.username,
      );
      if (existingUsername) {
        return res
          .status(409)
          .json({ message: "A user with this username already exists" });
      }

      const existingEmail = await storage.getUserByEmail(parsedUserData.email);
      if (existingEmail) {
        return res
          .status(409)
          .json({ message: "A user with this email already exists" });
      }

      const user = await storage.createUser(parsedUserData);

      // Link employee to user if employeeId provided
      if (
        employeeId !== undefined &&
        employeeId !== null &&
        employeeId !== ""
      ) {
        await storage.updateEmployee(parseInt(employeeId), {
          userId: user.id,
        });
      }
      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid user data", errors: error.errors });
      }
      // Backstop for the race the checks above cannot close, and for the other
      // paths that create users (the employee module and the database seed).
      if (error.code === "23505") {
        const field = String(error.constraint || "").includes("email")
          ? "email"
          : "username";
        return res
          .status(409)
          .json({ message: `A user with this ${field} already exists` });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  },
);

usersRoutes.put(
  "/api/users/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { employeeId, ...userData } = req.body;

      if (userData.password) {
        userData.password = await bcrypt.hash(userData.password, 10);
      }

      // Check if user already has a linked employee
      const allEmployees = await storage.getEmployees();
      const existingLinkedEmployee = allEmployees.find(
        (e) => e.userId === id,
      );

      // If user already has a linked employee, reject any attempt to change it
      if (existingLinkedEmployee) {
        // Check if employeeId is provided and differs from existing link
        if (
          employeeId !== undefined &&
          employeeId !== null &&
          employeeId !== ""
        ) {
          const providedEmpId = parseInt(employeeId);
          if (providedEmpId !== existingLinkedEmployee.id) {
            return res.status(400).json({
              message: "Cannot change employee link once established",
            });
          }
        }
      } else if (
        employeeId !== undefined &&
        employeeId !== null &&
        employeeId !== ""
      ) {
        // No existing link, validate and link new employee
        const empId = parseInt(employeeId);
        if (isNaN(empId)) {
          return res
            .status(400)
            .json({ message: "Invalid employee ID format" });
        }
        const employee = await storage.getEmployee(empId);
        if (!employee) {
          return res.status(404).json({ message: "Employee not found" });
        }
        if (employee.userId && employee.userId !== id) {
          return res.status(400).json({
            message: "This employee is already linked to another user",
          });
        }
        await storage.updateEmployee(empId, { userId: id });
      }

      if (userData.username) {
        const existingUsername = await storage.getUserByUsername(
          userData.username,
        );
        if (existingUsername && existingUsername.id !== id) {
          return res
            .status(409)
            .json({ message: "A user with this username already exists" });
        }
      }

      if (userData.email) {
        const existingEmail = await storage.getUserByEmail(userData.email);
        if (existingEmail && existingEmail.id !== id) {
          return res
            .status(409)
            .json({ message: "A user with this email already exists" });
        }
      }

      const user = await storage.updateUser(id, userData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      if (error.code === "23505") {
        const field = String(error.constraint || "").includes("email")
          ? "email"
          : "username";
        return res
          .status(409)
          .json({ message: `A user with this ${field} already exists` });
      }
      res.status(500).json({ message: "Failed to update user" });
    }
  },
);

usersRoutes.delete(
  "/api/users/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteUser(id);
      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  },
);

//Profile
usersRoutes.post("/api/auth/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.session.userId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    await storage.changePassword(userId!, currentPassword, newPassword);

    res.json({ message: "Password changed successfully" });
  } catch (error: any) {
    console.error("Change password error:", error);
    res.status(400).json({ message: error.message });
  }
});
