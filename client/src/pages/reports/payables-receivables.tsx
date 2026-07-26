import { formatDisplayDate } from "@/lib/utils";

import React, { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { 
  Calendar, 
  Filter, 
  Download, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  ArrowLeft,
  DollarSign
} from "lucide-react";

interface GeneralLedgerEntry {
  id: number;
  entryType: string;
  referenceType: string;
  referenceId: number | null;
  accountName: string;
  description: string;
  debitAmount: string;
  creditAmount: string;
  entityId: number | null;
  entityName: string | null;
  projectId: number | null;
  projectTitle: string | null;
  invoiceNumber: string | null;
  transactionDate: string;
  dueDate: string | null;
  status: string;
  createdAt: string;
  notes: string | null;
}

interface Customer {
  id: number;
  name: string;
}

interface Supplier {
  id: number;
  name: string;
}

interface Project {
  id: number;
  title: string;
}

interface CompanyInfo {
  id: number;
  name: string;
  financialYearStartDay: number;
  financialYearStartMonth: number;
  financialYearEndDay: number;
  financialYearEndMonth: number;
}

// What a customer owes is the balance of the Accounts Receivable control
// account, and what we owe suppliers is the balance of Accounts Payable. Only
// those two: matching account names by substring pulled in six further accounts
// on the payable side alone (VAT/GST Payable, Salary Payable, Income Tax
// Payable, Employee Benefits Payable, Service Tax Payable, Supplier Payables).
// None carries a `payable` entry today, so the old figure was right by luck
// rather than by construction — the first payroll or tax posting tagged
// `payable` would have been absorbed silently into "supplier payables".
const RECEIVABLE_CONTROL_ACCOUNT = "Accounts Receivable";
const PAYABLE_CONTROL_ACCOUNT = "Accounts Payable";

// A control account balance is the net of EVERY row posted to it, so the whole
// set has to be fetched. This endpoint paginates at 20 by default, which made
// the summary the net of whichever 20 rows were most recent — on a day whose
// latest entries were all credit notes that came to a negative figure, and the
// Math.max floors then reported Current and Overdue as 0.00.
const LEDGER_PAGE_SIZE = "100000";

export default function PayablesReceivablesReport() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [showFilters, setShowFilters] = useState(false);

  // Fetch company info for financial year settings
  const { data: companyInfo } = useQuery<CompanyInfo>({
    queryKey: ["/api/company"],
    enabled: isAuthenticated,
  });

  // Calculate financial year dates based on company settings
  const getFYDates = (fyStartMonth: number, fyStartDay: number, fyEndMonth: number, fyEndDay: number) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-indexed
    const currentDay = now.getDate();
    
    // Determine if we're in the current FY or if it started last year
    let fyStartYear = currentYear;
    if (currentMonth < fyStartMonth || (currentMonth === fyStartMonth && currentDay < fyStartDay)) {
      fyStartYear = currentYear - 1;
    }
    
    // Calculate end year
    let fyEndYear = fyStartYear;
    if (fyEndMonth < fyStartMonth) {
      fyEndYear = fyStartYear + 1;
    }
    
    return {
      startDate: `${fyStartYear}-${String(fyStartMonth).padStart(2, '0')}-${String(fyStartDay).padStart(2, '0')}`,
      endDate: `${fyEndYear}-${String(fyEndMonth).padStart(2, '0')}-${String(fyEndDay).padStart(2, '0')}`
    };
  };

  // Get FY dates from company settings or use defaults
  const getInitialFYDates = () => {
    const fyStartMonth = companyInfo?.financialYearStartMonth || 1;
    const fyStartDay = companyInfo?.financialYearStartDay || 1;
    const fyEndMonth = companyInfo?.financialYearEndMonth || 12;
    const fyEndDay = companyInfo?.financialYearEndDay || 31;
    return getFYDates(fyStartMonth, fyStartDay, fyEndMonth, fyEndDay);
  };

  const [filters, setFilters] = useState({
    period: "current_fy" as string,
    startDate: "",
    endDate: "",
    entityId: undefined as number | undefined,
    projectId: undefined as number | undefined,
    entryType: "" as "receivable" | "payable" | "",
  });

  // Update dates when company info loads or period changes
  React.useEffect(() => {
    const fyStartMonth = companyInfo?.financialYearStartMonth || 1;
    const fyStartDay = companyInfo?.financialYearStartDay || 1;
    const fyEndMonth = companyInfo?.financialYearEndMonth || 12;
    const fyEndDay = companyInfo?.financialYearEndDay || 31;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    
    let startDate = "";
    let endDate = "";
    
    switch (filters.period) {
      case "current_fy": {
        const fyDates = getFYDates(fyStartMonth, fyStartDay, fyEndMonth, fyEndDay);
        startDate = fyDates.startDate;
        endDate = fyDates.endDate;
        break;
      }
      case "previous_fy": {
        const currentFY = getFYDates(fyStartMonth, fyStartDay, fyEndMonth, fyEndDay);
        const prevFyStartYear = parseInt(currentFY.startDate.substring(0, 4)) - 1;
        const prevFyEndYear = parseInt(currentFY.endDate.substring(0, 4)) - 1;
        startDate = `${prevFyStartYear}-${String(fyStartMonth).padStart(2, '0')}-${String(fyStartDay).padStart(2, '0')}`;
        endDate = `${prevFyEndYear}-${String(fyEndMonth).padStart(2, '0')}-${String(fyEndDay).padStart(2, '0')}`;
        break;
      }
      case "current_month": {
        startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
        const lastDay = new Date(currentYear, currentMonth, 0).getDate();
        endDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${lastDay}`;
        break;
      }
      case "current_quarter": {
        const quarterStart = Math.floor((currentMonth - 1) / 3) * 3 + 1;
        const quarterEnd = quarterStart + 2;
        startDate = `${currentYear}-${String(quarterStart).padStart(2, '0')}-01`;
        const lastDayOfQuarter = new Date(currentYear, quarterEnd, 0).getDate();
        endDate = `${currentYear}-${String(quarterEnd).padStart(2, '0')}-${lastDayOfQuarter}`;
        break;
      }
      case "custom":
        // Keep existing custom dates
        return;
      default:
        break;
    }
    
    if (filters.period !== "custom" && startDate && endDate) {
      setFilters(prev => ({ ...prev, startDate, endDate }));
    }
  }, [filters.period, companyInfo]);

  // Check if any filters are active
  const hasActiveFilters = filters.period !== "current_fy" || 
    filters.projectId !== undefined || filters.entryType !== "";

  React.useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    } else if (user?.role !== "admin" && user?.role !== "finance") {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user, setLocation]);

  const { data: receivableResponse, isLoading: receivablesLoading } = useQuery<{ data: GeneralLedgerEntry[] }>({
    queryKey: ["/api/general-ledger", "receivable", filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        entryType: "receivable",
        accountName: RECEIVABLE_CONTROL_ACCOUNT,
        limit: LEDGER_PAGE_SIZE,
      });
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.entityId) params.append("entityId", filters.entityId.toString());
      if (filters.projectId) params.append("projectId", filters.projectId.toString());

      const response = await apiRequest(`/api/general-ledger?${params}`);
      if (!response.ok) throw new Error("Failed to fetch receivable entries");
      return response.json();
    },
    enabled: isAuthenticated && (!filters.entryType || filters.entryType === "receivable"),
  });

  const receivableEntries = Array.isArray(receivableResponse?.data) ? receivableResponse.data : [];

  const { data: payableResponse, isLoading: payablesLoading } = useQuery<{ data: GeneralLedgerEntry[] }>({
    queryKey: ["/api/general-ledger", "payable", filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        entryType: "payable",
        accountName: PAYABLE_CONTROL_ACCOUNT,
        limit: LEDGER_PAGE_SIZE,
      });
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.entityId) params.append("entityId", filters.entityId.toString());
      if (filters.projectId) params.append("projectId", filters.projectId.toString());

      const response = await apiRequest(`/api/general-ledger?${params}`);
      if (!response.ok) throw new Error("Failed to fetch payable entries");
      return response.json();
    },
    enabled: isAuthenticated && (!filters.entryType || filters.entryType === "payable"),
  });

  const payableEntries = Array.isArray(payableResponse?.data) ? payableResponse.data : [];

  const { data: customersResponse } = useQuery<{ data: Customer[] }>({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const response = await fetch("/api/customers?limit=1000");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const customers = Array.isArray(customersResponse?.data) ? customersResponse.data : [];

  const { data: suppliersResponse } = useQuery<{ data: Supplier[] }>({
    queryKey: ["/api/suppliers"],
    queryFn: async () => {
      const response = await fetch("/api/suppliers?limit=1000");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const suppliers = Array.isArray(suppliersResponse?.data) ? suppliersResponse.data : [];

  const { data: projectsResponse } = useQuery<{ data: Project[] }>({
    queryKey: ["/api/projects"],
    enabled: isAuthenticated,
  });

  const projects = Array.isArray(projectsResponse?.data) ? projectsResponse.data : [];

  // Belt and braces: the server already narrows to the control account with a
  // LIKE, so this only guards against a future account whose name contains it.
  const filteredReceivableEntries = receivableEntries.filter(
    entry => entry.accountName === RECEIVABLE_CONTROL_ACCOUNT
  );

  const filteredPayableEntries = payableEntries.filter(
    entry => entry.accountName === PAYABLE_CONTROL_ACCOUNT
  );

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "AED",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parseFloat(amount?.toString() || "0"));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Paid</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "overdue":
        return <Badge variant="destructive">Overdue</Badge>;
      case "cancelled":
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Calculate summary statistics using proper GL accounting logic
  // For receivables: Debits = invoices issued, Credits = payments received
  // Outstanding = Debits - Credits, Overdue = past due date with outstanding balance
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // A control account balance is the plain net of every row posted to it. A
  // reversal is an ordinary entry that happens to carry `status: 'cancelled'`,
  // and its whole purpose is to cancel the original out — so both sides must be
  // counted. Excluding cancelled rows dropped the reversal but kept whatever it
  // was reversing, leaving the balance wrong by the value of the reversal; the
  // old `totalDebits - cancelledCredits` adjustment only masked that when every
  // cancelled row happened to sit on one side.
  const sumDebits = (entries: GeneralLedgerEntry[]) =>
    entries.reduce((sum, entry) => sum + parseFloat(entry.debitAmount || "0"), 0);
  const sumCredits = (entries: GeneralLedgerEntry[]) =>
    entries.reduce((sum, entry) => sum + parseFloat(entry.creditAmount || "0"), 0);

  // What a row moved the balance by, in the account's normal direction:
  // receivables are debit-normal, payables credit-normal. Showing only the
  // debit (or only the credit) printed AED 0.00 against every credit note and
  // every payment, because those sit on the other side — so a row that plainly
  // did move the balance looked like it had done nothing. Signed, these add up
  // to the Outstanding figure above the table.
  const rowMovement = (
    entry: GeneralLedgerEntry,
    normal: "debit" | "credit",
  ) => {
    const debit = parseFloat(entry.debitAmount || "0");
    const credit = parseFloat(entry.creditAmount || "0");
    return normal === "debit" ? debit - credit : credit - debit;
  };

  const receivableSummary = (() => {
    const totalDebits = sumDebits(filteredReceivableEntries);
    const totalCredits = sumCredits(filteredReceivableEntries);

    // Receivables are a debit balance: invoices raised less amounts settled.
    const totalOutstanding = totalDebits - totalCredits;

    // Overdue: invoice debits past their due date. This is an ageing indicator
    // on the gross debits, not a share of the net balance, so it is capped at
    // the outstanding total rather than allowed to exceed it.
    const overdueDebits = filteredReceivableEntries
      .filter(e => {
        if (!e.dueDate) return false;
        const dueDate = new Date(e.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate < today && parseFloat(e.debitAmount || "0") > 0;
      })
      .reduce((sum, entry) => sum + parseFloat(entry.debitAmount || "0"), 0);
    const overdueAmount = Math.max(0, Math.min(overdueDebits, totalOutstanding));

    const currentAmount = Math.max(0, totalOutstanding - overdueAmount);

    return {
      total: totalOutstanding,
      current: currentAmount,
      overdue: overdueAmount,
      collected: totalCredits,
      count: filteredReceivableEntries.length,
    };
  })();

  const payableSummary = (() => {
    const totalDebits = sumDebits(filteredPayableEntries);
    const totalCredits = sumCredits(filteredPayableEntries);

    // Payables are a credit balance: bills received less amounts paid.
    const totalOutstanding = totalCredits - totalDebits;

    const overdueCredits = filteredPayableEntries
      .filter(e => {
        if (!e.dueDate) return false;
        const dueDate = new Date(e.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate < today && parseFloat(e.creditAmount || "0") > 0;
      })
      .reduce((sum, entry) => sum + parseFloat(entry.creditAmount || "0"), 0);
    const overdueAmount = Math.max(0, Math.min(overdueCredits, totalOutstanding));

    const currentAmount = Math.max(0, totalOutstanding - overdueAmount);

    return {
      total: totalOutstanding,
      current: currentAmount,
      overdue: overdueAmount,
      paid: totalDebits,
      count: filteredPayableEntries.length,
    };
  })();

  const exportToCSV = (data: GeneralLedgerEntry[], type: "receivables" | "payables") => {
    const headers = [
      "Date",
      "Description",
      type === "receivables" ? "Customer" : "Supplier",
      "Project",
      "Invoice #",
      "Amount",
      "Due Date",
      "Status",
      "Notes"
    ];

    const csvData = data.map(entry => [
      formatDisplayDate(entry.transactionDate),
      entry.description,
      entry.entityName || "-",
      entry.projectTitle || "-",
      entry.invoiceNumber || "-",
      rowMovement(entry, type === "receivables" ? "debit" : "credit").toFixed(2),
      entry.dueDate ? formatDisplayDate(entry.dueDate) : "-",
      entry.status,
      entry.notes || "-"
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/reports")} className="mt-1">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Payables & Receivables Report</h1>
            <p className="text-sm text-muted-foreground">Analysis of amounts owed and due</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button 
            variant={showFilters ? "default" : "outline"} 
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-2" />
            {showFilters ? "Hide Filters" : "Show Filters"}
            {hasActiveFilters && <span className="ml-2 bg-primary-foreground text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs">!</span>}
          </Button>
        </div>
      </div>

      {/* Inline Filters */}
      {showFilters && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              {/* Financial Year / Period */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Period</Label>
                <Select
                  value={filters.period}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, period: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current_fy">Current Financial Year</SelectItem>
                    <SelectItem value="previous_fy">Previous Financial Year</SelectItem>
                    <SelectItem value="current_month">Current Month</SelectItem>
                    <SelectItem value="current_quarter">Current Quarter</SelectItem>
                    <SelectItem value="custom">Custom Date Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range - only show for custom period */}
              {filters.period === "custom" && (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">From</Label>
                    <Input
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">To</Label>
                    <Input
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>
                </>
              )}

              {/* Report Type */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Report Type</Label>
                <Select
                  value={filters.entryType || "all"}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, entryType: value === "all" ? "" : value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="receivable">Receivables Only</SelectItem>
                    <SelectItem value="payable">Payables Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Project */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Project</Label>
                <Select
                  value={filters.projectId?.toString() || "all"}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, projectId: value === "all" ? undefined : parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex justify-between items-center mt-4 pt-3 border-t">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {filters.startDate && filters.endDate 
                    ? `${formatDisplayDate(filters.startDate)} - ${formatDisplayDate(filters.endDate)}`
                    : "All dates"}
                </span>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  const fyDates = getInitialFYDates();
                  setFilters({ 
                    period: "current_fy",
                    startDate: fyDates.startDate, 
                    endDate: fyDates.endDate, 
                    entityId: undefined, 
                    projectId: undefined,
                    entryType: ""
                  });
                }}
                className="text-muted-foreground"
              >
                Reset Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Receivables</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(receivableSummary.total)}</div>
            <p className="text-xs text-muted-foreground">{receivableSummary.count} entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payables</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(payableSummary.total)}</div>
            <p className="text-xs text-muted-foreground">{payableSummary.count} entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Position</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${receivableSummary.total - payableSummary.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(receivableSummary.total - payableSummary.total)}
            </div>
            <p className="text-xs text-muted-foreground">
              {receivableSummary.total - payableSummary.total >= 0 ? 'Positive' : 'Negative'} position
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Items</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(receivableSummary.overdue + payableSummary.overdue)}
            </div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Reports */}
      <Tabs defaultValue="receivables" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="receivables">Accounts Receivable</TabsTrigger>
          <TabsTrigger value="payables">Accounts Payable</TabsTrigger>
        </TabsList>

        <TabsContent value="receivables" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Accounts Receivable Details</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Outstanding amounts from customers
                </p>
              </div>
              <Button 
                onClick={() => exportToCSV(filteredReceivableEntries, "receivables")}
                variant="outline"
                size="sm"
                disabled={filteredReceivableEntries.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {/* Summary Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Current</p>
                  <p className="text-lg font-semibold text-blue-600">{formatCurrency(receivableSummary.current)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Overdue</p>
                  <p className="text-lg font-semibold text-red-600">{formatCurrency(receivableSummary.overdue)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Collected</p>
                  <p className="text-lg font-semibold text-green-600">{formatCurrency(receivableSummary.collected)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Outstanding</p>
                  <p className="text-lg font-semibold">{formatCurrency(receivableSummary.total)}</p>
                </div>
              </div>

              {receivablesLoading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : filteredReceivableEntries.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No receivable entries found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Date</th>
                        <th className="text-left p-2">Account</th>
                        <th className="text-left p-2">Description</th>
                        <th className="text-left p-2">Customer</th>
                        <th className="text-left p-2">Project</th>
                        <th className="text-left p-2">Invoice #</th>
                        <th className="text-right p-2">Amount</th>
                        <th className="text-left p-2">Due Date</th>
                        <th className="text-left p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReceivableEntries.map((entry) => (
                        <tr key={entry.id} className="border-b hover:bg-gray-50">
                          <td className="p-2">{formatDisplayDate(entry.transactionDate)}</td>
                          <td className="p-2 text-xs text-muted-foreground">{entry.accountName}</td>
                          <td className="p-2">{entry.description}</td>
                          <td className="p-2">{entry.entityName || "-"}</td>
                          <td className="p-2">{entry.projectTitle || "-"}</td>
                          <td className="p-2">{entry.invoiceNumber || "-"}</td>
                          <td className="p-2 text-right font-medium">{formatCurrency(rowMovement(entry, "debit"))}</td>
                          <td className="p-2">{entry.dueDate ? formatDisplayDate(entry.dueDate) : "-"}</td>
                          <td className="p-2">{getStatusBadge(entry.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payables" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Accounts Payable Details</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Outstanding amounts to suppliers
                </p>
              </div>
              <Button 
                onClick={() => exportToCSV(filteredPayableEntries, "payables")}
                variant="outline"
                size="sm"
                disabled={filteredPayableEntries.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {/* Summary Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Current</p>
                  <p className="text-lg font-semibold text-blue-600">{formatCurrency(payableSummary.current)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Overdue</p>
                  <p className="text-lg font-semibold text-red-600">{formatCurrency(payableSummary.overdue)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Paid</p>
                  <p className="text-lg font-semibold text-green-600">{formatCurrency(payableSummary.paid)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Outstanding</p>
                  <p className="text-lg font-semibold">{formatCurrency(payableSummary.total)}</p>
                </div>
              </div>

              {payablesLoading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : filteredPayableEntries.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No payable entries found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Date</th>
                        <th className="text-left p-2">Account</th>
                        <th className="text-left p-2">Description</th>
                        <th className="text-left p-2">Supplier</th>
                        <th className="text-left p-2">Project</th>
                        <th className="text-left p-2">Invoice #</th>
                        <th className="text-right p-2">Amount</th>
                        <th className="text-left p-2">Due Date</th>
                        <th className="text-left p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPayableEntries.map((entry) => (
                        <tr key={entry.id} className="border-b hover:bg-gray-50">
                          <td className="p-2">{formatDisplayDate(entry.transactionDate)}</td>
                          <td className="p-2 text-xs text-muted-foreground">{entry.accountName}</td>
                          <td className="p-2">{entry.description}</td>
                          <td className="p-2">{entry.entityName || "-"}</td>
                          <td className="p-2">{entry.projectTitle || "-"}</td>
                          <td className="p-2">{entry.invoiceNumber || "-"}</td>
                          <td className="p-2 text-right font-medium">{formatCurrency(rowMovement(entry, "credit"))}</td>
                          <td className="p-2">{entry.dueDate ? formatDisplayDate(entry.dueDate) : "-"}</td>
                          <td className="p-2">{getStatusBadge(entry.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
