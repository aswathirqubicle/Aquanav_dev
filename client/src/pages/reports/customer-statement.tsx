import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Autocomplete } from "@/components/ui/autocomplete";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowLeft,
  Download,
  FileText,
  Filter,
  Loader2,
  AlertTriangle,
} from "lucide-react";

interface Customer {
  id: number;
  name: string;
  creditLimit?: string | null;
}

interface StatementTransaction {
  id: string;
  date: string;
  type: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  customerId?: number;
  customerName?: string;
}

interface StatementPagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

interface StatementTotals {
  debit: number;
  credit: number;
  balance: number;
}

export default function CustomerStatementPage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();

  const [showFilters, setShowFilters] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [transactions, setTransactions] = useState<StatementTransaction[]>([]);
  const [pagination, setPagination] = useState<StatementPagination | null>(null);
  const [totals, setTotals] = useState<StatementTotals | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [creditLimitAlert, setCreditLimitAlert] = useState<{
    show: boolean;
    customerName: string;
    balance: number;
    creditLimit: number;
  } | null>(null);

  const { data: customersResponse } = useQuery<{ data: Customer[] }>({
    queryKey: ["/api/customers?limit=1000"],
    enabled: isAuthenticated,
  });
  const customers = customersResponse?.data || [];

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    } else if (user?.role !== "admin" && user?.role !== "finance") {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user, setLocation]);

  const hasActiveFilters = selectedCustomer !== "all" || dateFrom || dateTo;

  const fetchStatementData = async (
    page: number,
    filters?: {
      customer?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", pageSize.toString());

      const effectiveCustomer = filters?.customer ?? selectedCustomer;
      const effectiveDateFrom = filters?.dateFrom ?? dateFrom;
      const effectiveDateTo = filters?.dateTo ?? dateTo;

      if (effectiveCustomer && effectiveCustomer !== "all") {
        params.set("customerId", effectiveCustomer);
      }
      if (effectiveDateFrom) params.set("dateFrom", effectiveDateFrom);
      if (effectiveDateTo) params.set("dateTo", effectiveDateTo);

      const response = await fetch(`/api/reports/customer-statement?${params.toString()}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch statement data");
      }

      const result = await response.json();
      setPagination(result.pagination);
      setTotals(result.totals);

      let runningBalance = 0;
      const transactionData = result.data.map((t: any) => {
        runningBalance += t.debit - t.credit;
        return {
          id: t.id,
          date: t.date,
          type: t.type === "invoice" ? "Invoice" : "Payment",
          reference: t.reference,
          description: t.customerName || t.description,
          debit: t.debit,
          credit: t.credit,
          balance: runningBalance,
          customerId: t.customerId,
          customerName: t.customerName,
        };
      });

      setTransactions(transactionData);

      // Check credit limit for single customer filter
      const effectiveCustomerId = filters?.customer ?? selectedCustomer;
      if (effectiveCustomerId && effectiveCustomerId !== "all") {
        const customer = customers.find(c => c.id.toString() === effectiveCustomerId);
        if (customer?.creditLimit) {
          const creditLimitNum = parseFloat(customer.creditLimit);
          const balance = result.totals?.balance || 0;
          if (creditLimitNum > 0 && balance > creditLimitNum) {
            setCreditLimitAlert({
              show: true,
              customerName: customer.name,
              balance: balance,
              creditLimit: creditLimitNum,
            });
          } else {
            setCreditLimitAlert(null);
          }
        } else {
          setCreditLimitAlert(null);
        }
      } else {
        setCreditLimitAlert(null);
      }
    } catch (error) {
      console.error("Error fetching statement:", error);
      setTransactions([]);
      setPagination(null);
      setTotals(null);
      setCreditLimitAlert(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchStatementData(currentPage);
    }
  }, [isAuthenticated, currentPage]);

  const clearFilters = () => {
    setSelectedCustomer("all");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
    fetchStatementData(1, { customer: "all", dateFrom: "", dateTo: "" });
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: "AED",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num || 0);
  };

  const exportToCSV = () => {
    if (!transactions.length) return;

    let csvContent = "Customer Statement of Account\n";
    csvContent += `Generated: ${new Date().toLocaleDateString()}\n\n`;
    csvContent += "Date,Type,Reference,Description,Debit,Credit,Balance\n";

    transactions.forEach((t) => {
      csvContent += `${new Date(t.date).toLocaleDateString()},${t.type},${t.reference},"${t.description}",${Number(t.debit).toFixed(2)},${Number(t.credit).toFixed(2)},${Number(t.balance).toFixed(2)}\n`;
    });

    if (totals) {
      csvContent += `\nTotals,,,,${Number(totals.debit).toFixed(2)},${Number(totals.credit).toFixed(2)},${Number(totals.balance).toFixed(2)}\n`;
    }

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customer-statement-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
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
            <h1 className="text-xl sm:text-2xl font-bold">Customer Statement of Account</h1>
            <p className="text-sm text-muted-foreground">View customer invoices and payment transactions</p>
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
          <Button onClick={exportToCSV} variant="outline" size="sm" disabled={!transactions.length}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Inline Filters */}
      {showFilters && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="w-full sm:w-[220px]">
                <Label className="text-xs text-muted-foreground mb-1.5 block">Customer</Label>
                <Autocomplete
                  options={[
                    { value: "all", label: "All Customers" },
                    ...customers.map((customer) => ({
                      value: customer.id.toString(),
                      label: customer.name,
                    })),
                  ]}
                  value={selectedCustomer}
                  onValueChange={(v) => {
                    const newValue = v || "all";
                    setSelectedCustomer(newValue);
                    setCurrentPage(1);
                    fetchStatementData(1, { customer: newValue, dateFrom, dateTo });
                  }}
                  placeholder="Type to search..."
                />
              </div>
              <div className="w-full sm:w-auto">
                <Label className="text-xs text-muted-foreground mb-1.5 block">From</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setCurrentPage(1);
                    fetchStatementData(1, { customer: selectedCustomer, dateFrom: e.target.value, dateTo });
                  }}
                  className="w-full sm:w-[150px]"
                />
              </div>
              <div className="w-full sm:w-auto">
                <Label className="text-xs text-muted-foreground mb-1.5 block">To</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setCurrentPage(1);
                    fetchStatementData(1, { customer: selectedCustomer, dateFrom, dateTo: e.target.value });
                  }}
                  className="w-full sm:w-[150px]"
                />
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground"
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Credit Limit Alert */}
      {creditLimitAlert?.show && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Credit Limit Exceeded</AlertTitle>
          <AlertDescription>
            {creditLimitAlert.customerName} has exceeded their credit limit. 
            Outstanding balance: AED {creditLimitAlert.balance.toFixed(2)} | 
            Credit limit: AED {creditLimitAlert.creditLimit.toFixed(2)}
          </AlertDescription>
        </Alert>
      )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-3">
              <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                Transactions
              </div>
              <div className="text-lg font-bold text-blue-900 dark:text-blue-100">
                {pagination?.totalCount || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <CardContent className="p-3">
              <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                Total Debit
              </div>
              <div className="text-lg font-bold text-green-900 dark:text-green-100">
                {formatCurrency(totals?.debit || 0)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
            <CardContent className="p-3">
              <div className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                Total Credit
              </div>
              <div className="text-lg font-bold text-purple-900 dark:text-purple-100">
                {formatCurrency(totals?.credit || 0)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
            <CardContent className="p-3">
              <div className="text-xs text-red-600 dark:text-red-400 font-medium">
                Balance
              </div>
              <div className="text-lg font-bold text-red-900 dark:text-red-100">
                {formatCurrency(totals?.balance || 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Transaction Details
              </CardTitle>
              <span className="text-xs text-slate-500">
                {transactions.length} transactions on this page
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs whitespace-nowrap">Date</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Reference</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Description</TableHead>
                    <TableHead className="text-xs text-right">Debit</TableHead>
                    <TableHead className="text-xs text-right">Credit</TableHead>
                    <TableHead className="text-xs text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          <span className="text-sm text-slate-500">Loading transactions...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-slate-500 py-8 text-sm">
                        No transactions found for the selected filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((row) => (
                      <TableRow
                        key={row.id}
                        className={row.type === "Payment" ? "bg-green-50/50 dark:bg-green-900/10" : ""}
                      >
                        <TableCell className="text-xs whitespace-nowrap py-2">
                          {new Date(row.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-xs py-2">
                          <Badge
                            variant={row.type === "Invoice" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {row.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-medium py-2">{row.reference}</TableCell>
                        <TableCell className="text-xs hidden sm:table-cell max-w-[150px] truncate py-2">
                          {row.description}
                        </TableCell>
                        <TableCell className="text-xs text-right py-2">
                          {row.debit > 0 ? formatCurrency(row.debit) : "-"}
                        </TableCell>
                        <TableCell className="text-xs text-right py-2">
                          {row.credit > 0 ? formatCurrency(row.credit) : "-"}
                        </TableCell>
                        <TableCell className="text-xs text-right font-medium py-2">
                          {formatCurrency(row.balance)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between p-3 border-t bg-slate-50 dark:bg-slate-800">
                <div className="text-xs text-slate-500">
                  Showing {(currentPage - 1) * pageSize + 1} -{" "}
                  {Math.min(currentPage * pageSize, pagination.totalCount)} of{" "}
                  {pagination.totalCount}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCurrentPage(1);
                      fetchStatementData(1);
                    }}
                    disabled={currentPage === 1 || isLoading}
                    className="h-7 px-2 text-xs"
                  >
                    First
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newPage = Math.max(1, currentPage - 1);
                      setCurrentPage(newPage);
                      fetchStatementData(newPage);
                    }}
                    disabled={currentPage === 1 || isLoading}
                    className="h-7 px-2 text-xs"
                  >
                    Prev
                  </Button>
                  <span className="px-2 text-xs text-slate-600 dark:text-slate-400">
                    {isLoading ? "..." : `${currentPage} / ${pagination.totalPages}`}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newPage = Math.min(pagination.totalPages, currentPage + 1);
                      setCurrentPage(newPage);
                      fetchStatementData(newPage);
                    }}
                    disabled={currentPage >= pagination.totalPages || isLoading}
                    className="h-7 px-2 text-xs"
                  >
                    Next
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCurrentPage(pagination.totalPages);
                      fetchStatementData(pagination.totalPages);
                    }}
                    disabled={currentPage >= pagination.totalPages || isLoading}
                    className="h-7 px-2 text-xs"
                  >
                    Last
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
