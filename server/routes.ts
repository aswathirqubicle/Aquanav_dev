import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { assetRoutes } from "./asset-routes";
import bcrypt from "bcrypt";
import session from "express-session";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  insertUserSchema,
  insertProjectSchema,
  insertCustomerSchema,
  insertEmployeeSchema,
  insertEmployeeNextOfKinSchema,
  insertEmployeeTrainingRecordSchema,
  insertEmployeeDocumentSchema,
  insertInventoryItemSchema,

  insertDailyActivitySchema,
  insertSupplierSchema,
  insertSupplierInventoryItemSchema,
  insertProjectPhotoGroupSchema,
  insertProjectPhotoSchema,

  insertPayrollEntrySchema,
  insertCustomerDocumentSchema,
  insertSupplierDocumentSchema,
} from "@shared/schema";
import { ZodError } from "zod";
import {
  desc,
  eq,
  and,
  gte,
  lte,
  isNull,
  or,
  asc,
  like,
  sum,
  count,
  sql,
} from "drizzle-orm";
import {
  users,
  companies,
  customers,
  suppliers,
  employees,
  projects,
  inventory,
  inventoryTransactions,
  dailyActivities,
  photos,
  projectConsumables,
  projectConsumableItems,
  inventoryItems,
  supplierInventoryItems,
  purchaseRequestItems,
  salesQuotationItems,
  salesInvoiceItems,
  invoicePayments,
  purchaseRequestSuppliers,
  payrollEntries,
  payrollAdditions,
  payrollDeductions,
  purchaseOrders,
  purchaseOrderItems,

  errorLogs,
  creditNotes,
} from "../migrations/schema";

function generateQuotationHTML(
  quotation: any,
  customer: any,
  company: any,
): string {
  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString();
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Quotation ${quotation.quotationNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { text-align: center; margin-bottom: 30px; }
        .company-info { margin-bottom: 30px; }
        .quotation-info { margin-bottom: 30px; }
        .customer-info { margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .total-row { font-weight: bold; }
        .text-right { text-align: right; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>SALES QUOTATION</h1>
        <h2>${quotation.quotationNumber}</h2>
      </div>

      <div class="company-info">
        <h3>${company.name}</h3>
        <p>${company.address || ""}</p>
        <p>Phone: ${company.phone || ""} | Email: ${company.email || ""}</p>
        ${company.website ? `<p>Website: ${company.website}</p>` : ""}
      </div>

      <div class="quotation-info">
        <p><strong>Date:</strong> ${formatDate(quotation.createdDate)}</p>
        ${quotation.validUntil ? `<p><strong>Valid Until:</strong> ${formatDate(quotation.validUntil)}</p>` : ""}
        <p><strong>Status:</strong> ${quotation.status}</p>
      </div>

      <div class="customer-info">
        <h3>Bill To:</h3>
        <p><strong>${customer.name}</strong></p>
        ${customer.contactPerson ? `<p>Contact: ${customer.contactPerson}</p>` : ""}
        ${customer.address ? `<p>${customer.address}</p>` : ""}
        ${customer.phone ? `<p>Phone: ${customer.phone}</p>` : ""}
        ${customer.email ? `<p>Email: ${customer.email}</p>` : ""}
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="text-right">Qty</th>
            <th class="text-right">Unit Price</th>
            <th class="text-right">Tax Rate</th>
            <th class="text-right">Tax Amount</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${(quotation.items || [])
            .map((item: any) => {
              const lineSubtotal = item.quantity * item.unitPrice;
              const taxAmount = lineSubtotal * ((item.taxRate || 0) / 100);
              const lineTotal = lineSubtotal + taxAmount;
              return `
            <tr>
              <td>${item.description}</td>
              <td class="text-right">${item.quantity}</td>
              <td class="text-right">${formatCurrency(item.unitPrice)}</td>
              <td class="text-right">${item.taxRate || 0}%</td>
              <td class="text-right">${formatCurrency(taxAmount)}</td>
              <td class="text-right">${formatCurrency(lineTotal)}</td>
            </tr>
            `;
            })
            .join("")}
        </tbody>
      </table>

      <div style="margin-top: 30px;">
        <table style="width: 300px; margin-left: auto;">
          <tr>
            <td><strong>Subtotal:</strong></td>
            <td class="text-right">${formatCurrency(quotation.subtotal || 0)}</td>
          </tr>
          ${
            quotation.discount && parseFloat(quotation.discount) > 0
              ? `
          <tr>
            <td><strong>Discount:</strong></td>
            <td class="text-right">-${formatCurrency(quotation.discount)}</td>
          </tr>
          `
              : ""
          }
          <tr>
            <td><strong>Tax Amount:</strong></td>
            <td class="text-right">${formatCurrency(quotation.taxAmount || 0)}</td>
          </tr>
          <tr class="total-row">
            <td><strong>Total Amount:</strong></td>
            <td class="text-right">${formatCurrency(quotation.totalAmount || 0)}</td>
          </tr>
        </table>
      </div>

      <div style="margin-top: 50px;">
        <p><strong>Terms and Conditions:</strong></p>
        <p>This quotation is valid until ${quotation.validUntil ? formatDate(quotation.validUntil) : "further notice"}.</p>
        <p>Payment terms: Net 30 days</p>
      </div>
    </body>
    </html>
  `;
}

function generateCreditNoteHTML(
  creditNote: any,
  customer: any,
  company: any,
): string {
  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString();
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Credit Note ${creditNote.creditNoteNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { text-align: center; margin-bottom: 30px; }
        .company-info { margin-bottom: 30px; }
        .company-logo { max-width: 200px; height: auto; margin-bottom: 20px; }
        .credit-note-info { margin-bottom: 30px; }
        .customer-info { margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .total-row { font-weight: bold; }
        .text-right { text-align: right; }
        .status-draft { color: orange; }
        .status-issued { color: green; }
        .status-cancelled { color: red; }
      </style>
    </head>
    <body>
      <div class="header">
        ${company.logo ? `<img src="${company.logo}" alt="${company.name}" class="company-logo" />` : ""}
        <h1>CREDIT NOTE</h1>
        <h2>${creditNote.creditNoteNumber}</h2>
      </div>

      <div class="company-info">
        <h3>${company.name}</h3>
        <p>${company.address || ""}</p>
        <p>Phone: ${company.phone || ""} | Email: ${company.email || ""}</p>
        ${company.website ? `<p>Website: ${company.website}</p>` : ""}
      </div>

      <div class="credit-note-info">
        <p><strong>Credit Note Date:</strong> ${formatDate(creditNote.creditNoteDate)}</p>
        <p><strong>Status:</strong> <span class="status-${creditNote.status}">${creditNote.status.toUpperCase()}</span></p>
        ${creditNote.reason ? `<p><strong>Reason:</strong> ${creditNote.reason}</p>` : ""}
        ${creditNote.invoiceNumber ? `<p><strong>Related Invoice:</strong> ${creditNote.invoiceNumber}</p>` : ""}
      </div>

      <div class="customer-info">
        <h3>Credit To:</h3>
        <p><strong>${customer.name}</strong></p>
        ${customer.contactPerson ? `<p>Contact: ${customer.contactPerson}</p>` : ""}
        ${customer.address ? `<p>${customer.address}</p>` : ""}
        ${customer.phone ? `<p>Phone: ${customer.phone}</p>` : ""}
        ${customer.email ? `<p>Email: ${customer.email}</p>` : ""}
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="text-right">Qty</th>
            <th class="text-right">Unit Price</th>
            <th class="text-right">Tax Rate</th>
            <th class="text-right">Tax Amount</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${(creditNote.items || [])
            .map((item: any) => {
              const lineSubtotal = item.quantity * item.unitPrice;
              const taxAmount = lineSubtotal * ((item.taxRate || 0) / 100);
              const lineTotal = lineSubtotal + taxAmount;
              return `
            <tr>
              <td>${item.description}</td>
              <td class="text-right">${item.quantity}</td>
              <td class="text-right">${formatCurrency(item.unitPrice)}</td>
              <td class="text-right">${item.taxRate || 0}%</td>
              <td class="text-right">${formatCurrency(taxAmount)}</td>
              <td class="text-right">${formatCurrency(lineTotal)}</td>
            </tr>
            `;
            })
            .join("")}
        </tbody>
      </table>

      <div style="margin-top: 30px;">
        <table style="width: 300px; margin-left: auto;">
          <tr>
            <td><strong>Subtotal:</strong></td>
            <td class="text-right">${formatCurrency(creditNote.subtotal || 0)}</td>
          </tr>
          ${
            creditNote.discount && parseFloat(creditNote.discount) > 0
              ? `
          <tr>
            <td><strong>Discount:</strong></td>
            <td class="text-right">-${formatCurrency(creditNote.discount)}</td>
          </tr>
          `
              : ""
          }
          <tr>
            <td><strong>Tax Amount:</strong></td>
            <td class="text-right">${formatCurrency(creditNote.taxAmount || 0)}</td>
          </tr>
          <tr class="total-row">
            <td><strong>Credit Amount:</strong></td>
            <td class="text-right">${formatCurrency(creditNote.totalAmount || 0)}</td>
          </tr>
        </table>
      </div>

      <div style="margin-top: 50px;">
        <p><strong>Payment Terms:</strong></p>
        <p>${creditNote.paymentTerms || "This credit note will be applied to your account balance."}</p>
        ${creditNote.remarks ? `<p><strong>Remarks:</strong> ${creditNote.remarks}</p>` : ""}
        <p>Thank you for your business!</p>
      </div>
    </body>
    </html>
  `;
}

function generateInvoiceHTML(
  invoice: any,
  customer: any,
  company: any,
): string {
  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString();
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${invoice.invoiceNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { text-align: center; margin-bottom: 30px; }
        .company-info { margin-bottom: 30px; }
        .invoice-info { margin-bottom: 30px; }
        .customer-info { margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .total-row { font-weight: bold; }
        .text-right { text-align: right; }
        .status-paid { color: green; }
        .status-unpaid { color: red; }
        .status-partial { color: orange; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>INVOICE</h1>
        <h2>${invoice.invoiceNumber}</h2>
      </div>

      <div class="company-info">
        <h3>${company.name}</h3>
        <p>${company.address || ""}</p>
        <p>Phone: ${company.phone || ""} | Email: ${company.email || ""}</p>
        ${company.website ? `<p>Website: ${company.website}</p>` : ""}
      </div>

      <div class="invoice-info">
        <p><strong>Invoice Date:</strong> ${formatDate(invoice.invoiceDate)}</p>
        <p><strong>Due Date:</strong> ${formatDate(invoice.dueDate)}</p>
        <p><strong>Status:</strong> <span class="status-${invoice.status}">${invoice.status.toUpperCase()}</span></p>
      </div>

      <div class="customer-info">
        <h3>Bill To:</h3>
        <p><strong>${customer.name}</strong></p>
        ${customer.contactPerson ? `<p>Contact: ${customer.contactPerson}</p>` : ""}
        ${customer.address ? `<p>${customer.address}</p>` : ""}
        ${customer.phone ? `<p>Phone: ${customer.phone}</p>` : ""}
        ${customer.email ? `<p>Email: ${customer.email}</p>` : ""}
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="text-right">Qty</th>
            <th class="text-right">Unit Price</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${(invoice.items || [])
            .map((item: any) => {
              const lineTotal = item.quantity * item.unitPrice;
              return `
            <tr>
              <td>${item.description}</td>
              <td class="text-right">${item.quantity}</td>
              <td class="text-right">${formatCurrency(item.unitPrice)}</td>
              <td class="text-right">${formatCurrency(lineTotal)}</td>
            </tr>
            `;
            })
            .join("")}
        </tbody>
      </table>

      <div style="margin-top: 30px;">
        <table style="width: 300px; margin-left: auto;">
          <tr>
            <td><strong>Subtotal:</strong></td>
            <td class="text-right">${formatCurrency(invoice.subtotal || 0)}</td>
          </tr>
          ${
            invoice.discount && parseFloat(invoice.discount) > 0
              ? `
          <tr>
            <td><strong>Discount:</strong></td>
            <td class="text-right">-${formatCurrency(invoice.discount)}</td>
          </tr>
          `
              : ""
          }
          <tr>
            <td><strong>Tax Amount:</strong></td>
            <td class="text-right">${formatCurrency(invoice.taxAmount || 0)}</td>
          </tr>
          <tr class="total-row">
            <td><strong>Total Amount:</strong></td>
            <td class="text-right">${formatCurrency(invoice.totalAmount || 0)}</td>
          </tr>
          ${
            invoice.paidAmount && parseFloat(invoice.paidAmount) > 0
              ? `
          <tr>
            <td><strong>Paid Amount:</strong></td>
            <td class="text-right">${formatCurrency(invoice.paidAmount)}</td>
          </tr>
          <tr class="total-row">
            <td><strong>Balance Due:</strong></td>
            <td class="text-right">${formatCurrency((parseFloat(invoice.totalAmount || "0") - parseFloat(invoice.paidAmount)).toFixed(2))}</td>
          </tr>
          `
              : ""
          }
        </table>
      </div>

      <div style="margin-top: 50px;">
        <p><strong>Payment Terms:</strong></p>
        <p>Payment is due within 30 days of invoice date.</p>
        <p>Thank you for your business!</p>
      </div>
    </body>
    </html>
  `;
}

declare module "express-session" {
  interface SessionData {
    userId?: number;
    userRole?: string;
  }
}

// Configure multer for file uploads
const storage_multer = multer.diskStorage({
  destination: function (req, file, cb) {
    // Determine directory based on route
    let uploadDir = "uploads/payment-files";
    if (req.route?.path?.includes('customer-documents')) {
      uploadDir = "uploads/customer-documents";
    } else if (req.route?.path?.includes('supplier-documents')) {
      uploadDir = "uploads/supplier-documents";
    }
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

const upload = multer({
  storage: storage_multer,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Allow common document and image types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|csv|xlsx|xls/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only document and image files are allowed"));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "aquanav-secret-key",
      resave: false,
      saveUninitialized: false,
      rolling: true, // Extend session on each request
      cookie: {
        secure: false, // Set to true in production with HTTPS
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true, // Prevent XSS attacks
        sameSite: "lax", // CSRF protection
      },
    }),
  );

  // Auth middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  };

  const requireRole = (roles: string[]) => {
    return (req: any, res: any, next: any) => {
      if (!req.session.userRole || !roles.includes(req.session.userRole)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      next();
    };
  };

  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
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

      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
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
  app.get(
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

  app.get(
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

  app.post(
    "/api/users",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const userData = insertUserSchema.parse(req.body);
        const user = await storage.createUser(userData);
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      } catch (error) {
        if (error instanceof ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid user data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create user" });
      }
    },
  );

  app.put(
    "/api/users/:id",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const userData = req.body;

        if (userData.password) {
          userData.password = await bcrypt.hash(userData.password, 10);
        }

        const user = await storage.updateUser(id, userData);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      } catch (error) {
        res.status(500).json({ message: "Failed to update user" });
      }
    },
  );

  app.delete(
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

  // Dashboard routes
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      const projects = await storage.getProjects();
      const inventoryItems = await storage.getInventoryItems();

      // Current month calculations
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
      
      // Previous month calculations
      const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

      // Filter projects by current month
      const currentMonthProjects = projects.filter(p => {
        const projectDate = new Date(p.createdAt);
        return projectDate.getMonth() === currentMonth && projectDate.getFullYear() === currentYear;
      });

      // Filter projects by previous month  
      const previousMonthProjects = projects.filter(p => {
        const projectDate = new Date(p.createdAt);
        return projectDate.getMonth() === previousMonth && projectDate.getFullYear() === previousYear;
      });

      // Current stats
      const activeProjects = projects.filter(p => p.status === "in_progress").length;
      const completedProjects = projects.filter(p => p.status === "completed").length;
      const lowStockItems = inventoryItems.filter(item => item.currentStock <= item.minStockLevel).length;

      // Previous stats for comparison
      const previousActiveProjects = previousMonthProjects.filter(p => p.status === "in_progress").length;
      const previousCompletedProjects = previousMonthProjects.filter(p => p.status === "completed").length;
      const previousLowStockItems = Math.max(0, lowStockItems - 1); // Simulate previous month data

      // Revenue calculations
      const currentMonthRevenue = currentMonthProjects.reduce((sum, project) => {
        return sum + parseFloat(project.actualCost || "0");
      }, 0);
      
      const previousMonthRevenue = previousMonthProjects.reduce((sum, project) => {
        return sum + parseFloat(project.actualCost || "0");
      }, 0);

      // Calculate changes
      const activeProjectsChange = activeProjects - previousActiveProjects;
      const completedProjectsChange = completedProjects - previousCompletedProjects;
      const lowStockItemsChange = lowStockItems - previousLowStockItems;
      const monthlyRevenueChange = currentMonthRevenue - previousMonthRevenue;
      
      // Calculate percentage change for revenue
      const monthlyRevenuePercentageChange = previousMonthRevenue > 0 
        ? Math.round(((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100)
        : 0;

      // Generate labels
      const activeProjectsChangeLabel = activeProjectsChange >= 0 
        ? `+${activeProjectsChange} from last month`
        : `${activeProjectsChange} from last month`;
      
      const completedProjectsChangeLabel = completedProjectsChange >= 0
        ? `+${completedProjectsChange} vs target`
        : `${completedProjectsChange} vs target`;
        
      const lowStockItemsChangeLabel = lowStockItems > 0 
        ? "Action needed"
        : "All items stocked";
        
      const monthlyRevenueChangeLabel = monthlyRevenuePercentageChange >= 0
        ? `+${monthlyRevenuePercentageChange}% from last month`
        : `${monthlyRevenuePercentageChange}% from last month`;

      res.json({
        activeProjects,
        activeProjectsChange,
        activeProjectsChangeLabel,
        completedProjects,
        completedProjectsChange,
        completedProjectsChangeLabel,
        lowStockItems,
        lowStockItemsChange,
        lowStockItemsChangeLabel,
        monthlyRevenue: currentMonthRevenue,
        monthlyRevenueChange,
        monthlyRevenueChangeLabel,
        monthlyRevenuePercentageChange,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get dashboard stats" });
    }
  });

  // Company routes
  app.get("/api/company", requireAuth, async (req, res) => {
    try {
      const company = await storage.getCompany();
      res.json(company);
    } catch (error) {
      res.status(500).json({ message: "Failed to get company info" });
    }
  });

  app.put(
    "/api/company",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const companyData = req.body;
        const company = await storage.updateCompany(companyData);
        res.json(company);
      } catch (error) {
        console.error("Update company error:", error);
        res.status(500).json({ message: "Failed to update company info" });
      }
    },
  );

  // Customer routes
  app.get("/api/customers", requireAuth, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";
      const showArchived = req.query.showArchived === "true";

      const result = await storage.getCustomersPaginated(
        page,
        limit,
        search,
        showArchived,
      );
      res.json(result);
    } catch (error) {
      console.error("Get customers error:", error);
      res.status(500).json({ message: "Failed to get customers" });
    }
  });

  app.post(
    "/api/customers",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const customerData = insertCustomerSchema.parse(req.body);
        const customer = await storage.createCustomer(customerData);
        res.status(201).json(customer);
      } catch (error) {
        if (error instanceof ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create customer" });
      }
    },
  );

  app.put(
    "/api/customers/:id",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const customerData = req.body;
        const customer = await storage.updateCustomer(id, customerData);

        if (!customer) {
          return res.status(404).json({ message: "Customer not found" });
        }

        res.json(customer);
      } catch (error) {
        res.status(500).json({ message: "Failed to update customer" });
      }
    },
  );

  app.put(
    "/api/customers/:id/archive",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const customer = await storage.updateCustomer(id, { isArchived: true });

        if (!customer) {
          return res.status(404).json({ message: "Customer not found" });
        }

        res.json({ message: "Customer archived successfully", customer });
      } catch (error) {
        res.status(500).json({ message: "Failed to archive customer" });
      }
    },
  );

  app.put(
    "/api/customers/:id/unarchive",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const customer = await storage.updateCustomer(id, {
          isArchived: false,
        });

        if (!customer) {
          return res.status(404).json({ message: "Customer not found" });
        }

        res.json({ message: "Customer unarchived successfully", customer });
      } catch (error) {
        res.status(500).json({ message: "Failed to unarchive customer" });
      }
    },
  );

  // Supplier routes
  app.get("/api/suppliers", requireAuth, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";
      const showArchived = req.query.showArchived === "true";

      const result = await storage.getSuppliersPaginated(
        page,
        limit,
        search,
        showArchived,
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get suppliers" });
    }
  });

  app.post(
    "/api/suppliers",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const supplierData = insertSupplierSchema.parse(req.body);
        const supplier = await storage.createSupplier(supplierData);
        res.status(201).json(supplier);
      } catch (error) {
        if (error instanceof ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create supplier" });
      }
    },
  );

  app.put(
    "/api/suppliers/:id",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const supplierData = req.body;
        const supplier = await storage.updateSupplier(id, supplierData);

        if (!supplier) {
          return res.status(404).json({ message: "Supplier not found" });
        }

        res.json(supplier);
      } catch (error) {
        res.status(500).json({ message: "Failed to update supplier" });
      }
    },
  );

  app.delete(
    "/api/suppliers/:id",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const deleted = await storage.deleteSupplier(id);
        if (!deleted) {
          return res.status(404).json({ message: "Supplier not found" });
        }
        res.json({ message: "Supplier deleted successfully" });
      } catch (error) {
        res.status(500).json({ message: "Failed to delete supplier" });
      }
    },
  );

  // Supplier-specific routes
  app.get("/api/suppliers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const supplier = await storage.getSupplier(id);
      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }
      res.json(supplier);
    } catch (error) {
      res.status(500).json({ message: "Failed to get supplier" });
    }
  });

  app.get("/api/suppliers/:id/products", requireAuth, async (req, res) => {
    try {
      const supplierId = parseInt(req.params.id);
      // For now, return inventory items that could be supplied by this supplier
      // In a real application, you'd have a supplier-product relationship table
      const products = await storage.getInventoryItems();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to get supplier products" });
    }
  });

  // Employee routes
  app.put("/api/employees/:id", requireAuth, requireRole(["admin", "project_manager"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = req.body;
      
      // Convert date strings to Date objects
      if (updateData.hireDate) {
        updateData.hireDate = new Date(updateData.hireDate);
      }
      if (updateData.dateOfBirth) {
        updateData.dateOfBirth = new Date(updateData.dateOfBirth);
      }
      
      const parsedData = insertEmployeeSchema.parse(updateData);
      const result = await storage.updateEmployee(id, parsedData);
      if (!result) {
        return res.status(404).json({ message: "Employee not found" });
      }
      res.json(result);
    } catch (error) {
      console.error('Update employee error:', error);
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update employee" });
    }
  });

  app.get("/api/employees", requireAuth, async (req, res) => {
    try {
      const employees = await storage.getEmployees();
      res.json(employees);
    } catch (error) {
      res.status(500).json({ message: "Failed to get employees" });
    }
  });

  app.post(
    "/api/employees",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const { createUserAccount, ...employeeData } = req.body;

        console.log("Received employee data:", employeeData);

        // Convert hireDate string to Date object if provided
        if (
          employeeData.hireDate &&
          typeof employeeData.hireDate === "string" &&
          employeeData.hireDate.trim() !== ""
        ) {
          employeeData.hireDate = new Date(employeeData.hireDate);
        } else {
          employeeData.hireDate = null;
        }

        // Ensure category has a default value
        if (!employeeData.category || employeeData.category.trim() === "") {
          employeeData.category = "permanent";
        }

        // Convert salary to decimal string if provided
        if (employeeData.salary && typeof employeeData.salary === "number") {
          employeeData.salary = employeeData.salary.toString();
        } else if (
          employeeData.salary &&
          typeof employeeData.salary === "string" &&
          employeeData.salary.trim() === ""
        ) {
          employeeData.salary = null;
        }

        // Clean up null/empty string fields
        Object.keys(employeeData).forEach((key) => {
          if (employeeData[key] === "" || employeeData[key] === undefined) {
            employeeData[key] = null;
          }
        });

        // Ensure required fields are not null
        if (!employeeData.firstName || employeeData.firstName.trim() === "") {
          return res.status(400).json({ message: "First name is required" });
        }
        if (!employeeData.lastName || employeeData.lastName.trim() === "") {
          return res.status(400).json({ message: "Last name is required" });
        }
        if (
          !employeeData.employeeCode ||
          employeeData.employeeCode.trim() === ""
        ) {
          return res.status(400).json({ message: "Employee code is required" });
        }

        console.log("Processed employee data:", employeeData);

        const parsedEmployeeData = insertEmployeeSchema.parse(employeeData);
        const employee = await storage.createEmployee(parsedEmployeeData);

        // Create user account only if explicitly requested and email is provided
        if (createUserAccount && employee.email && employee.email.trim()) {
          try {
            const username =
              `${employee.firstName.toLowerCase()}.${employee.lastName.toLowerCase()}`.replace(
                /\s+/g,
                "",
              );
            const defaultPassword = `${employee.employeeCode}@${new Date().getFullYear()}`;

            const userData = {
              username: username,
              email: employee.email.trim(),
              password: defaultPassword,
              role: "employee" as const,
              isActive: employee.isActive,
            };

            const user = await storage.createUser(userData);

            // Link the user to the employee
            await storage.updateEmployee(employee.id, { userId: user.id });

            res.status(201).json({
              ...employee,
              userId: user.id,
              generatedCredentials: {
                username: username,
                password: defaultPassword,
                message:
                  "User account created successfully. Please share these credentials with the employee.",
              },
            });
          } catch (userError) {
            console.error("User creation error:", userError);
            // If user creation fails, still return the employee but with a warning
            res.status(201).json({
              ...employee,
              warning:
                "Employee created but user account creation failed. Please create manually.",
            });
          }
        } else {
          res.status(201).json(employee);
        }
      } catch (error) {
        console.error("Employee creation error:", error);
        if (error instanceof ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create employee" });
      }
    },
  );

  // Update employee
  app.put(
    "/api/employees/:id",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const employeeId = parseInt(req.params.id);
        const updateData = req.body;

        // Convert hireDate string to Date object if provided
        if (updateData.hireDate && typeof updateData.hireDate === "string") {
          updateData.hireDate = new Date(updateData.hireDate);
        }

        // Remove undefined/null values to avoid overwriting with nulls
        const cleanedData = Object.fromEntries(
          Object.entries(updateData).filter(
            ([_, value]) => value !== undefined,
          ),
        );

        const updatedEmployee = await storage.updateEmployee(
          employeeId,
          cleanedData,
        );
        res.json(updatedEmployee);
      } catch (error) {
        console.error("Employee update error:", error);
        if (error instanceof ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to update employee" });
      }
    },
  );

  // Get single employee with full details
  app.get("/api/employees/:id", requireAuth, async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const employee = await storage.getEmployee(employeeId);
      
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      
      res.json(employee);
    } catch (error) {
      res.status(500).json({ message: "Failed to get employee" });
    }
  });

  // Employee Next of Kin routes
  app.get("/api/employees/:id/next-of-kin", requireAuth, async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const nextOfKin = await storage.getEmployeeNextOfKin(employeeId);
      res.json(nextOfKin);
    } catch (error) {
      res.status(500).json({ message: "Failed to get next of kin data" });
    }
  });

  app.get("/api/employees/:id/next-of-kin", requireAuth, async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const nextOfKinRecords = await storage.getEmployeeNextOfKin(employeeId);
      res.json(nextOfKinRecords);
    } catch (error) {
      res.status(500).json({ message: "Failed to get next of kin records" });
    }
  });

  app.post("/api/employees/:id/next-of-kin", requireAuth, requireRole(["admin", "project_manager"]), async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const nextOfKinData = { ...req.body, employeeId };
      
      const parsedData = insertEmployeeNextOfKinSchema.parse(nextOfKinData);
      const result = await storage.createEmployeeNextOfKin(parsedData);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create next of kin record" });
    }
  });

  app.put("/api/employees/next-of-kin/:id", requireAuth, requireRole(["admin", "project_manager"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = req.body;
      
      const result = await storage.updateEmployeeNextOfKin(id, updateData);
      if (!result) {
        return res.status(404).json({ message: "Next of kin record not found" });
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to update next of kin record" });
    }
  });

  app.delete("/api/employees/next-of-kin/:id", requireAuth, requireRole(["admin", "project_manager"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteEmployeeNextOfKin(id);
      
      if (!success) {
        return res.status(404).json({ message: "Next of kin record not found" });
      }
      res.json({ message: "Next of kin record deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete next of kin record" });
    }
  });

  // Employee Training Records routes
  app.get("/api/employees/:id/training-records", requireAuth, async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const trainingRecords = await storage.getEmployeeTrainingRecords(employeeId);
      res.json(trainingRecords);
    } catch (error) {
      res.status(500).json({ message: "Failed to get training records" });
    }
  });

  app.post("/api/employees/:id/training-records", requireAuth, requireRole(["admin", "project_manager"]), async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const trainingData = { ...req.body, employeeId };
      
      // Convert date strings to Date objects and format them properly
      if (trainingData.trainingDate) {
        const date = new Date(trainingData.trainingDate);
        trainingData.trainingDate = date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
      }
      if (trainingData.expiryDate) {
        const date = new Date(trainingData.expiryDate);
        trainingData.expiryDate = date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
      }
      
      const parsedData = insertEmployeeTrainingRecordSchema.parse(trainingData);
      const result = await storage.createEmployeeTrainingRecord(parsedData);
      res.status(201).json(result);
    } catch (error) {
      console.error('Training record creation error:', error);
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create training record" });
    }
  });

  app.put("/api/employees/training-records/:id", requireAuth, requireRole(["admin", "project_manager"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = req.body;
      
      // Convert date strings to Date objects
      if (updateData.trainingDate) {
        updateData.trainingDate = new Date(updateData.trainingDate);
      }
      if (updateData.expiryDate) {
        updateData.expiryDate = new Date(updateData.expiryDate);
      }
      
      const result = await storage.updateEmployeeTrainingRecord(id, updateData);
      if (!result) {
        return res.status(404).json({ message: "Training record not found" });
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to update training record" });
    }
  });

  app.delete("/api/employees/training-records/:id", requireAuth, requireRole(["admin", "project_manager"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteEmployeeTrainingRecord(id);
      
      if (!success) {
        return res.status(404).json({ message: "Training record not found" });
      }
      res.json({ message: "Training record deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete training record" });
    }
  });

  // Employee Documents routes
  app.get("/api/employees/:id/documents", requireAuth, async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const documents = await storage.getEmployeeDocuments(employeeId);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: "Failed to get employee documents" });
    }
  });

  app.post("/api/employees/:id/documents", requireAuth, requireRole(["admin", "project_manager"]), async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const documentData = { ...req.body, employeeId };
      
      // Convert date strings to Date objects
      if (documentData.dateOfIssue) {
        documentData.dateOfIssue = new Date(documentData.dateOfIssue);
      }
      if (documentData.expiryDate) {
        documentData.expiryDate = new Date(documentData.expiryDate);
      }
      if (documentData.validTill) {
        documentData.validTill = new Date(documentData.validTill);
      }
      
      const parsedData = insertEmployeeDocumentSchema.parse(documentData);
      const result = await storage.createEmployeeDocument(parsedData);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create employee document" });
    }
  });

  app.put("/api/employees/documents/:id", requireAuth, requireRole(["admin", "project_manager"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = req.body;
      
      // Convert date strings to Date objects
      if (updateData.dateOfIssue) {
        updateData.dateOfIssue = new Date(updateData.dateOfIssue);
      }
      if (updateData.expiryDate) {
        updateData.expiryDate = new Date(updateData.expiryDate);
      }
      if (updateData.validTill) {
        updateData.validTill = new Date(updateData.validTill);
      }
      
      const result = await storage.updateEmployeeDocument(id, updateData);
      if (!result) {
        return res.status(404).json({ message: "Employee document not found" });
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to update employee document" });
    }
  });

  app.delete("/api/employees/documents/:id", requireAuth, requireRole(["admin", "project_manager"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteEmployeeDocument(id);
      
      if (!success) {
        return res.status(404).json({ message: "Employee document not found" });
      }
      res.json({ message: "Employee document deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete employee document" });
    }
  });

  // Get expiring employee documents for notification
  app.get("/api/employees/expiring-employee-documents", requireAuth, requireRole(["admin", "project_manager"]), async (req, res) => {
    try {
      const daysAhead = parseInt(req.query.daysAhead as string) || 30;
      const expiringDocs = await storage.getExpiringEmployeeDocuments(daysAhead);
      res.json(expiringDocs);
    } catch (error) {
      res.status(500).json({ message: "Failed to get expiring employee documents" });
    }
  });

  // Get expiring documents for notification
  app.get("/api/employees/expiring-documents", requireAuth, requireRole(["admin", "project_manager"]), async (req, res) => {
    try {
      const daysAhead = parseInt(req.query.daysAhead as string) || 30;
      const expiringDocs = await storage.getExpiringDocuments(daysAhead);
      res.json(expiringDocs);
    } catch (error) {
      res.status(500).json({ message: "Failed to get expiring documents" });
    }
  });

  // Generate employment contract
  app.get("/api/employees/:id/employment-contract", requireAuth, requireRole(["admin", "project_manager"]), async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const contractHtml = await storage.generateEmploymentContract(employeeId);
      
      res.setHeader('Content-Type', 'text/html');
      res.send(contractHtml);
    } catch (error) {
      if (error.message === 'Employee not found') {
        return res.status(404).json({ message: "Employee not found" });
      }
      res.status(500).json({ message: "Failed to generate employment contract" });
    }
  });

  // Project routes
  app.get("/api/projects", requireAuth, async (req, res) => {
    try {
      let projects = await storage.getProjects();

      // Filter by customer for customer role
      if (req.session.userRole === "customer") {
        const user = await storage.getUser(req.session.userId!);
        if (user) {
          const customers = await storage.getCustomers();
          const customer = customers.find((c) => c.userId === user.id);
          if (customer) {
            projects = await storage.getProjectsByCustomer(customer.id);
          }
        }
      }

      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to get projects" });
    }
  });

  app.get("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const project = await storage.getProject(id);

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to get project" });
    }
  });

  app.post(
    "/api/projects",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        console.log("Received project data:", req.body);

        // Clean the data before validation
        const cleanData = { ...req.body };

        // Convert date strings to Date objects if they exist
        if (cleanData.startDate && typeof cleanData.startDate === "string") {
          cleanData.startDate = new Date(cleanData.startDate);
        }
        if (
          cleanData.plannedEndDate &&
          typeof cleanData.plannedEndDate === "string"
        ) {
          cleanData.plannedEndDate = new Date(cleanData.plannedEndDate);
        }

        // Convert estimatedBudget to string if it's a number
        if (
          cleanData.estimatedBudget &&
          typeof cleanData.estimatedBudget === "number"
        ) {
          cleanData.estimatedBudget = cleanData.estimatedBudget.toString();
        }

        // Ensure locations is an array (don't delete empty arrays)
        if (!cleanData.locations) {
          cleanData.locations = [];
        }

        // Remove undefined/null fields to avoid validation issues (but keep empty arrays)
        Object.keys(cleanData).forEach((key) => {
          if (
            cleanData[key] === undefined ||
            cleanData[key] === null ||
            (cleanData[key] === "" && key !== "locations")
          ) {
            delete cleanData[key];
          }
        });

        console.log("Cleaned project data:", cleanData);

        const projectData = insertProjectSchema.parse(cleanData);
        const project = await storage.createProject(projectData);
        res.status(201).json(project);
      } catch (error) {
        console.error("Project creation error:", error);
        if (error instanceof ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create project" });
      }
    },
  );

  app.put(
    "/api/projects/:id",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const projectData = { ...req.body };

        console.log("Received project update data:", projectData);

        // Handle date fields properly
        if (
          projectData.startDate &&
          typeof projectData.startDate === "string"
        ) {
          projectData.startDate = new Date(projectData.startDate);
        }
        if (
          projectData.plannedEndDate &&
          typeof projectData.plannedEndDate === "string"
        ) {
          projectData.plannedEndDate = new Date(projectData.plannedEndDate);
        }
        if (
          projectData.actualEndDate &&
          typeof projectData.actualEndDate === "string"
        ) {
          projectData.actualEndDate = new Date(projectData.actualEndDate);
        }

        // If status is being changed to completed, set actual end date
        if (projectData.status === "completed" && !projectData.actualEndDate) {
          projectData.actualEndDate = new Date();
        }

        // Ensure locations is properly handled - don't modify if it's already an array
        if (projectData.locations !== undefined) {
          if (!Array.isArray(projectData.locations)) {
            projectData.locations = [];
          }
          // Log the locations being saved
          console.log("Saving locations:", projectData.locations);
        }

        // Convert estimatedBudget to string if it's a number
        if (
          projectData.estimatedBudget &&
          typeof projectData.estimatedBudget === "number"
        ) {
          projectData.estimatedBudget = projectData.estimatedBudget.toString();
        }

        const project = await storage.updateProject(id, projectData);

        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }

        console.log(
          "Project updated successfully with locations:",
          project.locations,
        );

        // Recalculate cost if the project dates changed or status changed
        if (
          projectData.startDate ||
          projectData.actualEndDate ||
          projectData.status
        ) {
          await storage.recalculateProjectCost(id);
        }

        res.json(project);
      } catch (error) {
        console.error("Project update error:", error);
        res.status(500).json({ message: "Failed to update project" });
      }
    },
  );

  // Manual cost recalculation endpoint
  app.post(
    "/api/projects/:id/recalculate-cost",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.id);
        await storage.recalculateProjectCost(projectId);

        const updatedProject = await storage.getProject(projectId);
        res.json({
          message: "Project cost recalculated successfully",
          project: updatedProject,
        });
      } catch (error) {
        res.status(500).json({ message: "Failed to recalculate project cost" });
      }
    },
  );

  // Project revenue routes (restricted to admin and finance)
  app.get(
    "/api/projects/:id/revenue",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.id);
        const revenueData = await storage.getProjectRevenue(projectId);
        res.json(revenueData);
      } catch (error) {
        console.error("Get project revenue error:", error);
        res.status(500).json({ message: "Failed to get project revenue" });
      }
    },
  );

  app.get(
    "/api/projects/revenues",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const projectIds = req.query.projectIds as string;
        if (!projectIds) {
          return res.status(400).json({ message: "Project IDs are required" });
        }

        const ids = projectIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        if (ids.length === 0) {
          return res.status(400).json({ message: "Valid project IDs are required" });
        }

        const revenuePromises = ids.map(async (projectId) => {
          try {
            const revenueData = await storage.getProjectRevenue(projectId);
            return { projectId, ...revenueData };
          } catch (error) {
            console.error(`Failed to get revenue for project ${projectId}:`, error);
            return { projectId, error: true };
          }
        });

        const results = await Promise.all(revenuePromises);
        res.json(results.filter(result => !result.error));
      } catch (error) {
        console.error("Get bulk project revenues error:", error);
        res.status(500).json({ message: "Failed to get project revenues" });
      }
    },
  );

  app.post(
    "/api/projects/:id/recalculate-revenue",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.id);
        await storage.updateProjectRevenue(projectId);

        const revenueData = await storage.getProjectRevenue(projectId);
        res.json({
          message: "Project revenue recalculated successfully",
          revenue: revenueData,
        });
      } catch (error) {
        console.error("Recalculate project revenue error:", error);
        res
          .status(500)
          .json({ message: "Failed to recalculate project revenue" });
      }
    },
  );

  // Project Employee Assignment routes
  app.get("/api/projects/:id/employees", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }
      const employees = await storage.getProjectEmployees(projectId);
      res.json(employees);
    } catch (error) {
      console.error("Error getting project employees:", error);
      res.status(500).json({ message: "Failed to get project employees" });
    }
  });

  app.post(
    "/api/projects/:id/employees",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.id);
        const { assignments } = req.body;

        console.log("Received team assignment request:", {
          projectId,
          assignments,
        });

        if (!Array.isArray(assignments)) {
          return res
            .status(400)
            .json({ message: "Assignments must be an array" });
        }

        if (assignments.length === 0) {
          return res
            .status(400)
            .json({ message: "At least one assignment is required" });
        }

        // Validate assignment structure
        for (const assignment of assignments) {
          if (
            !assignment.employeeId ||
            typeof assignment.employeeId !== "number"
          ) {
            return res
              .status(400)
              .json({
                message: "Each assignment must have a valid employeeId",
              });
          }

          // Validate date formats if provided
          if (assignment.startDate && assignment.startDate.trim()) {
            const startDate = new Date(assignment.startDate);
            if (isNaN(startDate.getTime())) {
              return res
                .status(400)
                .json({ message: "Invalid start date format" });
            }
          }

          if (assignment.endDate && assignment.endDate.trim()) {
            const endDate = new Date(assignment.endDate);
            if (isNaN(endDate.getTime())) {
              return res
                .status(400)
                .json({ message: "Invalid end date format" });
            }
          }
        }

        const result = await storage.assignEmployeesToProject(
          projectId,
          assignments,
        );
        console.log("Team assignment result:", result);
        res.status(201).json(result);
      } catch (error) {
        console.error("Team assignment error:", error);
        res.status(500).json({
          message: "Failed to assign employees to project",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  app.delete(
    "/api/projects/:id/employees/:employeeId",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.id);
        const employeeId = parseInt(req.params.employeeId);

        console.log(
          `API: Removing employee ${employeeId} from project ${projectId}`,
        );

        // Validate parameters
        if (isNaN(projectId) || isNaN(employeeId)) {
          console.log(
            `Invalid parameters: projectId=${req.params.id}, employeeId=${req.params.employeeId}`,
          );
          return res
            .status(400)
            .json({ message: "Invalid project ID or employee ID" });
        }

        // Check if project exists
        const project = await storage.getProject(projectId);
        if (!project) {
          console.log(`Project ${projectId} not found`);
          return res.status(404).json({ message: "Project not found" });
        }

        // Check if employee exists
        const employees = await storage.getEmployees();
        const employee = employees.find((emp) => emp.id === employeeId);
        if (!employee) {
          console.log(`Employee ${employeeId} not found`);
          return res.status(404).json({ message: "Employee not found" });
        }

        const removed = await storage.removeEmployeeFromProject(
          projectId,
          employeeId,
        );
        if (!removed) {
          console.log(
            `Assignment not found for employee ${employeeId} in project ${projectId}`,
          );
          return res.status(404).json({ message: "Assignment not found" });
        }

        console.log(
          `Successfully removed employee ${employeeId} from project ${projectId}`,
        );
        res.json({ message: "Employee removed from project successfully" });
      } catch (error) {
        console.error("Error removing employee from project:", error);
        res
          .status(500)
          .json({ message: "Failed to remove employee from project" });
      }
    },
  );

  // Inventory routes
  app.get("/api/inventory", requireAuth, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";
      const category = (req.query.category as string) || "";
      const lowStock = req.query.lowStock === "true";

      const result = await storage.getInventoryItemsPaginated(
        page,
        limit,
        search,
        category,
        lowStock,
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get inventory items" });
    }
  });

  app.post(
    "/api/inventory",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const { initialQuantity, unitPrice, ...itemData } =
          insertInventoryItemSchema.parse(req.body);
        const item = await storage.createInventoryItem({
          ...itemData,
          currentStock: initialQuantity || 0,
          avgCost: unitPrice?.toString() || "0",
        });
        res.status(201).json(item);
      } catch (error) {
        if (error instanceof ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create inventory item" });
      }
    },
  );

  app.put(
    "/api/inventory/:id",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const itemData = req.body;
        const item = await storage.updateInventoryItem(id, itemData);

        if (!item) {
          return res.status(404).json({ message: "Inventory item not found" });
        }

        res.json(item);
      } catch (error) {
        res.status(500).json({ message: "Failed to update inventory item" });
      }
    },
  );

  // Asset Types routes for Enhanced Asset Inventory
  app.get('/api/asset-types', requireAuth, async (req, res) => {
    try {
      const assetTypes = await storage.getAssetTypes();
      res.json(assetTypes);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to fetch asset types" });
    }
  });

  app.post('/api/asset-types', requireAuth, async (req, res) => {
    try {
      const assetType = await storage.createAssetType(req.body);
      res.status(201).json(assetType);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to create asset type" });
    }
  });

  app.put('/api/asset-types/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const assetType = await storage.updateAssetType(id, req.body);
      res.json(assetType);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to update asset type" });
    }
  });

  // Enhanced Asset Inventory Instance routes
  app.get('/api/asset-inventory/instances', requireAuth, async (req, res) => {
    try {
      const instances = await storage.getAllAssetInventoryInstances();
      res.json(instances);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to fetch asset inventory instances" });
    }
  });

  app.get('/api/asset-inventory/instances/by-type/:assetTypeId', requireAuth, async (req, res) => {
    try {
      const instances = await storage.getAssetInventoryInstancesByType(parseInt(req.params.assetTypeId));
      res.json(instances);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to fetch instances for asset type" });
    }
  });

  app.get('/api/asset-inventory/instances/available/:assetTypeId', requireAuth, async (req, res) => {
    try {
      const instances = await storage.getAvailableInstancesForAssignment(parseInt(req.params.assetTypeId));
      res.json(instances);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to fetch available instances" });
    }
  });

  app.get('/api/asset-inventory/instances/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const instance = await storage.getAssetInventoryInstance(id);
      if (!instance) {
        return res.status(404).json({ message: "Asset instance not found" });
      }
      res.json(instance);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to fetch asset instance" });
    }
  });

  app.post('/api/asset-inventory/instances', requireAuth, async (req, res) => {
    try {
      const instance = await storage.createAssetInventoryInstance(req.body);
      res.status(201).json(instance);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to create asset inventory instance" });
    }
  });

  app.put('/api/asset-inventory/instances/:id', requireAuth, async (req, res) => {
    try {
      const instance = await storage.updateAssetInventoryInstance(parseInt(req.params.id), req.body);
      res.json(instance);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to update asset inventory instance" });
    }
  });

  // Get all maintenance records for reporting
  app.get("/api/maintenance-records", requireAuth, async (req, res) => {
    try {
      const maintenanceRecords = await storage.getAllAssetMaintenanceRecords();
      res.json(maintenanceRecords);
    } catch (error) {
      console.error("Error fetching all maintenance records:", error);
      res.status(500).json({ message: "Failed to fetch maintenance records" });
    }
  });
  // Daily Activities routes
  app.get("/api/projects/activities", requireAuth, async (req, res) => {
    try {
      // This is for the general activities page - return all activities
      // You might want to implement this differently based on your needs
      res.json([]);
    } catch (error) {
      console.error("Error getting all daily activities:", error);
      res.status(500).json({ message: "Failed to get daily activities" });
    }
  });

  app.get(
    "/api/projects/:projectId/activities",
    requireAuth,
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.projectId);
        if (isNaN(projectId)) {
          return res.status(400).json({ message: "Invalid project ID" });
        }
        
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;
        
        const result = await storage.getDailyActivitiesPaginated(projectId, limit, offset);
        res.json(result);
      } catch (error) {
        console.error("Error getting daily activities:", error);
        res.status(500).json({ message: "Failed to get daily activities" });
      }
    },
  );

  // Planned Activities routes
  app.get(
    "/api/projects/:projectId/planned-activities",
    requireAuth,
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.projectId);
        if (isNaN(projectId)) {
          return res.status(400).json({ message: "Invalid project ID" });
        }
        
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;
        
        const result = await storage.getPlannedActivitiesPaginated(projectId, limit, offset);
        res.json(result);
      } catch (error) {
        console.error("Error getting planned activities:", error);
        res.status(500).json({ message: "Failed to get planned activities" });
      }
    },
  );

  app.post(
    "/api/projects/:projectId/planned-activities",
    requireAuth,
    requireRole(["admin", "project_manager", "employee"]),
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.projectId);
        if (isNaN(projectId)) {
          return res.status(400).json({ message: "Invalid project ID" });
        }

        const activities = req.body;
        if (!Array.isArray(activities) || activities.length === 0) {
          return res.status(400).json({ message: "Activities array is required" });
        }

        // Validate each activity
        for (const activity of activities) {
          if (!activity.tasks || !activity.date) {
            return res.status(400).json({ message: "Each activity must have tasks and date" });
          }
        }

        const result = await storage.savePlannedActivities(projectId, activities);
        res.status(201).json(result);
      } catch (error) {
        console.error("Error saving planned activities:", error);
        res.status(500).json({ message: "Failed to save planned activities" });
      }
    },
  );

  // Project Consumables routes
  app.get(
    "/api/projects/:projectId/consumables",
    requireAuth,
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.projectId);
        if (isNaN(projectId)) {
          return res.status(400).json({ message: "Invalid project ID" });
        }
        const consumables = await storage.getProjectConsumables(projectId);
        res.json(consumables);
      } catch (error) {
        console.error("Error getting project consumables:", error);
        res.status(500).json({ message: "Failed to get project consumables" });
      }
    },
  );

  app.post(
    "/api/projects/:projectId/consumables",
    requireAuth,
    requireRole(["admin", "project_manager", "employee"]),
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.projectId);
        if (isNaN(projectId)) {
          return res.status(400).json({ message: "Invalid project ID" });
        }

        const { date, items } = req.body;
        
        if (!date || !items || !Array.isArray(items) || items.length === 0) {
          return res.status(400).json({ message: "Date and items array are required" });
        }

        // Validate each item
        for (const item of items) {
          if (!item.inventoryItemId || !item.quantity || item.quantity <= 0) {
            return res.status(400).json({ 
              message: "Each item must have a valid inventoryItemId and positive quantity" 
            });
          }
        }

        const result = await storage.createProjectConsumables(
          projectId,
          date,
          items,
          req.session.userId
        );
        
        res.status(201).json(result);
      } catch (error) {
        console.error("Error creating project consumables:", error);
        res.status(500).json({ 
          message: "Failed to record consumables usage",
          error: error.message 
        });
      }
    },
  );

  app.get(
    "/api/projects/activities/activities",
    requireAuth,
    async (req, res) => {
      try {
        // Return empty array for now - implement based on your requirements
        res.json([]);
      } catch (error) {
        console.error("Error getting activities:", error);
        res.status(500).json({ message: "Failed to get activities" });
      }
    },
  );

  app.get(
    "/api/projects/activities/photo-groups",
    requireAuth,
    async (req, res) => {
      try {
        // Return empty array for now - implement based on your requirements
        res.json([]);
      } catch (error) {
        console.error("Error getting photo groups:", error);
        res.status(500).json({ message: "Failed to get photo groups" });
      }
    },
  );

  app.get(
    "/api/projects/activities/employees",
    requireAuth,
    async (req, res) => {
      try {
        // Return empty array for now - implement based on your requirements
        res.json([]);
      } catch (error) {
        console.error("Error getting employees:", error);
        res.status(500).json({ message: "Failed to get employees" });
      }
    },
  );

  app.get(
    "/api/projects/activities/consumables",
    requireAuth,
    async (req, res) => {
      try {
        // Return empty array for now - implement based on your requirements
        res.json([]);
      } catch (error) {
        console.error("Error getting consumables:", error);
        res.status(500).json({ message: "Failed to get consumables" });
      }
    },
  );

  app.post(
    "/api/projects/:projectId/activities",
    requireAuth,
    requireRole(["admin", "project_manager", "employee"]),
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.projectId);

        // Ensure date is properly formatted
        const activityData = {
          ...req.body,
          projectId,
          date: new Date(req.body.date),
          photos: req.body.photos || [],
        };

        console.log("Activity data to validate:", activityData);

        const validatedData = insertDailyActivitySchema.parse(activityData);
        const activity = await storage.createDailyActivity(validatedData);
        res.status(201).json(activity);
      } catch (error) {
        console.error("Activity creation error:", error);
        if (error instanceof ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create daily activity" });
      }
    },
  );

  // Asset assignment routes
  app.post(
    "/api/projects/:id/asset-assignments",
    requireAuth,
    async (req: any, res: any) => {
      try {
        const projectId = parseInt(req.params.id);
        const { assetId, startDate, endDate, monthlyRate } = req.body;

        if (!assetId || !startDate || !endDate || !monthlyRate) {
          return res
            .status(400)
            .json({
              message:
                "Asset ID, start date, end date, and monthly rate are required",
            });
        }

        // Validate that the provided monthly rate matches the asset's rate
        const asset = await storage.getAssetInventoryInstance(assetId);
        if (!asset) {
          return res.status(404).json({ message: "Asset instance not found" });
        }

        const assetMonthlyRate = asset.monthlyRentalAmount
          ? parseFloat(asset.monthlyRentalAmount)
          : 0;
        if (Math.abs(monthlyRate - assetMonthlyRate) > 0.01) {
          // Allow small floating point differences
          return res.status(400).json({
            message: `Monthly rate mismatch. Asset rate is ${assetMonthlyRate}, provided rate is ${monthlyRate}`,
          });
        }

        // Calculate total cost based on monthly rate and duration (pro-rated)
        const start = new Date(startDate);
        const end = new Date(endDate);
        const totalCost = await storage.calculateAssetRentalCost(
          start,
          end,
          parseFloat(monthlyRate),
        );

        const assignmentData = {
          projectId,
          assetId: parseInt(assetId),
          startDate: start,
          endDate: end,
          monthlyRate: monthlyRate.toString(),
          totalCost: totalCost.toString(),
          assignedBy: req.session.userId,
        };

        const assignment =
          await storage.createProjectAssetAssignment(assignmentData);
        res.status(201).json(assignment);
      } catch (error) {
        console.error("Error assigning asset to project:", error);
        res.status(500).json({ message: "Failed to assign asset to project" });
      }
    },
  );

  app.put(
    "/api/projects/:projectId/asset-assignments/:assignmentId",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const assignmentId = parseInt(req.params.assignmentId);
        const { startDate, endDate, monthlyRate } = req.body;

        if (!startDate || !endDate || !monthlyRate) {
          return res
            .status(400)
            .json({
              message: "Start date, end date, and monthly rate are required",
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (end <= start) {
          return res
            .status(400)
            .json({ message: "End date must be after start date" });
        }

        const totalCost = await storage.calculateAssetRentalCost(
          start,
          end,
          parseFloat(monthlyRate),
        );

        const assignmentData = {
          startDate: start,
          endDate: end,
          monthlyRate: monthlyRate.toString(),
          totalCost: totalCost.toString(),
        };

        const assignment = await storage.updateProjectAssetAssignment(
          assignmentId,
          assignmentData,
        );

        if (!assignment) {
          return res
            .status(404)
            .json({ message: "Asset assignment not found" });
        }

        res.json(assignment);
      } catch (error) {
        console.error("Error updating project asset assignment:", error);
        res.status(500).json({ message: "Failed to update asset assignment" });
      }
    },
  );

  app.delete(
    "/api/projects/:projectId/asset-assignments/:assignmentId",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const assignmentId = parseInt(req.params.assignmentId);
        const deleted =
          await storage.deleteProjectAssetAssignment(assignmentId);

        if (!deleted) {
          return res
            .status(404)
            .json({ message: "Asset assignment not found" });
        }

        res.json({ message: "Asset assignment deleted successfully" });
      } catch (error) {
        console.error("Error deleting project asset assignment:", error);
        res.status(500).json({ message: "Failed to delete asset assignment" });
      }
    },
  );

  // Get all asset assignments for earnings calculation
  app.get("/api/asset-assignments", requireAuth, async (req, res) => {
    try {
      const assignments = await storage.getAllAssetAssignments();
      res.json(assignments);
    } catch (error) {
      console.error("Error getting all asset assignments:", error);
      res.json([]); // Return empty array instead of error to prevent reports from failing
    }
  });

  // Payroll routes
  app.get(
    "/api/payroll",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const month = req.query.month ? parseInt(req.query.month as string) : undefined;
        const year = req.query.year ? parseInt(req.query.year as string) : undefined;
        
        const entries = await storage.getPayrollEntries(month, year);
        res.json(entries);
      } catch (error) {
        console.error("Get payroll entries error:", error);
        res.json([]); // Return empty array instead of error to prevent reports from failing
      }
    }
  );

  app.post(
    "/api/payroll/generate",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const { month, year } = req.body;
        
        if (!month || !year) {
          return res.status(400).json({ message: "Month and year are required" });
        }
        
        if (!req.session?.userId) {
          return res.status(401).json({ message: "User session required" });
        }
        
        console.log(`[Payroll Route] Generating payroll for month: ${month}, year: ${year}, userId: ${req.session.userId}`);
        
        const entries = await storage.generateMonthlyPayroll(month, year, req.session.userId);
        res.status(201).json(entries);
      } catch (error) {
        console.error("Generate payroll error:", error);
        res.status(500).json({ message: error.message || "Failed to generate payroll" });
      }
    }
  );

  app.delete(
    "/api/payroll/clear-period",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const month = parseInt(req.query.month as string);
        const year = parseInt(req.query.year as string);
        
        if (!month || !year || isNaN(month) || isNaN(year)) {
          return res.status(400).json({ message: "Valid month and year are required" });
        }
        
        if (month < 1 || month > 12) {
          return res.status(400).json({ message: "Month must be between 1 and 12" });
        }
        
        const result = await storage.clearPayrollPeriod(month, year);
        res.json(result);
      } catch (error) {
        console.error("Clear payroll period error:", error);
        res.status(500).json({ message: error.message || "Failed to clear payroll period" });
      }
    }
  );

  app.put(
    "/api/payroll/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const payrollId = parseInt(req.params.id);
        const updateData = req.body;
        
        // Get the current payroll entry before updating
        const currentEntry = await storage.getPayrollEntry(payrollId);
        if (!currentEntry) {
          return res.status(404).json({ message: "Payroll entry not found" });
        }

        // Update the payroll entry
        const entry = await storage.updatePayrollEntry(payrollId, updateData);
        if (!entry) {
          return res.status(404).json({ message: "Payroll entry not found" });
        }

        // GL entries are now handled in the storage layer's updatePayrollEntry method
        
        res.json(entry);
      } catch (error) {
        console.error("Update payroll entry error:", error);
        res.status(500).json({ message: "Failed to update payroll entry" });
      }
    }
  );

  app.get(
    "/api/payroll/:id/additions",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const payrollId = parseInt(req.params.id);
        const additions = await storage.getPayrollAdditions(payrollId);
        res.json(additions);
      } catch (error) {
        console.error("Get payroll additions error:", error);
        res.status(500).json({ message: "Failed to get payroll additions" });
      }
    }
  );

  app.post(
    "/api/payroll/:id/additions",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const payrollId = parseInt(req.params.id);
        const additionData = { ...req.body, payrollEntryId: payrollId };
        
        const addition = await storage.createPayrollAddition(additionData);
        res.status(201).json(addition);
      } catch (error) {
        console.error("Create payroll addition error:", error);
        res.status(500).json({ message: "Failed to create payroll addition" });
      }
    }
  );

  app.get(
    "/api/payroll/:id/deductions",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const payrollId = parseInt(req.params.id);
        const deductions = await storage.getPayrollDeductions(payrollId);
        res.json(deductions);
      } catch (error) {
        console.error("Get payroll deductions error:", error);
        res.status(500).json({ message: "Failed to get payroll deductions" });
      }
    }
  );

  app.post(
    "/api/payroll/:id/deductions",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const payrollId = parseInt(req.params.id);
        const deductionData = { ...req.body, payrollEntryId: payrollId };
        
        const deduction = await storage.createPayrollDeduction(deductionData);
        res.status(201).json(deduction);
      } catch (error) {
        console.error("Create payroll deduction error:", error);
        res.status(500).json({ message: "Failed to create payroll deduction" });
      }
    }
  );

  // Sales Quotations routes
  app.get(
    "/api/sales-quotations",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const filters = {
          search: req.query.search as string,
          status: req.query.status as string,
          customerId: req.query.customerId ? parseInt(req.query.customerId as string) : undefined,
          archived: req.query.archived === "true" ? true : req.query.archived === "false" ? false : undefined,
          startDate: req.query.startDate as string,
          endDate: req.query.endDate as string,
        };

        const result = await storage.getSalesQuotationsPaginated(page, limit, filters);
        res.json(result);
      } catch (error) {
        console.error("Get sales quotations error:", error);
        res.status(500).json({ message: "Failed to get sales quotations" });
      }
    },
  );

  app.post(
    "/api/sales-quotations",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const quotationData = req.body;
        
        // Auto-generate quotation number if not provided
        if (!quotationData.quotationNumber) {
          const latestQuotations = await storage.getSalesQuotations();
          const latestNumber = latestQuotations.reduce((max, q) => {
            const match = q.quotationNumber?.match(/QTN-(\d+)/);
            if (match) {
              const num = parseInt(match[1]);
              return num > max ? num : max;
            }
            return max;
          }, 0);
          quotationData.quotationNumber = `QTN-${String(latestNumber + 1).padStart(4, '0')}`;
        }
        
        // Date fields should remain as ISO strings (YYYY-MM-DD format)
        // No conversion needed - Drizzle expects strings for date() columns
        
        const quotation = await storage.createSalesQuotation(quotationData);
        res.status(201).json(quotation);
      } catch (error) {
        console.error("Sales quotation creation error:", error);
        res.status(500).json({ message: "Failed to create sales quotation" });
      }
    },
  );

  app.put(
    "/api/sales-quotations/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const quotationId = parseInt(req.params.id);
        const quotationData = req.body;
        
        // Date fields should remain as ISO strings (YYYY-MM-DD format)
        // No conversion needed - Drizzle expects strings for timestamp({ mode: 'string' }) columns
        
        const quotation = await storage.updateSalesQuotation(
          quotationId,
          quotationData,
        );

        if (!quotation) {
          return res.status(404).json({ message: "Quotation not found" });
        }

        res.json(quotation);
      } catch (error) {
        console.error("Sales quotation update error:", error);
        res.status(500).json({ message: "Failed to update sales quotation" });
      }
    },
  );

  app.post(
    "/api/sales-quotations/:id/approve",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const quotationId = parseInt(req.params.id);
        const quotation = await storage.updateSalesQuotation(quotationId, {
          status: "approved",
        });

        if (!quotation) {
          return res.status(404).json({ message: "Quotation not found" });
        }

        res.json(quotation);
      } catch (error) {
        console.error("Sales quotation approval error:", error);
        res.status(500).json({ message: "Failed to approve sales quotation" });
      }
    },
  );

  app.post(
    "/api/sales-invoices/:id/approve",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const invoiceId = parseInt(req.params.id);
        const invoice = await storage.getSalesInvoice(invoiceId);
        
        if (!invoice) {
          return res.status(404).json({ message: "Invoice not found" });
        }
        
        if (invoice.status !== "draft") {
          return res.status(400).json({ message: "Only draft invoices can be approved" });
        }

        // Generate invoice number if not already assigned
        let invoiceNumber = invoice.invoiceNumber;
        if (!invoiceNumber) {
          invoiceNumber = `INV-${Date.now()}`;
        }

        // Update invoice to assign invoice number and set initial status to unpaid
        await storage.updateSalesInvoice(invoiceId, {
          status: "unpaid",
          invoiceNumber: invoiceNumber,
        });

        // Create general ledger entries for the approved invoice
        await storage.createInvoiceGLEntries(invoiceId);

        // Update invoice status based on payment amounts and due date
        await storage.updateInvoicePaidAmount(invoiceId);

        // Fetch and return the updated invoice with correct status
        const updatedInvoice = await storage.getSalesInvoice(invoiceId);
        res.json(updatedInvoice);
      } catch (error) {
        console.error("Sales invoice approval error:", error);
        res.status(500).json({ message: "Failed to approve sales invoice" });
      }
    },
  );

  app.get(
    "/api/sales-quotations/:id/pdf",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const quotationId = parseInt(req.params.id);
        const quotation = await storage.getSalesQuotation(quotationId);
        const customer = await storage.getCustomer(quotation?.customerId);
        const company = await storage.getCompany();

        if (!quotation || !customer || !company) {
          return res
            .status(404)
            .json({ message: "Quotation or related data not found" });
        }

        const html = generateQuotationHTML(quotation, customer, company);

        res.setHeader("Content-Type", "text/html");
        res.send(html);
      } catch (error) {
        console.error("PDF generation error:", error);
        res.status(500).json({ message: "Failed to generate PDF" });
      }
    },
  );

  app.put(
    "/api/sales-quotations/:id/archive",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const quotationId = parseInt(req.params.id);
        const quotation = await storage.updateSalesQuotation(quotationId, {
          isArchived: true,
        });

        if (!quotation) {
          return res.status(404).json({ message: "Quotation not found" });
        }

        res.json({ message: "Quotation archived successfully", quotation });
      } catch (error) {
        console.error("Sales quotation archive error:", error);
        res.status(500).json({ message: "Failed to archive sales quotation" });
      }
    },
  );

  app.put(
    "/api/sales-quotations/:id/unarchive",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const quotationId = parseInt(req.params.id);
        const quotation = await storage.updateSalesQuotation(quotationId, {
          isArchived: false,
        });

        if (!quotation) {
          return res.status(404).json({ message: "Quotation not found" });
        }

        res.json({ message: "Quotation unarchived successfully", quotation });
      } catch (error) {
        console.error("Sales quotation unarchive error:", error);
        res
          .status(500)
          .json({ message: "Failed to unarchive sales quotation" });
      }
    },
  );

  // General Ledger routes
  app.get(
    "/api/general-ledger",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const filters = {
          entryType: req.query.entryType as string,
          referenceType: req.query.referenceType as string,
          entityId: req.query.entityId ? parseInt(req.query.entityId as string) : undefined,
          startDate: req.query.startDate as string,
          endDate: req.query.endDate as string,
          status: req.query.status as string,
          projectId: req.query.projectId ? parseInt(req.query.projectId as string) : undefined,
          accountName: req.query.accountName as string,
          search: req.query.search as string,
          page: req.query.page ? parseInt(req.query.page as string) : 1,
          limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        };

        const result = await storage.getGeneralLedgerEntries(filters);
        res.json(result);
      } catch (error) {
        console.error("Get general ledger entries error:", error);
        res.status(500).json({ message: "Failed to get general ledger entries" });
      }
    },
  );

  app.post(
    "/api/general-ledger",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const entryData = {
          ...req.body,
          createdBy: req.session.userId,
        };
        const entry = await storage.createGeneralLedgerEntry(entryData);
        res.status(201).json(entry);
      } catch (error) {
        console.error("Create general ledger entry error:", error);
        res.status(500).json({ message: "Failed to create general ledger entry" });
      }
    },
  );

  app.post(
    "/api/general-ledger/journal",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const journalData = {
          ...req.body,
          createdBy: req.session.userId,
        };
        const entries = await storage.createJournalEntry(journalData);
        res.status(201).json(entries);
      } catch (error) {
        console.error("Create journal entry error:", error);
        res.status(500).json({ 
          message: error.message || "Failed to create journal entry",
          error: error.message 
        });
      }
    },
  );

  app.put(
    "/api/general-ledger/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const entryId = parseInt(req.params.id);
        const updateData = {
          ...req.body,
          createdBy: req.session.userId,
        };
        
        console.log("Updating general ledger entry:", entryId, updateData);
        
        const entry = await storage.updateGeneralLedgerEntry(entryId, updateData);
        
        if (!entry) {
          return res.status(404).json({ message: "General ledger entry not found" });
        }

        res.json(entry);
      } catch (error) {
        console.error("Update general ledger entry error:", error);
        res.status(500).json({ message: error.message || "Failed to update general ledger entry" });
      }
    },
  );

  app.get(
    "/api/general-ledger/payables",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const payables = await storage.getPayables();
        res.json(payables);
      } catch (error) {
        console.error("Get payables error:", error);
        res.status(500).json({ message: "Failed to get payables" });
      }
    },
  );

  app.get(
    "/api/general-ledger/receivables",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const receivables = await storage.getReceivables();
        res.json(receivables);
      } catch (error) {
        console.error("Get receivables error:", error);
        res.status(500).json({ message: "Failed to get receivables" });
      }
    },
  );

  // Add missing sales invoice and receivables methods
  app.get(
    "/api/receivables",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const receivables = await storage.getReceivables();
        res.json(receivables);
      } catch (error) {
        console.error("Get receivables error:", error);
        res.status(500).json({ message: "Failed to get receivables" });
      }
    },
  );

  app.get(
    "/api/sales-invoices/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const invoiceId = parseInt(req.params.id);
        const invoice = await storage.getSalesInvoice(invoiceId);

        if (!invoice) {
          return res.status(404).json({ message: "Invoice not found" });
        }

        res.json(invoice);
      } catch (error) {
        console.error("Get sales invoice error:", error);
        res.status(500).json({ message: "Failed to get sales invoice" });
      }
    },
  );

  app.put(
    "/api/sales-invoices/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const invoiceId = parseInt(req.params.id);
        const invoiceData = req.body;
        const invoice = await storage.updateSalesInvoice(
          invoiceId,
          invoiceData,
        );

        if (!invoice) {
          return res.status(404).json({ message: "Invoice not found" });
        }

        res.json(invoice);
      } catch (error) {
        console.error("Sales invoice update error:", error);
        res.status(500).json({ message: "Failed to update sales invoice" });
      }
    },
  );

  // Sales Invoices routes
  app.get(
    "/api/sales-invoices",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const status = req.query.status as string;
        const startDate = req.query.startDate as string;
        const endDate = req.query.endDate as string;
        const customerId = req.query.customerId ? parseInt(req.query.customerId as string) : undefined;
        const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;

        const result = await storage.getSalesInvoicesPaginated(page, limit, {
          status,
          startDate,
          endDate,
          customerId,
          projectId
        });
        res.json(result);
      } catch (error) {
        console.error("Get sales invoices error:", error);
        res.status(500).json({ message: "Failed to get sales invoices" });
      }
    },
  );

  app.post(
    "/api/sales-invoices",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const invoiceData = req.body;
        
        // Date fields should remain as ISO strings (YYYY-MM-DD format)
        // No conversion needed - Drizzle expects strings for date() columns
        
        const invoice = await storage.createSalesInvoice(invoiceData);
        res.status(201).json(invoice);
      } catch (error) {
        console.error("Sales invoice creation error:", error);
        res.status(500).json({ message: "Failed to create sales invoice" });
      }
    },
  );

  // Invoice Payments routes
  app.get(
    "/api/sales-invoices/:id/payments",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const invoiceId = parseInt(req.params.id);
        const payments = await storage.getInvoicePayments(invoiceId);
        res.json(payments);
      } catch (error) {
        console.error("Get invoice payments error:", error);
        res.status(500).json({ message: "Failed to get invoice payments" });
      }
    },
  );

  app.post(
    "/api/sales-invoices/:id/payments",
    requireAuth,
    requireRole(["admin", "finance"]),
    upload.array("paymentFiles", 10),
    async (req, res) => {
      try {
        const invoiceId = parseInt(req.params.id);
        const paymentData = {
          ...req.body,
          invoiceId,
          recordedBy: req.session.userId,
        };

        const payment = await storage.createInvoicePayment(paymentData);

        // Handle file uploads if any
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
          for (const file of req.files) {
            await storage.createPaymentFile({
              paymentId: payment.id,
              fileName: file.filename,
              originalName: file.originalname,
              filePath: file.path,
              fileSize: file.size,
              mimeType: file.mimetype,
            });
          }
        }

        res.status(201).json(payment);
      } catch (error) {
        console.error("Record payment error:", error);
        res.status(500).json({ message: "Failed to record payment" });
      }
    },
  );

  // Payment file routes
  app.get(
    "/api/payments/:id/files",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const paymentId = parseInt(req.params.id);
        const files = await storage.getPaymentFiles(paymentId);
        res.json(files);
      } catch (error) {
        console.error("Get payment files error:", error);
        res.status(500).json({ message: "Failed to get payment files" });
      }
    },
  );

  app.get(
    "/api/payment-files/:id/download",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const fileId = parseInt(req.params.id);
        const files = await storage.getPaymentFiles(fileId);

        if (files.length === 0) {
          return res.status(404).json({ message: "File not found" });
        }

        const file = files[0];
        const filePath = path.resolve(file.filePath);

        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ message: "File not found on disk" });
        }

        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${file.originalName}"`,
        );
        res.setHeader(
          "Content-Type",
          file.mimeType || "application/octet-stream",
        );

        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
      } catch (error) {
        console.error("Download payment file error:", error);
        res.status(500).json({ message: "Failed to download file" });
      }
    },
  );

  app.delete(
    "/api/payment-files/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const fileId = parseInt(req.params.id);
        const files = await storage.getPaymentFiles(fileId);

        if (files.length > 0) {
          const file = files[0];
          // Delete file from disk
          if (fs.existsSync(file.filePath)) {
            fs.unlinkSync(file.filePath);
          }
        }

        const deleted = await storage.deletePaymentFile(fileId);

        if (!deleted) {
          return res.status(404).json({ message: "File not found" });
        }

        res.json({ message: "File deleted successfully" });
      } catch (error) {
        console.error("Delete payment file error:", error);
        res.status(500).json({ message: "Failed to delete file" });
      }
    },
  );

  // Receivables routes
  app.get(
    "/api/receivables",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const receivables = await storage.getReceivables();
        res.json(receivables);
      } catch (error) {
        console.error("Get receivables error:", error);
        res.status(500).json({ message: "Failed to get receivables" });
      }
    },
  );

  // Goods Receipt routes
  app.get(
    "/api/goods-receipt",
    requireAuth,
    requireRole(["admin", "project_manager", "finance"]),
    async (req, res) => {
      try {
        const receipts = await storage.getGoodsReceipts();
        res.json(receipts);
      } catch (error) {
        console.error("Get goods receipts error:", error);
        res.status(500).json({ message: "Failed to get goods receipts" });
      }
    },
  );

  app.post(
    "/api/goods-receipt",
    requireAuth,
    requireRole(["admin", "project_manager", "finance"]),
    async (req, res) => {
      try {
        const { reference, items } = req.body;

        console.log("Goods receipt request:", { reference, items, userId: req.session.userId });

        if (
          !reference ||
          !items ||
          !Array.isArray(items) ||
          items.length === 0
        ) {
          return res
            .status(400)
            .json({ message: "Reference and items are required" });
        }

        // Validate items format
        for (const item of items) {
          if (
            !item.inventoryItemId ||
            typeof item.inventoryItemId !== "number" ||
            !item.quantity ||
            typeof item.quantity !== "number" ||
            item.quantity <= 0 ||
            typeof item.unitCost !== "number" ||
            item.unitCost < 0
          ) {
            return res
              .status(400)
              .json({
                message:
                  "Invalid item format: each item must have inventoryItemId, positive quantity, and valid unitCost",
              });
          }
        }

        const receipt = await storage.createGoodsReceipt(
          reference,
          items,
          req.session.userId,
        );
        res.status(201).json(receipt);
      } catch (error) {
        console.error("Goods receipt creation error:", error);
        console.error("Error details:", error.message);
        res.status(500).json({ 
          message: "Failed to create goods receipt",
          error: error.message 
        });
      }
    },
  );

  // Goods Issue routes
  app.get(
    "/api/goods-issue",
    requireAuth,
    requireRole(["admin", "project_manager", "finance"]),
    async (req, res) => {
      try {
        console.log("Getting goods issues...");
        const issues = await storage.getGoodsIssues();
        console.log("Retrieved goods issues:", issues);
        res.json(issues);
      } catch (error) {
        console.error("Get goods issues error:", error);
        res.status(500).json({ message: "Failed to get goods issues" });
      }
    },
  );

  app.post(
    "/api/goods-issue",
    requireAuth,
    requireRole(["admin", "project_manager", "finance"]),
    async (req, res) => {
      try {
        const { reference, projectId, items } = req.body;

        // Validate required fields
        if (!reference || !items || !Array.isArray(items) || items.length === 0) {
          return res.status(400).json({
            message: "Reference and items array are required",
          });
        }

        // Validate items format
        for (const item of items) {
          if (
            !item.inventoryItemId ||
            typeof item.inventoryItemId !== "number" ||
            !item.quantity ||
            typeof item.quantity !== "number" ||
            item.quantity <= 0
          ) {
            return res.status(400).json({
              message: "Invalid item format: each item must have inventoryItemId and positive quantity",
            });
          }
        }

        const issue = await storage.createGoodsIssue(
          reference,
          projectId,
          items,
          req.session.userId,
        );
        res.status(201).json(issue);
      } catch (error) {
        console.error("Goods issue creation error:", error);
        res.status(500).json({ 
          message: "Failed to create goods issue",
          error: error.message 
        });
      }
    },
  );

  

  // Payroll routes
  app.get(
    "/api/payroll",
    requireAuth,
    requireRole(["admin", "project_manager", "finance"]),
    async (req, res) => {
      try {
        const { month, year, employeeId, projectId } = req.query;
        const payroll = await storage.getPayrollEntries(
          month ? parseInt(month as string) : undefined,
          year ? parseInt(year as string) : undefined,
          employeeId ? parseInt(employeeId as string) : undefined,
          projectId ? parseInt(projectId as string) : undefined,
        );
        res.json(payroll);
      } catch (error) {
        res.status(500).json({ message: "Failed to get payroll entries" });
      }
    },
  );

  app.post(
    "/api/payroll/generate",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const { month, year } = req.body;

        if (!month || !year) {
          return res
            .status(400)
            .json({ message: "Month and year are required" });
        }

        const payroll = await storage.generateMonthlyPayroll(month, year);
        res.status(201).json(payroll);
      } catch (error) {
        console.error("Payroll generation error:", error);
        res.status(500).json({ message: "Failed to generate payroll" });
      }
    },
  );

  app.put(
    "/api/payroll/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const payrollData = req.body;

        // Get the current payroll entry before update
        const currentEntry = await storage.getPayrollEntry(id);
        if (!currentEntry) {
          return res.status(404).json({ message: "Payroll entry not found" });
        }

        // Update the payroll entry
        // The storage.updatePayrollEntry method now handles GL creation if status changes to 'paid'
        // and will use the userId passed to it.
        const updatedEntry = await storage.updatePayrollEntry(id, payrollData, req.session.userId);
        if (!updatedEntry) {
          return res.status(404).json({ message: "Payroll entry not found" });
        }

        // If status is being updated (even if not to 'paid'), totals might need recalculation
        // This is already handled by updatePayrollEntry calling updatePayrollEntryTotals.
        // No need for an explicit call here if payrollData.status is the only trigger.
        // However, if other fields that affect totals are updated without a status change,
        // updatePayrollEntryTotals should be robust enough or called regardless.
        // The current implementation of updatePayrollEntry always calls updatePayrollEntryTotals.

        // Get the potentially updated entry (especially if totals were recalculated)
        const finalEntry = await storage.getPayrollEntry(id);
        res.json(finalEntry || updatedEntry); // Prefer finalEntry if available
      } catch (error) {
        console.error("Update payroll entry error:", error);
        res.status(500).json({ message: "Failed to update payroll entry" });
      }
    },
  );

  app.delete(
    "/api/payroll/clear-all",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const deletedCount = await storage.clearAllPayrollEntries();
        res.json({
          message: "All payroll entries cleared successfully",
          deletedCount,
        });
      } catch (error) {
        console.error("Clear payroll error:", error);
        res.status(500).json({ message: "Failed to clear payroll entries" });
      }
    },
  );

  app.delete(
    "/api/payroll/clear-period",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const { month, year } = req.query;

        if (!month || !year) {
          return res
            .status(400)
            .json({ message: "Month and year are required" });
        }

        const deletedCount = await storage.clearPayrollEntriesByPeriod(
          parseInt(month as string),
          parseInt(year as string),
        );
        res.json({
          message: `Payroll entries for ${month}/${year} cleared successfully`,
          deletedCount,
        });
      } catch (error) {
        console.error("Clear payroll by period error:", error);
        res.status(500).json({ message: "Failed to clear payroll entries" });
      }
    },
  );

  // Payroll Additions routes
  app.get(
    "/api/payroll/:id/additions",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const payrollEntryId = parseInt(req.params.id);
        const additions = await storage.getPayrollAdditions(payrollEntryId);
        res.json(additions);
      } catch (error) {
        res.status(500).json({ message: "Failed to get payroll additions" });
      }
    },
  );

  app.post(
    "/api/payroll/:id/additions",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const payrollEntryId = parseInt(req.params.id);
        const additionData = {
          ...req.body,
          payrollEntryId,
        };

        const addition = await storage.createPayrollAddition(additionData);

        // Update payroll entry totals
        await storage.updatePayrollEntryTotals(payrollEntryId);

        res.status(201).json(addition);
      } catch (error) {
        console.error("Payroll addition creation error:", error);
        res.status(500).json({ message: "Failed to create payroll addition" });
      }
    },
  );

  app.put(
    "/api/payroll/additions/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const additionData = req.body;

        const updatedAddition = await storage.updatePayrollAddition(
          id,
          additionData,
        );
        if (!updatedAddition) {
          return res
            .status(404)
            .json({ message: "Payroll addition not found" });
        }

        // Get the payroll entry ID associated with this addition
        const addition = await storage.getPayrollAddition(id);
        if (addition) {
          await storage.updatePayrollEntryTotals(addition.payrollEntryId);
        }

        res.json(updatedAddition);
      } catch (error) {
        res.status(500).json({ message: "Failed to update payroll addition" });
      }
    },
  );

  app.delete(
    "/api/payroll/additions/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);

        if (isNaN(id)) {
          return res.status(400).json({ message: "Invalid addition ID" });
        }

        // Get the payroll entry ID associated with this addition BEFORE deleting
        const addition = await storage.getPayrollAddition(id);
        if (!addition) {
          return res
            .status(404)
            .json({ message: "Payroll addition not found" });
        }

        const deleted = await storage.deletePayrollAddition(id);
        if (deleted) {
          res.json({ message: "Payroll addition deleted successfully" });
        } else {
          res
            .status(500)
            .json({ message: "Failed to delete payroll addition" });
        }
      } catch (error) {
        console.error("Delete payroll addition error:", error);
        res.status(500).json({
          message: "Failed to delete payroll addition",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // Payroll Deductions routes
  app.get(
    "/api/payroll/:id/deductions",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const payrollEntryId = parseInt(req.params.id);
        const deductions = await storage.getPayrollDeductions(payrollEntryId);
        res.json(deductions);
      } catch (error) {
        res.status(500).json({ message: "Failed to get payroll deductions" });
      }
    },
  );

  app.post(
    "/api/payroll/:id/deductions",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const payrollEntryId = parseInt(req.params.id);
        const deductionData = {
          ...req.body,
          payrollEntryId,
        };

        const deduction = await storage.createPayrollDeduction(deductionData);

        // Update payroll entry totals
        await storage.updatePayrollEntryTotals(payrollEntryId);

        res.status(201).json(deduction);
      } catch (error) {
        console.error("Payroll deduction creation error:", error);
        res.status(500).json({ message: "Failed to create payroll deduction" });
      }
    },
  );

  app.put(
    "/api/payroll/deductions/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const deductionData = req.body;

        const updatedDeduction = await storage.updatePayrollDeduction(
          id,
          deductionData,
        );
        if (!updatedDeduction) {
          return res
            .status(404)
            .json({ message: "Payroll deduction not found" });
        }

        // Get the payroll entry ID associated with this deduction
        const deduction = await storage.getPayrollDeduction(id);
        if (deduction) {
          await storage.updatePayrollEntryTotals(deduction.payrollEntryId);
        }

        res.json(updatedDeduction);
      } catch (error) {
        res.status(500).json({ message: "Failed to update payroll deduction" });
      }
    },
  );

  app.delete(
    "/api/payroll/deductions/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);

        if (isNaN(id)) {
          return res.status(400).json({ message: "Invalid deduction ID" });
        }

        // Get the payroll entry ID associated with this deduction BEFORE deleting
        const deduction = await storage.getPayrollDeduction(id);
        if (!deduction) {
          return res
            .status(404)
            .json({ message: "Payroll deduction not found" });
        }

        const deleted = await storage.deletePayrollDeduction(id);
        if (deleted) {
          res.json({ message: "Payroll deduction deleted successfully" });
        } else {
          res
            .status(500)
            .json({ message: "Failed to delete payroll deduction" });
        }
      } catch (error) {
        console.error("Delete payroll deduction error:", error);
        res.status(500).json({
          message: "Failed to delete payroll deduction",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // Goods Receipt routes
  app.get("/api/goods-receipt", requireAuth, async (req, res) => {
    try {
      const receipts = await storage.getGoodsReceipts();
      res.json(receipts);
    } catch (error) {
      console.error("Get goods receipts error:", error);
      res.status(500).json({ message: "Failed to get goods receipts" });
    }
  });

  app.post(
    "/api/goods-receipt",
    requireAuth,
    requireRole(["admin", "project_manager", "finance"]),
    async (req, res) => {
      try {
        const { reference, items } = req.body;

        if (
          !reference ||
          !items ||
          !Array.isArray(items) ||
          items.length === 0
        ) {
          return res
            .status(400)
            .json({ message: "Reference and items are required" });
        }

        // Validate items format
        for (const item of items) {
          if (
            !item.inventoryItemId ||
            typeof item.inventoryItemId !== "number" ||
            !item.quantity ||
            typeof item.quantity !== "number" ||
            item.quantity <= 0 ||
            typeof item.unitCost !== "number" ||
            item.unitCost < 0
          ) {
            return res
              .status(400)
              .json({
                message:
                  "Invalid item format: each item must have inventoryItemId, positive quantity, and valid unitCost",
              });
          }
        }

        const receipt = await storage.createGoodsReceipt(
          reference,
          items,
          req.session.userId,
        );
        res.status(201).json(receipt);
      } catch (error) {
        console.error("Goods receipt creation error:", error);
        res.status(500).json({ message: "Failed to create goods receipt" });
      }
    },
  );

  // Purchase Requests routes
  app.get("/api/purchase-requests", requireAuth, async (req, res) => {
    try {
      const requests = await storage.getPurchaseRequests();
      res.json(requests);
    } catch (error) {
      console.error("Get purchase requests error:", error);
      res.status(500).json({ message: "Failed to get purchase requests" });
    }
  });

  app.get("/api/purchase-requests/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const request = await storage.getPurchaseRequest(id);

      if (!request) {
        return res.status(404).json({ message: "Purchase request not found" });
      }

      res.json(request);
    } catch (error) {
      console.error("Get purchase request error:", error);
      res.status(500).json({ message: "Failed to get purchase request" });
    }
  });

  app.post("/api/purchase-requests", requireAuth, async (req, res) => {
    try {
      const { items, ...requestData } = req.body;

      // Get employee ID from current user (use user ID directly if no employee record)
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const employees = await storage.getEmployees();
      const employee = employees.find((emp) => emp.userId === user.id);

      // Use employee ID if found, otherwise use user ID directly
      const requestedBy = employee ? employee.id : user.id;

      // Validate items
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res
          .status(400)
          .json({ message: "At least one item is required" });
      }

      for (const item of items) {
        if (!item.inventoryItemId || !item.quantity || item.quantity <= 0) {
          return res
            .status(400)
            .json({
              message:
                "Invalid item data. Each item must have a valid inventory item ID and quantity greater than 0",
            });
        }
      }

      const request = await storage.createPurchaseRequest({
        ...requestData,
        requestedBy: requestedBy,
        items,
      });

      res.status(201).json(request);
    } catch (error) {
      console.error("Create purchase request error:", error);
      res.status(500).json({ message: "Failed to create purchase request" });
    }
  });

  app.put(
    "/api/purchase-requests/:id/approve",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);

        // Get employee ID from current user
        const user = await storage.getUser(req.session.userId!);
        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        const employees = await storage.getEmployees();
        const employee = employees.find((emp) => emp.userId === user.id);

        if (!employee) {
          return res
            .status(400)
            .json({ message: "Employee record not found for current user" });
        }

        const request = await storage.updatePurchaseRequest(id, {
          status: "approved",
          approvedBy: employee.id,
          approvalDate: new Date(),
        });

        if (!request) {
          return res
            .status(404)
            .json({ message: "Purchase request not found" });
        }

        res.json(request);
      } catch (error) {
        console.error("Approve purchase request error:", error);
        res.status(500).json({ message: "Failed to approve purchase request" });
      }
    },
  );

  app.put(
    "/api/purchase-requests/:id/reject",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);

        // Get employee ID from current user
        const user = await storage.getUser(req.session.userId!);
        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        const employees = await storage.getEmployees();
        const employee = employees.find((emp) => emp.userId === user.id);

        if (!employee) {
          return res
            .status(400)
            .json({ message: "Employee record not found for current user" });
        }

        const request = await storage.updatePurchaseRequest(id, {
          status: "rejected",
          approvedBy: employee.id,
          approvalDate: new Date(),
        });

        if (!request) {
          return res
            .status(404)
            .json({ message: "Purchase request not found" });
        }

        res.json(request);
      } catch (error) {
        console.error("Reject purchase request error:", error);
        res.status(500).json({ message: "Failed to reject purchase request" });
      }
    },
  );

  app.delete("/api/purchase-requests/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deletePurchaseRequest(id);

      if (!deleted) {
        return res.status(404).json({ message: "Purchase request not found" });
      }

      res.json({ message: "Purchase request deleted successfully" });
    } catch (error) {
      console.error("Delete purchase request error:", error);
      res.status(500).json({ message: "Failed to delete purchase request" });
    }
  });

  // Purchase Orders routes
  app.get(
    "/api/purchase-orders",
    requireAuth,
    requireRole(["admin", "finance", "project_manager"]),
    async (req, res) => {
      try {
        const orders = await storage.getPurchaseOrders();
        res.json(orders);
      } catch (error) {
        console.error("Get purchase orders error:", error);
        res.json([]); // Return empty array instead of error to prevent reports from failing
      }
    },
  );

  app.get(
    "/api/purchase-orders/:id",
    requireAuth,
    requireRole(["admin", "finance", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const order = await storage.getPurchaseOrder(id);

        if (!order) {
          return res.status(404).json({ message: "Purchase order not found" });
        }

        res.json(order);
      } catch (error) {
        console.error("Get purchase order error:", error);
        res.status(500).json({ message: "Failed to get purchase order" });
      }
    },
  );

  app.post(
    "/api/purchase-orders",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const orderData = {
          ...req.body,
          createdBy: req.session.userId,
        };

        const order = await storage.createPurchaseOrder(orderData);
        res.status(201).json(order);
      } catch (error) {
        console.error("Create purchase order error:", error);
        res.status(500).json({ message: "Failed to create purchase order" });
      }
    },
  );

  app.put(
    "/api/purchase-orders/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const orderData = req.body;

        const order = await storage.updatePurchaseOrder(id, orderData);
        if (!order) {
          return res.status(404).json({ message: "Purchase order not found" });
        }

        res.json(order);
      } catch (error) {
        console.error("Update purchase order error:", error);
        res.status(500).json({ message: "Failed to update purchase order" });
      }
    },
  );

  app.delete(
    "/api/purchase-orders/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const deleted = await storage.deletePurchaseOrder(id);

        if (!deleted) {
          return res.status(404).json({ message: "Purchase order not found" });
        }

        res.json({ message: "Purchase order deleted successfully" });
      } catch (error) {
        console.error("Delete purchase order error:", error);
        res.status(500).json({ message: "Failed to delete purchase order" });
      }
    },
  );

  // Purchase Invoices routes
  app.get(
    "/api/purchase-invoices",
    requireAuth,
    requireRole(["admin", "finance", "project_manager"]),
    async (req, res) => {
      try {
        const startDate = req.query.startDate as string;
        const endDate = req.query.endDate as string;
        const supplierId = req.query.supplierId ? parseInt(req.query.supplierId as string) : undefined;
        const status = req.query.status as string;

        const invoices = await storage.getPurchaseInvoicesFiltered({
          startDate,
          endDate,
          supplierId,
          status
        });
        res.json(invoices);
      } catch (error) {
        console.error("Get purchase invoices error:", error);
        res.status(500).json({ message: "Failed to get purchase invoices" });
      }
    },
  );

  app.get(
    "/api/purchase-invoices/:id",
    requireAuth,
    requireRole(["admin", "finance", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const invoice = await storage.getPurchaseInvoice(id);

        if (!invoice) {
          return res.status(404).json({ message: "Purchase invoice not found" });
        }

        res.json(invoice);
      } catch (error) {
        console.error("Get purchase invoice error:", error);
        res.status(500).json({ message: "Failed to get purchase invoice" });
      }
    },
  );

  app.post(
    "/api/purchase-invoices",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const invoiceData = {
          ...req.body,
          createdBy: req.session.userId,
        };

        const invoice = await storage.createPurchaseInvoiceStandalone(invoiceData);
        res.status(201).json(invoice);
      } catch (error) {
        console.error("Create purchase invoice error:", error);
        res.status(500).json({ message: "Failed to create purchase invoice" });
      }
    },
  );

  app.patch(
    "/api/purchase-invoices/:id/approve",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const invoice = await storage.getPurchaseInvoice(id);

        if (!invoice) {
          return res.status(404).json({ message: "Purchase invoice not found" });
        }

        if (invoice.approvalStatus === "approved") {
          return res.status(400).json({ message: "Invoice is already approved" });
        }

        await storage.approvePurchaseInvoice(id, req.session.userId!);
        res.json({ message: "Purchase invoice approved successfully" });
      } catch (error) {
        console.error("Approve purchase invoice error:", error);
        res.status(500).json({ message: "Failed to approve purchase invoice" });
      }
    },
  );

  app.post(
    "/api/purchase-invoices/:id/payments",
    requireAuth,
    requireRole(["admin", "finance"]),
    upload.array("paymentFiles", 10),
    async (req, res) => {
      try {
        const invoiceId = parseInt(req.params.id);
        const paymentData = {
          ...req.body,
          invoiceId,
          recordedBy: req.session.userId,
        };

        const payment = await storage.createPurchaseInvoicePayment(paymentData);

        // Handle file uploads if any
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
          for (const file of req.files) {
            await storage.createPurchasePaymentFile({
              paymentId: payment.id,
              fileName: file.filename,
              originalName: file.originalname,
              filePath: file.path,
              fileSize: file.size,
              mimeType: file.mimetype,
            });
          }
        }

        res.status(201).json(payment);
      } catch (error) {
        console.error("Record purchase payment error:", error);
        res.status(500).json({ message: "Failed to record payment" });
      }
    },
  );

  app.get(
    "/api/purchase-invoices/:id/payments",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const invoiceId = parseInt(req.params.id);
        const payments = await storage.getPurchaseInvoicePayments(invoiceId);
        res.json(payments);
      } catch (error) {
        console.error("Get purchase invoice payments error:", error);
        res.status(500).json({ message: "Failed to get purchase invoice payments" });
      }
    },
  );

  app.post(
    "/api/purchase-orders/:id/convert-to-invoice",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const poId = parseInt(req.params.id);
        const invoiceData = {
          ...req.body,
          createdBy: req.session.userId,
        };

        const invoice = await storage.createPurchaseInvoiceFromPO(
          poId,
          invoiceData,
        );
        res.status(201).json(invoice);
      } catch (error) {
        console.error("Convert PO to invoice error:", error);
        res
          .status(500)
          .json({ message: "Failed to convert purchase order to invoice" });
      }
    },
  );

  // Get supplier inventory items
  app.get("/api/suppliers/:id/suppliers", async (req, res) => {
    try {
      const supplierId = parseInt(req.params.id);
      const supplierItems =
        await storage.getSupplierInventoryItemsBySupplierId(supplierId);
      res.json(supplierItems);
    } catch (error) {
      console.error("Error fetching supplier inventory items:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch supplier inventory items" });
    }
  });

  // Get products for a specific supplier
  app.get("/api/suppliers/:id/products", async (req, res) => {
    try {
      const supplierId = parseInt(req.params.id);
      const products = await storage.getProductsBySupplier(supplierId);
      res.json(products);
    } catch (error) {
      console.error("Error fetching supplier products:", error);
      res.status(500).json({ message: "Failed to fetch supplier products" });
    }
  });

  app.put(
    "/api/suppliers/:id/archive",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const supplier = await storage.updateSupplier(id, { isArchived: true });

        if (!supplier) {
          return res.status(404).json({ message: "Supplier not found" });
        }

        res.json({ message: "Supplier archived successfully", supplier });
      } catch (error) {
        res.status(500).json({ message: "Failed to archive supplier" });
      }
    },
  );

  app.put(
    "/api/suppliers/:id/unarchive",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const supplier = await storage.updateSupplier(id, {
          isArchived: false,
        });

        if (!supplier) {
          return res.status(404).json({ message: "Supplier not found" });
        }

        res.json({ message: "Supplier unarchived successfully", supplier });
      } catch (error) {
        console.error("Supplier unarchive error:", error);
        res.status(500).json({ message: "Failed to unarchive supplier" });
      }
    },
  );

  // ============================================================================
  // Vessel Location Tracking
  // ============================================================================

  // Get vessel location using IMO number
  app.get("/api/vessel-location/:imo", async (req, res) => {
    const { imo } = req.params;

    if (!imo) {
      return res.status(400).json({ message: "IMO number is required" });
    }

    try {
      // Note: You'll need to set up VesselFinder API credentials
      // For demo purposes, we'll simulate the API response
      // Replace this with actual VesselFinder API call

      const vesselFinderApiKey = process.env.VESSEL_FINDER_API_KEY;

      if (!vesselFinderApiKey) {
        // Return mock data for development
        const mockData = {
          imo: imo,
          name: "Sample Vessel",
          lat: 25.276987,
          lon: 55.296249, // Dubai coordinates as example
          course: 45,
          speed: 12.5,
          heading: 42,
          timestamp: new Date().toISOString(),
          destination: "DUBAI",
          eta: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          status: "Under way using engine",
        };

        return res.json(mockData);
      }

      // Actual VesselFinder API call
      const vesselFinderUrl = `https://api.vesselfinder.com/vessels?userkey=${vesselFinderApiKey}&imo=${imo}&format=json`;

      const apiResponse = await fetch(vesselFinderUrl);

      if (!apiResponse.ok) {
        throw new Error(`VesselFinder API error: ${apiResponse.statusText}`);
      }

      const apiData = await apiResponse.json();

      if (!apiData || apiData.length === 0) {
        return res.status(404).json({ message: "Vessel not found" });
      }

      const vessel = apiData[0]; // Get first result

      // Transform API response to our format
      const vesselData = {
        imo: vessel.IMO || imo,
        name: vessel.SHIPNAME || "Unknown",
        lat: parseFloat(vessel.LAT) || 0,
        lon: parseFloat(vessel.LON) || 0,
        course: parseFloat(vessel.COURSE) || 0,
        speed: parseFloat(vessel.SPEED) || 0,
        heading: parseFloat(vessel.HEADING) || 0,
        timestamp: vessel.TIMESTAMP || new Date().toISOString(),
        destination: vessel.DESTINATION || "",
        eta: vessel.ETA || "",
        status: vessel.NAVSTAT || "Unknown",
      };

      res.json(vesselData);
    } catch (error) {
      console.error("Vessel location fetch error:", error);
      res.status(500).json({
        message: "Failed to fetch vessel location",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ============================================================================
  // General Ledger
  // ============================================================================

  // General Ledger routes
  app.get(
    "/api/general-ledger",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const entryType = req.query.entryType as string;
        const status = req.query.status as string;
        const startDate = req.query.startDate as string;
        const endDate = req.query.endDate as string;
        const entityId = req.query.entityId ? parseInt(req.query.entityId as string) : undefined;
        const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;

        const entries = await storage.getGeneralLedgerEntries({
          entryType,
          status,
          startDate,
          endDate,
          entityId,
          projectId,
        });
        res.json(entries);
      } catch (error) {
        console.error("Get general ledger entries error:", error);
        res.status(500).json({ message: "Failed to get general ledger entries" });
      }
    },
  );

  app.post(
    "/api/general-ledger",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const entryData = {
          ...req.body,
          createdBy: req.session.userId,
        };

        const entry = await storage.createGeneralLedgerEntry(entryData);
        res.status(201).json(entry);
      } catch (error) {
        console.error("Create general ledger entry error:", error);
        res.status(500).json({ message: "Failed to create general ledger entry" });
      }
    },
  );

  app.put(
    "/api/general-ledger/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const updateData = req.body;

        const entry = await storage.updateGeneralLedgerEntry(id, updateData);
        if (!entry) {
          return res.status(404).json({ message: "General ledger entry not found" });
        }

        res.json(entry);
      } catch (error) {
        console.error("Update general ledger entry error:", error);
        res.status(500).json({ message: "Failed to update general ledger entry" });
      }
    },
  );

  // ============================================================================
  // Error Logs
  // ============================================================================

  // Proforma Invoices routes
  app.get(
    "/api/proforma-invoices",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const proformaInvoices = await storage.getProformaInvoices();
        res.json(proformaInvoices);
      } catch (error) {
        console.error("Error fetching proforma invoices:", error);
        res.status(500).json({ message: "Failed to fetch proforma invoices" });
      }
    },
  );

  app.get(
    "/api/proforma-invoices/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const proformaInvoice = await storage.getProformaInvoice(id);

        if (!proformaInvoice) {
          return res
            .status(404)
            .json({ message: "Proforma invoice not found" });
        }

        res.json(proformaInvoice);
      } catch (error) {
        console.error("Error fetching proforma invoice:", error);
        res.status(500).json({ message: "Failed to fetch proforma invoice" });
      }
    },
  );

  app.post(
    "/api/proforma-invoices",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        console.log("Creating proforma invoice with data:", req.body);
        const proformaData = req.body;
        
        // Date fields should remain as ISO strings (YYYY-MM-DD format)
        // No conversion needed - Drizzle expects strings for date() columns
        
        const proformaInvoice = await storage.createProformaInvoice(proformaData);
        console.log("Created proforma invoice:", proformaInvoice);
        res.status(201).json(proformaInvoice);
      } catch (error) {
        console.error("Error creating proforma invoice:", error);
        res.status(500).json({ message: "Failed to create proforma invoice" });
      }
    },
  );

  app.put(
    "/api/proforma-invoices/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        console.log("Updating proforma invoice", id, "with data:", req.body);

        // If this is a status update to approved, add some validation
        if (req.body.status === "approved") {
          const existingProforma = await storage.getProformaInvoice(id);
          if (!existingProforma) {
            return res
              .status(404)
              .json({ message: "Proforma invoice not found" });
          }

          // Only allow approval from draft or sent status
          if (
            existingProforma.status !== "draft" &&
            existingProforma.status !== "sent"
          ) {
            return res.status(400).json({
              message: `Cannot approve proforma invoice from ${existingProforma.status} status`,
            });
          }
        }

        const proformaInvoice = await storage.updateProformaInvoice(
          id,
          req.body,
        );

        if (!proformaInvoice) {
          return res
            .status(404)
            .json({ message: "Proforma invoice not found" });
        }

        console.log("Updated proforma invoice:", proformaInvoice);
        res.json(proformaInvoice);
      } catch (error) {
        console.error("Error updating proforma invoice:", error);
        res.status(500).json({ message: "Failed to update proforma invoice" });
      }
    },
  );

  app.post(
    "/api/proforma-invoices/:id/convert-to-invoice",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const proformaId = parseInt(req.params.id);

        // Get the proforma invoice
        const proforma = await storage.getProformaInvoice(proformaId);
        if (!proforma) {
          return res
            .status(404)
            .json({ message: "Proforma invoice not found" });
        }

        // Check if proforma is approved
        if (proforma.status !== "approved") {
          return res
            .status(400)
            .json({
              message:
                "Only approved proforma invoices can be converted to sales invoices",
            });
        }

        // Generate invoice number
        const invoiceNumber = `SI-${Date.now()}`;

        // Create sales invoice data
        const invoiceData = {
          invoiceNumber,
          customerId: proforma.customerId,
          projectId: proforma.projectId,
          quotationId: proforma.quotationId,
          status: "draft",
          invoiceDate: new Date().toISOString().split("T")[0],
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0], // 30 days from now
          items: proforma.items || [],
          subtotal: proforma.subtotal,
          taxAmount: proforma.taxAmount,
          discount: proforma.discount,
          totalAmount: proforma.totalAmount,
          paidAmount: "0",
        };

        // Create the sales invoice
        const salesInvoice = await storage.createSalesInvoice(invoiceData);

        // Update proforma status to converted
        await storage.updateProformaInvoice(proformaId, {
          status: "converted",
        });

        res.status(201).json({
          message: "Proforma invoice converted to sales invoice successfully",
          salesInvoice,
          proformaInvoice: await storage.getProformaInvoice(proformaId),
        });
      } catch (error) {
        console.error(
          "Error converting proforma invoice to sales invoice:",
          error,
        );
        res
          .status(500)
          .json({
            message: "Failed to convert proforma invoice to sales invoice",
          });
      }
    },
  );

  app.delete(
    "/api/proforma-invoices/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        await storage.deleteProformaInvoice(id);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting proforma invoice:", error);
        res.status(500).json({ message: "Failed to delete proforma invoice" });
      }
    },
  );

  // Credit Notes routes
  app.get(
    "/api/credit-notes",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const creditNotes = await storage.getCreditNotes();
        res.json(creditNotes);
      } catch (error) {
        console.error("Error fetching credit notes:", error);
        res.status(500).json({ message: "Failed to fetch credit notes" });
      }
    },
  );

  app.get(
    "/api/credit-notes/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const creditNote = await storage.getCreditNote(id);

        if (!creditNote) {
          return res.status(404).json({ message: "Credit note not found" });
        }

        res.json(creditNote);
      } catch (error) {
        console.error("Error fetching credit note:", error);
        res.status(500).json({ message: "Failed to fetch credit note" });
      }
    },
  );

  app.post(
    "/api/credit-notes",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        console.log("Creating credit note with data:", req.body);
        const creditNoteData = req.body;
        
        // Date fields should remain as ISO strings (YYYY-MM-DD format)
        // No conversion needed - Drizzle expects strings for date() columns
        
        const creditNote = await storage.createCreditNote(creditNoteData);
        console.log("Created credit note:", creditNote);
        res.status(201).json(creditNote);
      } catch (error) {
        console.error("Error creating credit note:", error);
        res.status(500).json({ message: "Failed to create credit note" });
      }
    },
  );

  app.put(
    "/api/credit-notes/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        console.log("Updating credit note", id, "with data:", req.body);

        const creditNote = await storage.updateCreditNote(id, req.body);

        if (!creditNote) {
          return res.status(404).json({ message: "Credit note not found" });
        }

        console.log("Updated credit note:", creditNote);
        res.json(creditNote);
      } catch (error) {
        console.error("Error updating credit note:", error);
        res.status(500).json({ message: "Failed to update credit note" });
      }
    },
  );

  app.delete(
    "/api/credit-notes/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        await storage.deleteCreditNote(id);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting credit note:", error);
        res.status(500).json({ message: "Failed to delete credit note" });
      }
    },
  );

  app.get(
    "/api/sales-invoices/:id/credit-notes",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const invoiceId = parseInt(req.params.id);
        const creditNotes = await storage.getCreditNotesByInvoice(invoiceId);
        res.json(creditNotes);
      } catch (error) {
        console.error("Error fetching credit notes for invoice:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch credit notes for invoice" });
      }
    },
  );

  // Purchase Credit Notes routes
  app.get(
    "/api/purchase-credit-notes",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const creditNotes = await storage.getPurchaseCreditNotes();
        res.json(creditNotes);
      } catch (error) {
        console.error("Error fetching purchase credit notes:", error);
        res.status(500).json({ message: "Failed to fetch purchase credit notes" });
      }
    },
  );

  app.get(
    "/api/purchase-credit-notes/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const creditNote = await storage.getPurchaseCreditNote(id);

        if (!creditNote) {
          return res.status(404).json({ message: "Purchase credit note not found" });
        }

        res.json(creditNote);
      } catch (error) {
        console.error("Error fetching purchase credit note:", error);
        res.status(500).json({ message: "Failed to fetch purchase credit note" });
      }
    },
  );

  app.post(
    "/api/purchase-credit-notes",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        console.log("Creating purchase credit note with data:", req.body);
        const creditNote = await storage.createPurchaseCreditNote(req.body);
        console.log("Created purchase credit note:", creditNote);
        res.status(201).json(creditNote);
      } catch (error) {
        console.error("Error creating purchase credit note:", error);
        res.status(500).json({ message: "Failed to create purchase credit note" });
      }
    },
  );

  app.put(
    "/api/purchase-credit-notes/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        console.log("Updating purchase credit note", id, "with data:", req.body);

        const creditNote = await storage.updatePurchaseCreditNote(id, req.body);

        if (!creditNote) {
          return res.status(404).json({ message: "Purchase credit note not found" });
        }

        console.log("Updated purchase credit note:", creditNote);
        res.json(creditNote);
      } catch (error) {
        console.error("Error updating purchase credit note:", error);
        res.status(500).json({ message: "Failed to update purchase credit note" });
      }
    },
  );

  app.delete(
    "/api/purchase-credit-notes/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        await storage.deletePurchaseCreditNote(id);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting purchase credit note:", error);
        res.status(500).json({ message: "Failed to delete purchase credit note" });
      }
    },
  );

  app.get(
    "/api/purchase-invoices/:id/credit-notes",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const invoiceId = parseInt(req.params.id);
        const creditNotes = await storage.getPurchaseCreditNotesByInvoice(invoiceId);
        res.json(creditNotes);
      } catch (error) {
        console.error("Error fetching purchase credit notes for invoice:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch purchase credit notes for invoice" });
      }
    },
  );

  // Error Logs routes
  app.get("/api/error-logs", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const severity = req.query.severity as string;
      const resolved = req.query.resolved as string;

      const result = await storage.getErrorLogs(
        page,
        limit,
        severity,
        resolved === "true" ? true : resolved === "false" ? false : undefined,
      );

      res.json(result);
    } catch (error) {
      console.error("Error fetching error logs:", error);
      res.status(500).json({ message: "Failed to fetch error logs" });
    }
  });

  app.post("/api/error-logs", async (req, res) => {
    try {
      const errorData = {
        message: req.body.message,
        stack: req.body.stack,
        url: req.body.url,
        userAgent: req.headers["user-agent"],
        userId: req.session.userId || null,
        severity: req.body.severity || "error",
        component: req.body.component,
      };

      const errorLog = await storage.createErrorLog(errorData);
      res.status(201).json(errorLog);
    } catch (error) {
      console.error("Create error log error:", error);
      res.status(500).json({ message: "Failed to create error log" });
    }
  });

  app.put(
    "/api/error-logs/:id/resolve",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const errorLog = await storage.updateErrorLog(id, { resolved: true });

        if (!errorLog) {
          return res.status(404).json({ message: "Error log not found" });
        }

        res.json(errorLog);
      } catch (error) {
        console.error("Resolve error log error:", error);
        res.status(500).json({ message: "Failed to resolve error log" });
      }
    },
  );

  app.delete(
    "/api/error-logs/clear",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const deletedCount = await storage.clearErrorLogs();
        res.json({
          message: "All error logs cleared successfully",
          deletedCount,
        });
      } catch (error) {
        console.error("Clear error logs error:", error);
        res.status(500).json({ message: "Failed to clear error logs" });
      }
    },
  );

  app.delete(
    "/api/error-logs/clear-resolved",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const deletedCount = await storage.clearResolvedErrorLogs();
        res.json({
          message: "Resolved error logs cleared successfully",
          deletedCount,
        });
      } catch (error) {
        console.error("Clear resolved error logs error:", error);
        res
          .status(500)
          .json({ message: "Failed to clear resolved error logs" });
      }
    },
  );

  app.get(
    "/api/credit-notes/:id/pdf",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const creditNoteId = parseInt(req.params.id);
        const creditNote = await storage.getCreditNote(creditNoteId);
        const customer = await storage.getCustomer(creditNote?.customerId);
        const company = await storage.getCompany();

        if (!creditNote || !customer || !company) {
          return res
            .status(404)
            .json({ message: "Credit note or related data not found" });
        }

        const html = generateCreditNoteHTML(creditNote, customer, company);

        res.setHeader("Content-Type", "text/html");
        res.send(html);
      } catch (error) {
        console.error("Credit note PDF generation error:", error);
        res.status(500).json({ message: "Failed to generate credit note PDF" });
      }
    },
  );

  app.get(
    "/api/sales-invoices/:id/pdf",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const invoiceId = parseInt(req.params.id);
        const invoice = await storage.getSalesInvoice(invoiceId);
        const customer = await storage.getCustomer(invoice?.customerId);
        const company = await storage.getCompany();

        if (!invoice || !customer || !company) {
          return res
            .status(404)
            .json({ message: "Invoice or related data not found" });
        }

        const html = generateInvoiceHTML(invoice, customer, company);

        res.setHeader("Content-Type", "text/html");
        res.send(html);
      } catch (error) {
        console.error("PDF generation error:", error);
        res.status(500).json({ message: "Failed to generate PDF" });
      }
    },
  );

  // Customer Documents routes
  app.get("/api/customers/:id/documents", requireAuth, async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      const documents = await storage.getCustomerDocuments(customerId);
      res.json(documents);
    } catch (error) {
      console.error("Error getting customer documents:", error);
      res.status(500).json({ message: "Failed to get customer documents" });
    }
  });

  app.post("/api/customers/:id/documents", requireAuth, requireRole(["admin", "project_manager"]), upload.single('file'), async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      const documentData = { ...req.body, customerId };
      
      // Handle file upload
      if (req.file) {
        documentData.filePath = req.file.path;
        documentData.fileName = req.file.originalname;
        documentData.fileSize = req.file.size;
      }
      
      // Convert date strings to Date objects
      if (documentData.dateOfIssue && typeof documentData.dateOfIssue === 'string') {
        documentData.dateOfIssue = new Date(documentData.dateOfIssue);
      }
      if (documentData.expiryDate && typeof documentData.expiryDate === 'string') {
        documentData.expiryDate = new Date(documentData.expiryDate);
      }
      
      const parsedData = insertCustomerDocumentSchema.parse(documentData);
      const result = await storage.createCustomerDocument(parsedData);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating customer document:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create customer document" });
    }
  });

  app.put("/api/customers/:customerId/documents/:documentId", requireAuth, requireRole(["admin", "project_manager"]), upload.single('file'), async (req, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      const documentData = { ...req.body };
      
      // Handle file upload
      if (req.file) {
        documentData.filePath = req.file.path;
        documentData.fileName = req.file.originalname;
        documentData.fileSize = req.file.size;
      }
      
      // Convert date strings to Date objects
      if (documentData.dateOfIssue && typeof documentData.dateOfIssue === 'string') {
        documentData.dateOfIssue = new Date(documentData.dateOfIssue);
      }
      if (documentData.expiryDate && typeof documentData.expiryDate === 'string') {
        documentData.expiryDate = new Date(documentData.expiryDate);
      }
      
      const result = await storage.updateCustomerDocument(documentId, documentData);
      if (!result) {
        return res.status(404).json({ message: "Document not found" });
      }
      res.json(result);
    } catch (error) {
      console.error("Error updating customer document:", error);
      res.status(500).json({ message: "Failed to update customer document" });
    }
  });

  app.delete("/api/customers/:customerId/documents/:documentId", requireAuth, requireRole(["admin", "project_manager"]), async (req, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      const success = await storage.deleteCustomerDocument(documentId);
      if (!success) {
        return res.status(404).json({ message: "Document not found" });
      }
      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Error deleting customer document:", error);
      res.status(500).json({ message: "Failed to delete customer document" });
    }
  });

  // Supplier Documents routes
  app.get("/api/suppliers/:id/documents", requireAuth, async (req, res) => {
    try {
      const supplierId = parseInt(req.params.id);
      const documents = await storage.getSupplierDocuments(supplierId);
      res.json(documents);
    } catch (error) {
      console.error("Error getting supplier documents:", error);
      res.status(500).json({ message: "Failed to get supplier documents" });
    }
  });

  app.post("/api/suppliers/:id/documents", requireAuth, requireRole(["admin", "project_manager"]), upload.single('file'), async (req, res) => {
    try {
      const supplierId = parseInt(req.params.id);
      const documentData = { ...req.body, supplierId };
      
      // Handle file upload
      if (req.file) {
        documentData.filePath = req.file.path;
        documentData.fileName = req.file.originalname;
        documentData.fileSize = req.file.size;
      }
      
      // Convert date strings to Date objects
      if (documentData.dateOfIssue && typeof documentData.dateOfIssue === 'string') {
        documentData.dateOfIssue = new Date(documentData.dateOfIssue);
      }
      if (documentData.expiryDate && typeof documentData.expiryDate === 'string') {
        documentData.expiryDate = new Date(documentData.expiryDate);
      }
      
      const parsedData = insertSupplierDocumentSchema.parse(documentData);
      const result = await storage.createSupplierDocument(parsedData);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating supplier document:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create supplier document" });
    }
  });

  app.put("/api/suppliers/:supplierId/documents/:documentId", requireAuth, requireRole(["admin", "project_manager"]), upload.single('file'), async (req, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      const documentData = { ...req.body };
      
      // Handle file upload
      if (req.file) {
        documentData.filePath = req.file.path;
        documentData.fileName = req.file.originalname;
        documentData.fileSize = req.file.size;
      }
      
      // Convert date strings to Date objects
      if (documentData.dateOfIssue && typeof documentData.dateOfIssue === 'string') {
        documentData.dateOfIssue = new Date(documentData.dateOfIssue);
      }
      if (documentData.expiryDate && typeof documentData.expiryDate === 'string') {
        documentData.expiryDate = new Date(documentData.expiryDate);
      }
      
      const result = await storage.updateSupplierDocument(documentId, documentData);
      if (!result) {
        return res.status(404).json({ message: "Document not found" });
      }
      res.json(result);
    } catch (error) {
      console.error("Error updating supplier document:", error);
      res.status(500).json({ message: "Failed to update supplier document" });
    }
  });

  app.delete("/api/suppliers/:supplierId/documents/:documentId", requireAuth, requireRole(["admin", "project_manager"]), async (req, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      const success = await storage.deleteSupplierDocument(documentId);
      if (!success) {
        return res.status(404).json({ message: "Document not found" });
      }
      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Error deleting supplier document:", error);
      res.status(500).json({ message: "Failed to delete supplier document" });
    }
  });

  // Asset routes
  app.use(assetRoutes);

  const httpServer = createServer(app);
  return httpServer;
}