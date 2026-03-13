import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import {
  Ship, CheckCircle, AlertTriangle, DollarSign, Plus,
  TrendingUp, TrendingDown, CreditCard, FileText, Clock, ArrowUpRight, ArrowDownRight,
  Receipt, Wallet, BadgeAlert, Briefcase, Users, PackageCheck, CalendarClock,
  FolderOpen, ClipboardList, BarChart3, Anchor
} from "lucide-react";
import { Project, DashboardStats } from "@shared/schema";

interface FinanceStats {
  totalReceivable: number;
  totalPayable: number;
  currentMonthRevenue: number;
  revenueChange: number;
  currentMonthExpenses: number;
  expensesChange: number;
  pendingApprovalSales: number;
  pendingApprovalPurchases: number;
  pendingReimbursements: number;
  overdueSalesInvoices: number;
  overduePurchaseInvoices: number;
  recentSalesInvoices: Array<{
    id: number;
    invoiceNumber: string;
    customerName: string;
    totalAmount: string;
    paidAmount: string;
    status: string;
    dueDate: string;
    currency: string;
  }>;
  recentPurchaseInvoices: Array<{
    id: number;
    invoiceNumber: string;
    supplierName: string;
    totalAmount: string;
    paidAmount: string;
    status: string;
    paymentStatus: string;
    dueDate: string;
    currency: string;
  }>;
}

const formatCurrency = (amount: string | number) => {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

function FinanceDashboard() {
  const [, setLocation] = useLocation();

  const { data: financeStats, isLoading } = useQuery<FinanceStats>({
    queryKey: ["/api/dashboard/finance-stats"],
  });

  const getInvoiceStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      draft: { label: "Draft", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
      pending_approval: { label: "Pending", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
      approved: { label: "Approved", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
      unpaid: { label: "Unpaid", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
      partially_paid: { label: "Partial", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
      paid: { label: "Paid", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
      overdue: { label: "Overdue", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
      rejected: { label: "Rejected", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
      cancelled: { label: "Cancelled", className: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
    };
    const c = config[status] || { label: status, className: "bg-slate-100 text-slate-700" };
    return <Badge className={`text-xs ${c.className}`}>{c.label}</Badge>;
  };

  const getPaymentStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      unpaid: { label: "Unpaid", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
      partial: { label: "Partial", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
      paid: { label: "Paid", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    };
    const c = config[status] || { label: status, className: "bg-slate-100 text-slate-700" };
    return <Badge className={`text-xs ${c.className}`}>{c.label}</Badge>;
  };

  const totalPendingActions = (financeStats?.pendingApprovalSales || 0) +
    (financeStats?.pendingApprovalPurchases || 0) +
    (financeStats?.pendingReimbursements || 0);

  const totalOverdue = (financeStats?.overdueSalesInvoices || 0) +
    (financeStats?.overduePurchaseInvoices || 0);

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Finance Dashboard</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Financial overview and pending actions
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <ArrowDownRight className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Accounts Receivable</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {isLoading ? "..." : formatCurrency(financeStats?.totalReceivable || 0)}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <span className={`font-medium ${(financeStats?.overdueSalesInvoices || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {isLoading ? "..." : `${financeStats?.overdueSalesInvoices || 0} overdue`}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <ArrowUpRight className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Accounts Payable</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {isLoading ? "..." : formatCurrency(financeStats?.totalPayable || 0)}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <span className={`font-medium ${(financeStats?.overduePurchaseInvoices || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {isLoading ? "..." : `${financeStats?.overduePurchaseInvoices || 0} overdue`}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-ocean-100 dark:bg-ocean-900/20 rounded-lg">
                <TrendingUp className="h-6 w-6 text-ocean-600 dark:text-ocean-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Revenue This Month</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {isLoading ? "..." : formatCurrency(financeStats?.currentMonthRevenue || 0)}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <span className={`font-medium ${(financeStats?.revenueChange || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {isLoading ? "..." : `${(financeStats?.revenueChange || 0) >= 0 ? '+' : ''}${financeStats?.revenueChange || 0}%`}
                </span>
                <span className="text-slate-500 dark:text-slate-400 ml-1">
                  {isLoading ? "" : "from last month"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                <TrendingDown className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Expenses This Month</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {isLoading ? "..." : formatCurrency(financeStats?.currentMonthExpenses || 0)}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <span className={`font-medium ${(financeStats?.expensesChange || 0) <= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {isLoading ? "..." : `${(financeStats?.expensesChange || 0) >= 0 ? '+' : ''}${financeStats?.expensesChange || 0}%`}
                </span>
                <span className="text-slate-500 dark:text-slate-400 ml-1">
                  {isLoading ? "" : "from last month"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {(totalPendingActions > 0 || totalOverdue > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {(financeStats?.pendingApprovalSales || 0) > 0 && (
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setLocation("/sales-invoices")}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-300">{financeStats?.pendingApprovalSales} Sales Invoice{(financeStats?.pendingApprovalSales || 0) !== 1 ? 's' : ''}</p>
                  <p className="text-sm text-amber-600 dark:text-amber-400">Pending approval</p>
                </div>
              </CardContent>
            </Card>
          )}

          {(financeStats?.pendingApprovalPurchases || 0) > 0 && (
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setLocation("/purchase-invoices")}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <Receipt className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-300">{financeStats?.pendingApprovalPurchases} Purchase Invoice{(financeStats?.pendingApprovalPurchases || 0) !== 1 ? 's' : ''}</p>
                  <p className="text-sm text-amber-600 dark:text-amber-400">Pending approval</p>
                </div>
              </CardContent>
            </Card>
          )}

          {(financeStats?.pendingReimbursements || 0) > 0 && (
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setLocation("/reimbursements")}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <Wallet className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-300">{financeStats?.pendingReimbursements} Reimbursement{(financeStats?.pendingReimbursements || 0) !== 1 ? 's' : ''}</p>
                  <p className="text-sm text-amber-600 dark:text-amber-400">Pending approval</p>
                </div>
              </CardContent>
            </Card>
          )}

          {totalOverdue > 0 && (
            <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setLocation("/general-ledger/receivable")}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <BadgeAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="font-semibold text-red-800 dark:text-red-300">{totalOverdue} Overdue Invoice{totalOverdue !== 1 ? 's' : ''}</p>
                  <p className="text-sm text-red-600 dark:text-red-400">Requires attention</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Recent Sales Invoices</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setLocation("/sales-invoices")}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-6">
                <p className="text-slate-500 dark:text-slate-400">Loading...</p>
              </div>
            ) : !financeStats?.recentSalesInvoices?.length ? (
              <div className="text-center py-6">
                <FileText className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400">No sales invoices found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {financeStats.recentSalesInvoices.map((inv) => (
                  <div key={inv.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                    onClick={() => setLocation(`/sales-invoices/${inv.id}`)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 dark:text-slate-100 truncate">{inv.invoiceNumber}</span>
                        {getInvoiceStatusBadge(inv.status)}
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{inv.customerName}</p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(inv.totalAmount)}</p>
                      {inv.dueDate && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Due: {new Date(inv.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Recent Purchase Invoices</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setLocation("/purchase-invoices")}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-6">
                <p className="text-slate-500 dark:text-slate-400">Loading...</p>
              </div>
            ) : !financeStats?.recentPurchaseInvoices?.length ? (
              <div className="text-center py-6">
                <Receipt className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400">No purchase invoices found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {financeStats.recentPurchaseInvoices.map((inv) => (
                  <div key={inv.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                    onClick={() => setLocation(`/purchase-invoices/${inv.id}`)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 dark:text-slate-100 truncate">{inv.invoiceNumber}</span>
                        {getPaymentStatusBadge(inv.paymentStatus)}
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{inv.supplierName}</p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(inv.totalAmount)}</p>
                      {inv.dueDate && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Due: {new Date(inv.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => setLocation("/sales-invoices")}>
          <FileText className="h-5 w-5 text-ocean-600 dark:text-ocean-400" />
          <span className="text-sm">Sales Invoices</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => setLocation("/purchase-invoices")}>
          <Receipt className="h-5 w-5 text-ocean-600 dark:text-ocean-400" />
          <span className="text-sm">Purchase Invoices</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => setLocation("/general-ledger")}>
          <CreditCard className="h-5 w-5 text-ocean-600 dark:text-ocean-400" />
          <span className="text-sm">General Ledger</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => setLocation("/payroll")}>
          <Wallet className="h-5 w-5 text-ocean-600 dark:text-ocean-400" />
          <span className="text-sm">Payroll</span>
        </Button>
      </div>
    </div>
  );
}

interface PMStats {
  activeProjects: number;
  completedProjects: number;
  onHoldProjects: number;
  totalProjects: number;
  pendingPurchaseRequests: number;
  myPendingReimbursements: number;
  lowStockItems: number;
  totalBudget: number;
  totalActualCost: number;
  upcomingDeadlines: Array<{
    id: number;
    title: string;
    vesselName: string;
    plannedEndDate: string;
    status: string;
    daysRemaining: number;
  }>;
  recentProjects: Array<{
    id: number;
    title: string;
    vesselName: string;
    status: string;
    estimatedBudget: string;
    actualCost: string;
    plannedEndDate: string;
    progress: number;
  }>;
}

interface EmployeeStats {
  activeProjects: number;
  totalProjects: number;
  pendingReimbursements: number;
  approvedReimbursements: number;
  totalReimbursementAmount: number;
  recentProjects: Array<{
    id: number;
    title: string;
    vesselName: string;
    status: string;
    plannedEndDate: string;
  }>;
  recentReimbursements: Array<{
    id: number;
    amount: string;
    description: string;
    status: string;
    submissionTimestamp: string;
  }>;
}

function ProjectManagerDashboard() {
  const [, setLocation] = useLocation();

  const { data: stats, isLoading } = useQuery<PMStats>({
    queryKey: ["/api/dashboard/pm-stats"],
  });

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Project Manager Dashboard</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Project overview and operational insights
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Briefcase className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Active Projects</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {isLoading ? "..." : stats?.activeProjects || 0}
                </p>
              </div>
            </div>
            <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              {isLoading ? "..." : `${stats?.totalProjects || 0} total projects`}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Completed</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {isLoading ? "..." : stats?.completedProjects || 0}
                </p>
              </div>
            </div>
            <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              {isLoading ? "..." : `${stats?.onHoldProjects || 0} on hold`}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Low Stock Items</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {isLoading ? "..." : stats?.lowStockItems || 0}
                </p>
              </div>
            </div>
            <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              Items below minimum level
            </div>
          </CardContent>
        </Card>
      </div>

      {((stats?.pendingPurchaseRequests || 0) > 0 || (stats?.myPendingReimbursements || 0) > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {(stats?.pendingPurchaseRequests || 0) > 0 && (
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/purchase-requests")}>
              <CardContent className="p-4 flex items-center gap-3">
                <PackageCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-300">{stats?.pendingPurchaseRequests} Purchase Requests Pending</p>
                  <p className="text-sm text-amber-600 dark:text-amber-400">Review and submit for approval</p>
                </div>
              </CardContent>
            </Card>
          )}
          {(stats?.myPendingReimbursements || 0) > 0 && (
            <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/reimbursements")}>
              <CardContent className="p-4 flex items-center gap-3">
                <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="font-medium text-blue-800 dark:text-blue-300">{stats?.myPendingReimbursements} Pending Reimbursements</p>
                  <p className="text-sm text-blue-600 dark:text-blue-400">Awaiting approval</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-orange-500" />
              Upcoming Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4 text-slate-500">Loading...</div>
            ) : !stats?.upcomingDeadlines?.length ? (
              <div className="text-center py-4 text-slate-500 dark:text-slate-400">No upcoming deadlines within 30 days</div>
            ) : (
              <div className="space-y-3">
                {stats.upcomingDeadlines.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                    onClick={() => setLocation(`/projects/${project.id}`)}
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{project.title}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{project.vesselName}</p>
                    </div>
                    <Badge className={`text-xs ${
                      project.daysRemaining <= 7
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : project.daysRemaining <= 14
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    }`}>
                      {project.daysRemaining} days left
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Anchor className="h-5 w-5 text-blue-500" />
              Active Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4 text-slate-500">Loading...</div>
            ) : !stats?.recentProjects?.length ? (
              <div className="text-center py-4 text-slate-500 dark:text-slate-400">No active projects</div>
            ) : (
              <div className="space-y-3">
                {stats.recentProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                    onClick={() => setLocation(`/projects/${project.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{project.title}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{project.vesselName}</p>
                    </div>
                    {/* <div className="text-right ml-4">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{formatCurrency(project.actualCost || "0")}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">of {formatCurrency(project.estimatedBudget || "0")}</p>
                    </div> */}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => setLocation("/projects")}>
          <FolderOpen className="h-5 w-5 text-ocean-600 dark:text-ocean-400" />
          <span className="text-sm">All Projects</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => setLocation("/projects/create")}>
          <Plus className="h-5 w-5 text-ocean-600 dark:text-ocean-400" />
          <span className="text-sm">New Project</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => setLocation("/purchase-requests")}>
          <ClipboardList className="h-5 w-5 text-ocean-600 dark:text-ocean-400" />
          <span className="text-sm">Purchase Requests</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => setLocation("/reimbursements")}>
          <Wallet className="h-5 w-5 text-ocean-600 dark:text-ocean-400" />
          <span className="text-sm">Reimbursements</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => setLocation("/my-payslips")}>
          <FileText className="h-5 w-5 text-ocean-600 dark:text-ocean-400" />
          <span className="text-sm">My Payslips</span>
        </Button>
      </div>
    </div>
  );
}

function EmployeeDashboard() {
  const [, setLocation] = useLocation();

  const { data: stats, isLoading } = useQuery<EmployeeStats>({
    queryKey: ["/api/dashboard/employee-stats"],
  });

  const getReimbursementStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      pending: { label: "Pending", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
      approved: { label: "Approved", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
      rejected: { label: "Rejected", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
      paid: { label: "Paid", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    };
    const c = config[status] || { label: status, className: "bg-slate-100 text-slate-700" };
    return <Badge className={`text-xs ${c.className}`}>{c.label}</Badge>;
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Employee Dashboard</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Your projects and activity overview
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Briefcase className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Active Projects</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {isLoading ? "..." : stats?.activeProjects || 0}
                </p>
              </div>
            </div>
            <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              {isLoading ? "..." : `${stats?.totalProjects || 0} total projects`}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Pending Reimbursements</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {isLoading ? "..." : stats?.pendingReimbursements || 0}
                </p>
              </div>
            </div>
            <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              Awaiting approval
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Approved</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {isLoading ? "..." : stats?.approvedReimbursements || 0}
                </p>
              </div>
            </div>
            <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              Reimbursements approved
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg">
                <DollarSign className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Approved</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {isLoading ? "..." : formatCurrency(stats?.totalReimbursementAmount || 0)}
                </p>
              </div>
            </div>
            <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              Approved amount
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Anchor className="h-5 w-5 text-blue-500" />
              Active Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4 text-slate-500">Loading...</div>
            ) : !stats?.recentProjects?.length ? (
              <div className="text-center py-4 text-slate-500 dark:text-slate-400">No active projects</div>
            ) : (
              <div className="space-y-3">
                {stats.recentProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                    onClick={() => setLocation(`/projects/${project.id}`)}
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{project.title}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{project.vesselName}</p>
                    </div>
                    {project.plannedEndDate && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Due: {new Date(project.plannedEndDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5 text-amber-500" />
              Recent Reimbursements
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4 text-slate-500">Loading...</div>
            ) : !stats?.recentReimbursements?.length ? (
              <div className="text-center py-4 text-slate-500 dark:text-slate-400">No reimbursements submitted</div>
            ) : (
              <div className="space-y-3">
                {stats.recentReimbursements.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{r.description}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(r.submissionTimestamp).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{formatCurrency(r.amount)}</span>
                      {getReimbursementStatusBadge(r.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => setLocation("/projects")}>
          <FolderOpen className="h-5 w-5 text-ocean-600 dark:text-ocean-400" />
          <span className="text-sm">View Projects</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => setLocation("/reimbursements")}>
          <Wallet className="h-5 w-5 text-ocean-600 dark:text-ocean-400" />
          <span className="text-sm">Reimbursements</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => setLocation("/my-payslips")}>
          <FileText className="h-5 w-5 text-ocean-600 dark:text-ocean-400" />
          <span className="text-sm">My Payslips</span>
        </Button>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const [, setLocation] = useLocation();

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      in_progress: "status-in-progress",
      completed: "status-completed",
      on_hold: "status-on-hold",
      not_started: "status-not-started",
    };

    const statusLabels = {
      in_progress: "In Progress",
      completed: "Completed",
      on_hold: "On Hold",
      not_started: "Not Started",
    };

    return (
      <Badge className={`status-badge ${statusClasses[status as keyof typeof statusClasses] || 'status-not-started'}`}>
        {statusLabels[status as keyof typeof statusLabels] || status}
      </Badge>
    );
  };

  const activeProjects = projects?.filter(p => p.status === 'in_progress') || [];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-ocean-100 dark:bg-ocean-900/20 rounded-lg">
                <Ship className="h-6 w-6 text-ocean-600 dark:text-ocean-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Active Projects</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {statsLoading ? "..." : stats?.activeProjects || 0}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <span className={`font-medium ${
                  (stats?.activeProjectsChange || 0) >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {statsLoading ? "..." : ((stats?.activeProjectsChange || 0) >= 0 ? `+${stats?.activeProjectsChange || 0}` : (stats?.activeProjectsChange || 0))}
                </span>
                <span className="text-slate-500 dark:text-slate-400 ml-1">
                  {statsLoading ? "..." : "from last month"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Completed This Month</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {statsLoading ? "..." : stats?.completedProjects || 0}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <span className={`font-medium ${
                  (stats?.completedProjectsChange || 0) >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {statsLoading ? "..." : ((stats?.completedProjectsChange || 0) >= 0 ? `+${stats?.completedProjectsChange || 0}` : (stats?.completedProjectsChange || 0))}
                </span>
                <span className="text-slate-500 dark:text-slate-400 ml-1">
                  {statsLoading ? "..." : "vs last month"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setLocation("/inventory")}
        >
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Low Stock Alerts</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {statsLoading ? "..." : stats?.lowStockItems || 0}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <span className={`font-medium ${
                  (stats?.lowStockItems || 0) > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-green-600 dark:text-green-400'
                }`}>
                  {statsLoading ? "..." : stats?.lowStockItemsChangeLabel}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-marine-100 dark:bg-marine-900/20 rounded-lg">
                <DollarSign className="h-6 w-6 text-marine-600 dark:text-marine-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Revenue This Month</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {statsLoading ? "..." : formatCurrency(stats?.monthlyRevenue || 0)}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <span className={`font-medium ${
                  (stats?.monthlyRevenuePercentageChange || 0) >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {statsLoading ? "..." : `${(stats?.monthlyRevenuePercentageChange || 0) >= 0 ? '+' : ''}${stats?.monthlyRevenuePercentageChange || 0}%`}
                </span>
                <span className="text-slate-500 dark:text-slate-400 ml-1">
                  {statsLoading ? "..." : "from last month"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Active Projects</CardTitle>
            <div className="flex items-center space-x-3">
              <Button size="sm" onClick={() => setLocation("/projects/create")}>
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {projectsLoading ? (
            <div className="text-center py-8">
              <p className="text-slate-500 dark:text-slate-400">Loading projects...</p>
            </div>
          ) : activeProjects.length === 0 ? (
            <div className="text-center py-8">
              <Ship className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400">No active projects found</p>
              <Button className="mt-4" onClick={() => setLocation("/projects/create")}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Project
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Project</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Vessel</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">End Date</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Budget</th>
                  </tr>
                </thead>
                <tbody>
                  {activeProjects.map((project) => (
                    <tr 
                      key={project.id} 
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                      onClick={() => setLocation(`/projects/${project.id}`)}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center">
                          {project.vesselImage && (
                            <img
                              src={project.vesselImage}
                              alt={project.vesselName || 'Vessel'}
                              className="h-10 w-10 rounded-full object-cover mr-3"
                            />
                          )}
                          <div>
                            <div className="font-medium text-slate-900 dark:text-slate-100">{project.title}</div>
                            <div className="text-sm text-slate-500 dark:text-slate-400">Project #{project.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-slate-900 dark:text-slate-100">{project.vesselName || "N/A"}</td>
                      <td className="py-4 px-4">{getStatusBadge(project.status)}</td>
                      <td className="py-4 px-4 text-slate-900 dark:text-slate-100">
                        {project.plannedEndDate
                          ? new Date(project.plannedEndDate).toLocaleDateString()
                          : "N/A"
                        }
                      </td>
                      <td className="py-4 px-4 text-slate-900 dark:text-slate-100">
                        {project.estimatedBudget ? formatCurrency(project.estimatedBudget) : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, setLocation]);

  if (!isAuthenticated) {
    return null;
  }

  if (user?.role === "finance") {
    return <FinanceDashboard />;
  }

  if (user?.role === "project_manager") {
    return <ProjectManagerDashboard />;
  }

  if (user?.role === "employee") {
    return <EmployeeDashboard />;
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {user?.role === "customer" ? "Customer Portal" : "Administrator Dashboard"}
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Monitor your marine projects and operations at a glance
        </p>
      </div>
      <AdminDashboard />
    </div>
  );
}
