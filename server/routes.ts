import express, { type Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import path from "path";
import { assetRoutes } from "./asset-routes";
import { projectsRoutes } from "./routes/projects.routes";
import { employeesRoutes } from "./routes/employees.routes";
import { salesInvoicesRoutes } from "./routes/sales-invoices.routes";
import { purchaseInvoicesRoutes } from "./routes/purchase-invoices.routes";
import { payrollRoutes } from "./routes/payroll.routes";
import { dashboardRoutes } from "./routes/dashboard.routes";
import { salesQuotationsRoutes } from "./routes/sales-quotations.routes";
import { reimbursementsRoutes } from "./routes/reimbursements.routes";
import { printRoutes } from "./routes/print.routes";
import { purchaseOrdersRoutes } from "./routes/purchase-orders.routes";
import { suppliersRoutes } from "./routes/suppliers.routes";
import { inventoryRoutes } from "./routes/inventory.routes";
import { usersRoutes } from "./routes/users.routes";
import { customersRoutes } from "./routes/customers.routes";
import { systemRoutes } from "./routes/system.routes";
import { purchaseRequestsRoutes } from "./routes/purchase-requests.routes";
import { reportsRoutes } from "./routes/reports.routes";
import { exchangeRatesRoutes } from "./routes/exchange-rates.routes";
import { generalLedgerRoutes } from "./routes/general-ledger.routes";
import { assetsRoutes } from "./routes/assets.routes";
import { miscRoutes } from "./routes/misc.routes";
import { errorLogsRoutes } from "./routes/error-logs.routes";
import { profileRoutes } from "./routes/profile.routes";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    userRole?: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(
    "/attached_assets",
    express.static(path.join(process.cwd(), "attached_assets")),
  );
  // Serve uploaded files statically
  app.use("/uploads", express.static("uploads"));

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

  // Domain routers. Mount order is not significant: every route has a
  // literal second path segment, so no two routers can match one URL.
  // assetRoutes stays last - routes.ts has always registered its own
  // /api/asset-types handlers ahead of it, and those win.
  app.use(projectsRoutes);
  app.use(employeesRoutes);
  app.use(profileRoutes);
  app.use(salesInvoicesRoutes);
  app.use(purchaseInvoicesRoutes);
  app.use(payrollRoutes);
  app.use(dashboardRoutes);
  app.use(salesQuotationsRoutes);
  app.use(reimbursementsRoutes);
  app.use(printRoutes);
  app.use(purchaseOrdersRoutes);
  app.use(suppliersRoutes);
  app.use(inventoryRoutes);
  app.use(usersRoutes);
  app.use(customersRoutes);
  app.use(systemRoutes);
  app.use(purchaseRequestsRoutes);
  app.use(reportsRoutes);
  app.use(exchangeRatesRoutes);
  app.use(generalLedgerRoutes);
  app.use(assetsRoutes);
  app.use(miscRoutes);
  app.use(errorLogsRoutes);

  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Asset routes
  app.use(assetRoutes);

  const httpServer = createServer(app);
  return httpServer;
}
