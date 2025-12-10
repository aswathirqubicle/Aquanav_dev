import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ErrorDialog } from "@/components/ui/error-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { Layout } from "@/components/layout/layout";
import { setErrorDialogHandler, ErrorDialogData } from "@/lib/error-logger";
import { useState, useEffect } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import ProjectsIndex from "@/pages/projects/index";
import ProjectCreate from "@/pages/projects/create";
import ProjectDetail from "@/pages/projects/[id]";
import EmployeesIndex from "@/pages/employees/enhanced-index";
import SalesIndex from "@/pages/sales";
import ProformaInvoicesIndex from "./pages/proforma-invoices";
import CreditNotesIndex from "./pages/credit-notes";
import PayrollIndex from "@/pages/payroll";
import SuppliersIndex from "./pages/suppliers/index";
import SupplierOrders from "./pages/suppliers/orders";
import SupplierProducts from "./pages/suppliers/products";
import ReportsIndex from "@/pages/reports/index";
import ProfitLossReport from "@/pages/reports/profit-loss";
import SettingsIndex from "@/pages/settings/index";
import CurrencySettings from "@/pages/settings/CurrencySettings";
import UsersIndex from "@/pages/users/index";
import NotFound from "@/pages/not-found";
import { lazy, Suspense } from "react";
import GeneralLedgerReceivable from "./pages/general-ledger/receivable";
import GeneralLedgerPayable from "./pages/general-ledger/payable";
import GeneralLedgerIndex from "./pages/general-ledger/index";
import PayablesReceivablesReport from "./pages/reports/payables-receivables";

// Lazy load heavy components
const InventoryIndex = lazy(() => import("./pages/inventory/index"));
const GoodsReceipt = lazy(() => import("./pages/inventory/goods-receipt"));
const GoodsIssue = lazy(() => import("./pages/inventory/goods-issue"));

const ErrorLogsIndex = lazy(() => import("./pages/error-logs/index"));
const PurchaseRequestsIndex = lazy(() => import("./pages/purchase-requests/index"));
const PurchaseOrdersIndex = lazy(() => import("./pages/purchase-orders/index"));
const PurchaseInvoicesIndex = lazy(() => import("./pages/purchase-invoices/index"));
const CustomersIndex = lazy(() => import("./pages/customers/index"));
const AssetInventoryIndex = lazy(() => import("./pages/asset-inventory/index"));


function Router() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ocean-600"></div></div>}>
      <Switch>
        <Route path="/" component={Login} />
        <Route path="/login" component={Login} />

        <Route>
          <Layout>
            <Switch>
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/projects" component={ProjectsIndex} />
              <Route path="/projects/create" component={ProjectCreate} />
              <Route path="/projects/:id" component={ProjectDetail} />
              <Route path="/employees" component={EmployeesIndex} />
              <Route path="/inventory" component={InventoryIndex} />
              <Route path="/inventory/goods-receipt" component={GoodsReceipt} />
              <Route path="/inventory/goods-issue" component={GoodsIssue} />

              <Route path="/asset-inventory" component={AssetInventoryIndex} />
              <Route path="/sales" component={SalesIndex} />
              <Route path="/proforma-invoices" component={() => <ProformaInvoicesIndex />} />
              <Route path="/credit-notes" component={CreditNotesIndex} />
              <Route path="/reports" component={ReportsIndex} />
              <Route path="/reports/profit-loss" component={() => <ProfitLossReport />} />
              <Route path="/reports/payables-receivables" component={PayablesReceivablesReport} />
              <Route path="/general-ledger" component={GeneralLedgerIndex} />
              <Route path="/general-ledger/receivable" component={GeneralLedgerReceivable} />
              <Route path="/general-ledger/payable" component={GeneralLedgerPayable} />
              <Route path="/error-logs" component={lazy(() => import("@/pages/error-logs"))} />
              <Route path="/payroll" component={PayrollIndex} />
              <Route path="/customers" component={CustomersIndex} />
              <Route path="/suppliers" component={SuppliersIndex} />
              <Route path="/suppliers/:id/orders" component={SupplierOrders} />
              <Route path="/suppliers/:id/products" component={SupplierProducts} />
              <Route path="/purchase-requests" component={PurchaseRequestsIndex} />
              <Route path="/purchase-orders" component={PurchaseOrdersIndex} />
              <Route path="/purchase-invoices" component={PurchaseInvoicesIndex} />
              <Route path="/settings" component={SettingsIndex} />
              <Route path="/settings/currency" component={CurrencySettings} />
              <Route path="/users" component={UsersIndex} />
              <Route component={NotFound} />

            </Switch>
          </Layout>
        </Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  const [errorDialog, setErrorDialog] = useState<ErrorDialogData | null>(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);

  useEffect(() => {
    // Set up global error dialog handler
    setErrorDialogHandler((error: ErrorDialogData) => {
      setErrorDialog(error);
      setErrorDialogOpen(true);
    });
  }, []);

  useEffect(() => {
    // Initialize error logger
    import("./lib/error-logger").catch(() => {
      // Silently fail if error logger fails to load
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DndProvider backend={HTML5Backend}>
          <TooltipProvider>
            <Toaster />
            <Router />
            <ErrorDialog
              error={errorDialog}
              open={errorDialogOpen}
              onOpenChange={setErrorDialogOpen}
            />
          </TooltipProvider>
        </DndProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;