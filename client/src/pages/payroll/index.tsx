import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Eye, Check, X, Plus, Trash2, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import {
  Users,
  DollarSign,
  CheckCircle,
  Clock,
  FileText,
  Calendar,
} from "lucide-react";
import { Employee } from "@shared/schema";

interface PayrollEntry {
  id: number;
  employeeId: number;
  month: number;
  year: number;
  workingDays: number;
  basicSalary: string;
  totalAdditions?: string;
  totalDeductions?: string;
  totalAmount: string;
  status: string;
  generatedDate: string;
  employee?: Employee;
}

interface PayrollAddition {
  id: number;
  payrollEntryId: number;
  description: string;
  amount: string;
  note?: string;
}

interface PayrollDeduction {
  id: number;
  payrollEntryId: number;
  description: string;
  amount: string;
  note?: string;
}

export default function PayrollIndex() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user, loading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false);
  const [summaryMonth, setSummaryMonth] = useState(new Date().getMonth() + 1);
  const [summaryYear, setSummaryYear] = useState(new Date().getFullYear());
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [clearMonth, setClearMonth] = useState(new Date().getMonth() + 1);
  const [clearYear, setClearYear] = useState(new Date().getFullYear());

  useEffect(() => {
    // Only redirect after authentication loading is complete
    if (!loading) {
      if (!isAuthenticated) {
        setLocation("/login");
      } else if (user?.role !== "admin" && user?.role !== "finance") {
        setLocation("/dashboard");
      }
    }
  }, [isAuthenticated, user, loading, setLocation]);

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    enabled: isAuthenticated,
  });

  const { data: payrollEntries = [] } = useQuery<PayrollEntry[]>({
    queryKey: ["/api/payroll", { month: selectedMonth, year: selectedYear }],
    enabled: isAuthenticated,
  });

  // Get calendar days for the selected month
  const getCalendarDaysInMonth = (month: number, year: number): number => {
    return new Date(year, month, 0).getDate();
  };

  const generatePayrollMutation = useMutation({
    mutationFn: async (data: { month: number; year: number }) => {
      console.log("Generating payroll for:", data);
      const response = await apiRequest("/api/payroll/generate", {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Payroll Generated",
        description: `Payroll for ${getMonthName(selectedMonth)} ${selectedYear} has been generated successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      console.error("Payroll generation error:", error);
      toast({
        title: "Payroll Generation Failed",
        description: error.message || "An unexpected error occurred while generating payroll",
        variant: "destructive",
      });
    },
  });

  const clearPayrollMutation = useMutation({
    mutationFn: async (data: { month: number; year: number }) => {
      const response = await apiRequest(`/api/payroll/clear-period?month=${data.month}&year=${data.year}`, {
        method: "DELETE",
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Payroll Cleared",
        description: `Payroll entries for ${getMonthName(variables.month)} ${variables.year} have been cleared successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      setIsClearDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to clear payroll entries",
        variant: "destructive",
      });
    },
  });

  const approvePayrollMutation = useMutation({
    mutationFn: async (entryId: number) => {
      const response = await apiRequest(`/api/payroll/${entryId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "approved" }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Payroll Approved",
        description: "Payroll entry has been approved successfully.",
      });
      // Invalidate both general payroll queries and specific month/year queries
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/payroll", { month: selectedMonth, year: selectedYear }] 
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve payroll entry",
        variant: "destructive",
      });
    },
  });

  // Show loading state while authentication is being checked
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ocean-600"></div>
      </div>
    );
  }

  // Return null if not authenticated or not authorized (redirect will happen via useEffect)
  if (!isAuthenticated || (user?.role !== "admin" && user?.role !== "finance")) {
    return null;
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: {
        class:
          "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400",
        label: "Draft",
      },
      approved: {
        class:
          "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
        label: "Approved",
      },
      paid: {
        class:
          "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
        label: "Paid",
      },
    };

    const config =
      statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;

    return <Badge className={config.class}>{config.label}</Badge>;
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const generateAllPayslips = async () => {
    if (!enrichedPayrollEntries.length) {
      toast({
        title: "No Data",
        description: "No payroll entries found to generate slips",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create a new window for all payslips
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast({
          title: "Error",
          description: "Please allow popups to generate payslips",
          variant: "destructive",
        });
        return;
      }

      // Generate HTML content for all payslips
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Payroll Slips - ${getMonthName(selectedMonth)} ${selectedYear}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 20px; 
              font-size: 12px;
            }
            .payslip { 
              page-break-after: always; 
              margin-bottom: 40px; 
              border: 1px solid #ddd; 
              padding: 20px;
              min-height: 600px;
            }
            .payslip:last-child { page-break-after: avoid; }
            .header { 
              text-align: center; 
              border-bottom: 2px solid #333; 
              padding-bottom: 10px; 
              margin-bottom: 20px; 
            }
            .company-name { 
              font-size: 18px; 
              font-weight: bold; 
              margin-bottom: 5px; 
            }
            .payslip-title { 
              font-size: 14px; 
              color: #666; 
            }
            .info-grid { 
              display: grid; 
              grid-template-columns: 1fr 1fr; 
              gap: 20px; 
              margin-bottom: 20px; 
            }
            .info-section h3 { 
              font-size: 14px; 
              margin-bottom: 10px; 
              border-bottom: 1px solid #eee; 
              padding-bottom: 5px; 
            }
            .info-row { 
              display: flex; 
              justify-content: space-between; 
              margin-bottom: 5px; 
              font-size: 11px; 
            }
            .info-label { color: #666; }
            .info-value { font-weight: bold; }
            .earnings-section, .deductions-section { 
              margin-bottom: 20px; 
              padding: 15px; 
              border-radius: 5px; 
            }
            .earnings-section { 
              background-color: #f0f9ff; 
              border: 1px solid #bae6fd; 
            }
            .deductions-section { 
              background-color: #fef2f2; 
              border: 1px solid #fecaca; 
            }
            .section-title { 
              font-weight: bold; 
              margin-bottom: 10px; 
              font-size: 13px; 
            }
            .earnings-title { color: #059669; }
            .deductions-title { color: #dc2626; }
            .amount-row { 
              display: flex; 
              justify-content: space-between; 
              margin-bottom: 5px; 
              font-size: 11px; 
            }
            .total-row { 
              border-top: 1px solid #999; 
              padding-top: 5px; 
              font-weight: bold; 
            }
            .net-pay { 
              background-color: #f3f4f6; 
              border: 2px solid #d1d5db; 
              padding: 15px; 
              text-align: center; 
              margin-bottom: 20px; 
            }
            .net-pay-label { 
              font-size: 16px; 
              font-weight: bold; 
              margin-bottom: 5px; 
            }
            .net-pay-amount { 
              font-size: 24px; 
              font-weight: bold; 
              color: #059669; 
            }
            .footer { 
              text-align: center; 
              font-size: 10px; 
              color: #666; 
              border-top: 1px solid #eee; 
              padding-top: 10px; 
            }
            @media print {
              body { margin: 0; padding: 0; }
              .payslip { margin: 0; border: none; }
            }
          </style>
        </head>
        <body>
      `;

      // Fetch additions and deductions for all entries
      const payrollDataPromises = enrichedPayrollEntries.map(async (entry) => {
        try {
          const [additionsRes, deductionsRes] = await Promise.all([
            apiRequest("GET", `/api/payroll/${entry.id}/additions`),
            apiRequest("GET", `/api/payroll/${entry.id}/deductions`),
          ]);
          return {
            entry,
            additions: additionsRes || [],
            deductions: deductionsRes || [],
          };
        } catch (error) {
          console.error(
            `Error fetching data for payroll entry ${entry.id}:`,
            error,
          );
          return {
            entry,
            additions: [],
            deductions: [],
          };
        }
      });

      const payrollData = await Promise.all(payrollDataPromises);

      payrollData.forEach(({ entry, additions, deductions }) => {
        const totalEarnings =
          parseFloat(entry.basicSalary) +
          parseFloat(entry.totalAdditions || "0");
        const totalDeductions = Array.isArray(deductions) 
          ? deductions.reduce((sum, deduction) => sum + parseFloat(deduction.amount), 0)
          : 0;

        htmlContent += `
          <div class="payslip">
            <div class="header">
              <div class="company-name">AquaNav Marine Solutions</div>
              <div class="payslip-title">Payroll Slip</div>
            </div>

            <div class="info-grid">
              <div class="info-section">
                <h3>Employee Information</h3>
                <div class="info-row">
                  <span class="info-label">Name:</span>
                  <span class="info-value">${entry.employee?.firstName || "N/A"} ${entry.employee?.lastName || ""}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Employee Code:</span>
                  <span class="info-value">${entry.employee?.employeeCode || "N/A"}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Position:</span>
                  <span class="info-value">${entry.employee?.position || "N/A"}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Department:</span>
                  <span class="info-value">${entry.employee?.department || "N/A"}</span>
                </div>
              </div>

              <div class="info-section">
                <h3>Pay Period</h3>
                <div class="info-row">
                  <span class="info-label">Month:</span>
                  <span class="info-value">${getMonthName(entry.month)} ${entry.year}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Calendar Days:</span>
                  <span class="info-value">${entry.workingDays}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Generated Date:</span>
                  <span class="info-value">${new Date(entry.generatedDate).toLocaleDateString()}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Status:</span>
                  <span class="info-value" style="text-transform: capitalize">${entry.status}</span>
                </div>
              </div>
            </div>

            <div class="earnings-section">
              <div class="section-title earnings-title">Earnings</div>
              <div class="amount-row">
                <span>Basic Salary</span>
                <span>${formatCurrency(entry.basicSalary)}</span>
              </div>
              ${additions
                .map(
                  (addition) => `
                <div class="amount-row">
                  <span>${addition.description}</span>
                  <span>${formatCurrency(addition.amount)}</span>
                </div>
              `,
                )
                .join("")}
              <div class="amount-row total-row">
                <span>Total Earnings</span>
                <span>${formatCurrency(totalEarnings)}</span>
              </div>
            </div>

            <div class="deductions-section">
              <div class="section-title deductions-title">Deductions</div>
              ${
                deductions.length === 0
                  ? '<div style="text-align: center; color: #666; font-style: italic;">No deductions for this period</div>'
                  : deductions
                      .map(
                        (deduction) => `
                  <div class="amount-row">
                    <span>${deduction.description}</span>
                    <span>${formatCurrency(deduction.amount)}</span>
                  </div>
                `,
                      )
                      .join("") +
                    `
                <div class="amount-row total-row">
                  <span>Total Deductions</span>
                  <span>${formatCurrency(totalDeductions)}</span>
                </div>`
              }
            </div>

            <div class="net-pay">
              <div class="net-pay-label">Net Pay</div>
              <div class="net-pay-amount">${formatCurrency(entry.totalAmount)}</div>
            </div>

            <div class="footer">
              <p>This is a computer-generated payslip and does not require a signature.</p>
              <p>Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
            </div>
          </div>
        `;
      });

      htmlContent += `
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Wait for content to load then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 1000);
      };

      toast({
        title: "Success",
        description: `Generated payslips for ${enrichedPayrollEntries.length} employees`,
      });
    } catch (error) {
      console.error("Error generating payslips:", error);
      toast({
        title: "Error",
        description: "Failed to generate payslips",
        variant: "destructive",
      });
    }
  };

  const getMonthName = (month: number) => {
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
    return months[month - 1];
  };

  const generateMonthlyPayrollSummary = async (month: number = selectedMonth, year: number = selectedYear) => {
    // Fetch payroll entries for the specified month and year
    const summaryPayrollEntries = await queryClient.fetchQuery({
      queryKey: ["/api/payroll", { month, year }],
      queryFn: async () => {
        const response = await apiRequest(`/api/payroll?month=${month}&year=${year}`, {
          method: "GET"
        });
        return response.json();
      },
    });

    const summaryEnrichedEntries = (summaryPayrollEntries || []).map((entry: any) => ({
      ...entry,
      employee: employees?.find((emp: any) => emp.id === entry.employeeId),
    }));

    if (!summaryEnrichedEntries.length) {
      toast({
        title: "No Data",
        description: `No payroll entries found for ${getMonthName(month)} ${year}`,
        variant: "destructive",
      });
      return;
    }

    try {
      // Create a new window for the summary report
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast({
          title: "Error",
          description: "Please allow popups to generate the report",
          variant: "destructive",
        });
        return;
      }

      // Calculate summary statistics
      const totalGrossPay = summaryEnrichedEntries.reduce(
        (sum, entry) => sum + parseFloat(entry.basicSalary) + parseFloat(entry.totalAdditions || "0"),
        0
      );
      const totalDeductions = summaryEnrichedEntries.reduce(
        (sum, entry) => sum + parseFloat(entry.totalDeductions || "0"),
        0
      );
      const totalNetPay = summaryEnrichedEntries.reduce(
        (sum, entry) => sum + parseFloat(entry.totalAmount),
        0
      );

      // Group by department if available
      const departmentSummary = summaryEnrichedEntries.reduce((acc, entry) => {
        const dept = entry.employee?.department || "Unassigned";
        if (!acc[dept]) {
          acc[dept] = {
            count: 0,
            totalGross: 0,
            totalNet: 0,
            totalDeductions: 0
          };
        }
        acc[dept].count += 1;
        acc[dept].totalGross += parseFloat(entry.basicSalary) + parseFloat(entry.totalAdditions || "0");
        acc[dept].totalNet += parseFloat(entry.totalAmount);
        acc[dept].totalDeductions += parseFloat(entry.totalDeductions || "0");
        return acc;
      }, {} as Record<string, any>);

      // Generate HTML content for the summary report
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Monthly Payroll Summary - ${getMonthName(selectedMonth)} ${selectedYear}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              font-size: 12px;
              color: #333;
            }
            .header { 
              text-align: center; 
              border-bottom: 2px solid #333; 
              padding-bottom: 20px; 
              margin-bottom: 30px; 
            }
            .company-name { 
              font-size: 24px; 
              font-weight: bold; 
              margin-bottom: 10px; 
            }
            .report-title { 
              font-size: 18px; 
              color: #666; 
              margin-bottom: 5px;
            }
            .period { 
              font-size: 16px; 
              color: #888; 
            }
            .summary-grid { 
              display: grid; 
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
              gap: 20px; 
              margin-bottom: 30px; 
            }
            .summary-card { 
              border: 1px solid #ddd; 
              border-radius: 8px; 
              padding: 20px; 
              text-align: center;
              background-color: #f9f9f9;
            }
            .summary-label { 
              font-size: 14px; 
              color: #666; 
              margin-bottom: 5px; 
            }
            .summary-value { 
              font-size: 24px; 
              font-weight: bold; 
              color: #333; 
            }
            .currency { color: #059669; }
            .count { color: #3b82f6; }
            .section-title { 
              font-size: 18px; 
              font-weight: bold; 
              margin: 30px 0 15px 0; 
              border-bottom: 1px solid #ddd; 
              padding-bottom: 5px;
            }
            .table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 20px;
            }
            .table th, .table td { 
              border: 1px solid #ddd; 
              padding: 12px; 
              text-align: left; 
            }
            .table th { 
              background-color: #f5f5f5; 
              font-weight: bold; 
            }
            .table .number { text-align: right; }
            .footer { 
              text-align: center; 
              font-size: 10px; 
              color: #666; 
              border-top: 1px solid #eee; 
              padding-top: 20px; 
              margin-top: 40px;
            }
            @media print {
              body { margin: 0; }
              .summary-grid { grid-template-columns: repeat(4, 1fr); }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">AquaNav Marine Solutions</div>
            <div class="report-title">Monthly Payroll Summary</div>
            <div class="period">${getMonthName(month)} ${year}</div>
          </div>

          <div class="summary-grid">
            <div class="summary-card">
              <div class="summary-label">Total Employees</div>
              <div class="summary-value count">${summaryEnrichedEntries.length}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Gross Payroll</div>
              <div class="summary-value currency">${formatCurrency(totalGrossPay)}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Total Deductions</div>
              <div class="summary-value currency">${formatCurrency(totalDeductions)}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Net Payroll</div>
              <div class="summary-value currency">${formatCurrency(totalNetPay)}</div>
            </div>
          </div>

          <div class="section-title">Department Breakdown</div>
          <table class="table">
            <thead>
              <tr>
                <th>Department</th>
                <th class="number">Employees</th>
                <th class="number">Gross Pay</th>
                <th class="number">Deductions</th>
                <th class="number">Net Pay</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(departmentSummary).map(([dept, summary]) => `
                <tr>
                  <td>${dept}</td>
                  <td class="number">${summary.count}</td>
                  <td class="number">${formatCurrency(summary.totalGross)}</td>
                  <td class="number">${formatCurrency(summary.totalDeductions)}</td>
                  <td class="number">${formatCurrency(summary.totalNet)}</td>
                </tr>
              `).join('')}
              <tr style="font-weight: bold; background-color: #f0f0f0;">
                <td>Total</td>
                <td class="number">${summaryEnrichedEntries.length}</td>
                <td class="number">${formatCurrency(totalGrossPay)}</td>
                <td class="number">${formatCurrency(totalDeductions)}</td>
                <td class="number">${formatCurrency(totalNetPay)}</td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">Employee Details</div>
          <table class="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Position</th>
                <th class="number">Basic Salary</th>
                <th class="number">Additions</th>
                <th class="number">Deductions</th>
                <th class="number">Net Pay</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${summaryEnrichedEntries.map(entry => `
                <tr>
                  <td>${entry.employee?.firstName || 'N/A'} ${entry.employee?.lastName || ''}</td>
                  <td>${entry.employee?.department || 'N/A'}</td>
                  <td>${entry.employee?.position || 'N/A'}</td>
                  <td class="number">${formatCurrency(entry.basicSalary)}</td>
                  <td class="number">${formatCurrency(entry.totalAdditions || "0")}</td>
                  <td class="number">${formatCurrency(entry.totalDeductions || "0")}</td>
                  <td class="number">${formatCurrency(entry.totalAmount)}</td>
                  <td style="text-transform: capitalize">${entry.status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
            <p>This report contains confidential payroll information</p>
          </div>
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Wait for content to load then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 1000);
      };

      toast({
        title: "Success",
        description: `Monthly payroll summary generated for ${getMonthName(month)} ${year}`,
      });
    } catch (error) {
      console.error("Error generating monthly payroll summary:", error);
      toast({
        title: "Error",
        description: "Failed to generate monthly payroll summary",
        variant: "destructive",
      });
    }
  };

  const handleGeneratePayroll = () => {
    generatePayrollMutation.mutate({
      month: selectedMonth,
      year: selectedYear,
    });
  };

  const totalPayroll = payrollEntries.reduce(
    (sum, entry) => sum + parseFloat(entry.totalAmount || "0"),
    0,
  );

  const enrichedPayrollEntries = payrollEntries.map((entry) => ({
    ...entry,
    employee: employees?.find((emp) => emp.id === entry.employeeId),
  }));

  const statusCounts = enrichedPayrollEntries.reduce(
    (acc, entry) => {
      acc[entry.status] = (acc[entry.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Payroll Management
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Process employee salaries and generate payroll reports
          </p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Generate Payroll
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Generate Monthly Payroll</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="month">Month</Label>
                    <Select
                      value={selectedMonth.toString()}
                      onValueChange={(value) =>
                        setSelectedMonth(parseInt(value))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => (
                          <SelectItem key={i + 1} value={(i + 1).toString()}>
                            {getMonthName(i + 1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="year">Year</Label>
                    <Select
                      value={selectedYear.toString()}
                      onValueChange={(value) =>
                        setSelectedYear(parseInt(value))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 7 }, (_, i) => {
                          const year = new Date().getFullYear() - 2 + i;
                          return (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                  <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2">
                    Payroll Summary
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">
                        Employees:
                      </span>
                      <span className="font-medium">
                        {employees?.length || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">
                        Period:
                      </span>
                      <span className="font-medium">
                        {getMonthName(selectedMonth)} {selectedYear}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">
                        Estimated Total:
                      </span>
                      <span className="font-medium">
                        {formatCurrency(totalPayroll)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleGeneratePayroll}
                    disabled={generatePayrollMutation.isPending}
                  >
                    {generatePayrollMutation.isPending
                      ? "Generating..."
                      : "Generate Payroll"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" disabled={!payrollEntries.length}>
                <FileText className="h-4 w-4 mr-2" />
                Clear Payroll
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Clear Payroll Entries</DialogTitle>
                <DialogDescription>
                  Select the month and year for which you want to clear payroll entries. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clear-month">Month</Label>
                    <Select
                      value={clearMonth.toString()}
                      onValueChange={(value) => setClearMonth(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => (
                          <SelectItem key={i + 1} value={(i + 1).toString()}>
                            {getMonthName(i + 1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clear-year">Year</Label>
                    <Select
                      value={clearYear.toString()}
                      onValueChange={(value) => setClearYear(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 7 }, (_, i) => {
                          const year = new Date().getFullYear() - 2 + i;
                          return (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-900/20 dark:border-red-800">
                  <h4 className="font-medium text-red-900 dark:text-red-100 mb-2">
                    Warning
                  </h4>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    This will permanently delete all payroll entries for {getMonthName(clearMonth)} {clearYear}. 
                    This action cannot be undone.
                  </p>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsClearDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => clearPayrollMutation.mutate({ month: clearMonth, year: clearYear })}
                    disabled={clearPayrollMutation.isPending}
                    variant="destructive"
                  >
                    {clearPayrollMutation.isPending ? "Clearing..." : "Clear Payroll"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Total Employees
                </p>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {employees?.length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Monthly Payroll
                </p>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 break-words">
                  {formatCurrency(totalPayroll)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <Calendar className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Pending
                </p>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {statusCounts.draft || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <CheckCircle className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Processed
                </p>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {(statusCounts.approved || 0) + (statusCounts.paid || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="current" className="space-y-6">
        <TabsList>
          <TabsTrigger value="current">Current Payroll</TabsTrigger>
          <TabsTrigger value="history">Payroll History</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="current">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {getMonthName(selectedMonth)} {selectedYear} Payroll
                </CardTitle>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export Excel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateAllPayslips}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Generate Slips
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!employees || employees.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-16 w-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                    No employees found
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400">
                    Add employees to start processing payroll
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[120px]">Employee</TableHead>
                        <TableHead className="min-w-[100px]">Month/Year</TableHead>
                        <TableHead className="min-w-[80px] text-center">Days</TableHead>
                        <TableHead className="min-w-[100px]">Basic Salary</TableHead>
                        <TableHead className="min-w-[100px]">Total Amount</TableHead>
                        <TableHead className="min-w-[80px]">Status</TableHead>
                        <TableHead className="min-w-[120px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enrichedPayrollEntries.map((entry) => (
                        <PayslipTableRow key={entry.id} entry={entry} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <PayrollHistoryTab payrollEntries={enrichedPayrollEntries} formatCurrency={formatCurrency} getMonthName={getMonthName} />
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardHeader className="px-4 md:px-6">
              <CardTitle className="text-lg md:text-xl">Payroll Reports</CardTitle>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium text-slate-900 dark:text-slate-100 text-sm md:text-base">
                    Monthly Reports
                  </h4>
                  <div className="space-y-3">
                    <Dialog open={isSummaryDialogOpen} onOpenChange={setIsSummaryDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full justify-start h-auto py-3">
                          <Download className="h-4 w-4 mr-2 flex-shrink-0" />
                          <span className="text-left">Monthly Payroll Summary</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md mx-4">
                        <DialogHeader>
                          <DialogTitle className="text-lg">Generate Monthly Payroll Summary</DialogTitle>
                          <DialogDescription className="text-sm">
                            Select the month and year for the payroll summary report
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="summary-month" className="text-sm">Month</Label>
                              <Select
                                value={summaryMonth.toString()}
                                onValueChange={(value) => setSummaryMonth(parseInt(value))}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 12 }, (_, i) => (
                                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                                      {getMonthName(i + 1)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="summary-year" className="text-sm">Year</Label>
                              <Select
                                value={summaryYear.toString()}
                                onValueChange={(value) => setSummaryYear(parseInt(value))}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 7 }, (_, i) => {
                                    const year = new Date().getFullYear() - 2 + i;
                                    return (
                                      <SelectItem key={year} value={year.toString()}>
                                        {year}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:space-x-2 pt-4">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setIsSummaryDialogOpen(false)}
                              className="w-full sm:w-auto"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() => {
                                generateMonthlyPayrollSummary(summaryMonth, summaryYear);
                                setIsSummaryDialogOpen(false);
                              }}
                              className="w-full sm:w-auto"
                            >
                              Generate Summary
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <EmployeeSalarySlipsDialog 
                      employees={employees || []} 
                      formatCurrency={formatCurrency} 
                      getMonthName={getMonthName} 
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-slate-900 dark:text-slate-100 text-sm md:text-base">
                    Annual Reports
                  </h4>
                  <div className="space-y-3">
                    <AnnualPayrollReportDialog 
                      employees={employees || []} 
                      formatCurrency={formatCurrency} 
                      getMonthName={getMonthName} 
                    />
                    <EmployeeCostAnalysisDialog 
                      employees={employees || []} 
                      formatCurrency={formatCurrency} 
                      getMonthName={getMonthName} 
                    />
                    <Button variant="outline" className="w-full justify-start h-auto py-3">
                      <Download className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="text-left">Budget vs Actual</span>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Payslip Table Row Component
function PayslipTableRow({ entry }: { entry: PayrollEntry }) {
  const [isPayslipOpen, setIsPayslipOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const approvePayrollMutation = useMutation({
    mutationFn: async (entryId: number) => {
      const response = await apiRequest(`/api/payroll/${entryId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "approved" }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Payroll Approved",
        description: "Payroll entry has been approved successfully.",
      });

      // Invalidate all payroll-related queries to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve payroll entry",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const getMonthName = (month: number) => {
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
    return months[month - 1];
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: {
        class:
          "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400",
        label: "Draft",
      },
      approved: {
        class:
          "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
        label: "Approved",
      },
      paid: {
        class:
          "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
        label: "Paid",
      },
    };

    const config =
      statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;

    return <Badge className={config.class}>{config.label}</Badge>;
  };

  return (
    <TableRow className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <TableCell className="py-4 px-4">
        <div>
          <div className="font-medium text-slate-900 dark:text-slate-100">
            {entry.employee?.firstName} {entry.employee?.lastName}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {entry.employee?.employeeCode}
          </div>
        </div>
      </TableCell>
      <TableCell className="py-4 px-4 text-slate-900 dark:text-slate-100">
        {getMonthName(entry.month)} {entry.year}
      </TableCell>
      <TableCell className="py-4 px-4 text-slate-900 dark:text-slate-100 text-center">
        {entry.workingDays}
      </TableCell>
      <TableCell className="text-sm sm:text-base break-words min-w-0">
        {formatCurrency(entry.basicSalary || "0")}
      </TableCell>
      <TableCell className="font-semibold text-sm sm:text-base break-words min-w-0">
        {formatCurrency(entry.totalAmount || "0")}
      </TableCell>
      <TableCell className="py-4 px-4">
        {getStatusBadge(entry.status)}
      </TableCell>
      <TableCell className="py-4 px-4">
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPayslipOpen(true)}
          >
            <Eye className="h-4 w-4 mr-1" />
            View Payslip
          </Button>
          <PayrollDetailsDialog payrollEntry={entry} />
          {entry.status === "draft" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => approvePayrollMutation.mutate(entry.id)}
              disabled={approvePayrollMutation.isPending}
            >
              <Check className="h-4 w-4 mr-1" />
              {approvePayrollMutation.isPending ? "Approving..." : "Approve"}
            </Button>
          )}
          {entry.status === "approved" && (
            <GeneratePayslipButton payrollEntry={entry} />
          )}
          {entry.status === "paid" && (
            <PrintPayslipButton payrollEntry={entry} />
          )}
        </div>
      </TableCell>

      <PayslipDialog
        payrollEntry={entry}
        isOpen={isPayslipOpen}
        onOpenChange={setIsPayslipOpen}
      />
    </TableRow>
  );
}

// Generate Payslip Button Component
function GeneratePayslipButton({
  payrollEntry,
}: {
  payrollEntry: PayrollEntry;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: additions = [] } = useQuery<PayrollAddition[]>({
    queryKey: [`/api/payroll/${payrollEntry.id}/additions`],
  });

  const { data: deductions = [] } = useQuery<PayrollDeduction[]>({
    queryKey: [`/api/payroll/${payrollEntry.id}/deductions`],
  });

  const updatePayrollStatusMutation = useMutation({
    mutationFn: async (entryId: number) => {
      const response = await apiRequest(`/api/payroll/${entryId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "paid" }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Status Updated",
        description: "Payroll entry has been marked as paid and accounting entries created.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update payroll status",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const getMonthName = (month: number) => {
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
    return months[month - 1];
  };

  const generateSinglePayslip = async () => {
    try {
      // Create a new window for the payslip
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast({
          title: "Error",
          description: "Please allow popups to generate payslip",
          variant: "destructive",
        });
        return;
      }

      const totalEarnings =
        parseFloat(payrollEntry.basicSalary) +
        parseFloat(payrollEntry.totalAdditions || "0");

      const totalDeductions = deductions.reduce(
        (sum, deduction) => sum + parseFloat(deduction.amount),
        0,
      );

      // Generate HTML content for the payslip
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Payroll Slip - ${payrollEntry.employee?.firstName} ${payrollEntry.employee?.lastName}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 20px; 
              font-size: 12px;
            }
            .payslip { 
              border: 1px solid #ddd; 
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
            }
            .header { 
              text-align: center; 
              border-bottom: 2px solid #333; 
              padding-bottom: 10px; 
              margin-bottom: 20px; 
            }
            .company-name { 
              font-size: 18px; 
              font-weight: bold; 
              margin-bottom: 5px; 
            }
            .payslip-title { 
              font-size: 14px; 
              color: #666; 
            }
            .info-grid { 
              display: grid; 
              grid-template-columns: 1fr 1fr; 
              gap: 20px; 
              margin-bottom: 20px; 
            }
            .info-section h3 { 
              font-size: 14px; 
              margin-bottom: 10px; 
              border-bottom: 1px solid #eee; 
              padding-bottom: 5px; 
            }
            .info-row { 
              display: flex; 
              justify-content: space-between; 
              margin-bottom: 5px; 
              font-size: 11px; 
            }
            .info-label { color: #666; }
            .info-value { font-weight: bold; }
            .earnings-section, .deductions-section { 
              margin-bottom: 20px; 
              padding: 15px; 
              border-radius: 5px; 
            }
            .earnings-section { 
              background-color: #f0f9ff; 
              border: 1px solid #bae6fd; 
            }
            .deductions-section { 
              background-color: #fef2f2; 
              border: 1px solid #fecaca; 
            }
            .section-title { 
              font-weight: bold; 
              margin-bottom: 10px; 
              font-size: 13px; 
            }
            .earnings-title { color: #059669; }
            .deductions-title { color: #dc2626; }
            .amount-row { 
              display: flex; 
              justify-content: space-between; 
              margin-bottom: 5px; 
              font-size: 11px; 
            }
            .total-row { 
              border-top: 1px solid #999; 
              padding-top: 5px; 
              font-weight: bold; 
            }
            .net-pay { 
              background-color: #f3f4f6; 
              border: 2px solid #d1d5db; 
              padding: 15px; 
              text-align: center; 
              margin-bottom: 20px; 
            }
            .net-pay-label { 
              font-size: 16px; 
              font-weight: bold; 
              margin-bottom: 5px; 
            }
            .net-pay-amount { 
              font-size: 24px; 
              font-weight: bold; 
              color: #059669; 
            }
            .footer { 
              text-align: center; 
              font-size: 10px; 
              color: #666; 
              border-top: 1px solid #eee; 
              padding-top: 10px; 
            }
            @media print {
              body { margin: 0; padding: 0; }
              .payslip { margin: 0; border: none; }
            }
          </style>
        </head>
        <body>
          <div class="payslip">
            <div class="header">
              <div class="company-name">AquaNav Marine Solutions</div>
              <div class="payslip-title">Payroll Slip</div>
            </div>

            <div class="info-grid">
              <div class="info-section">
                <h3>Employee Information</h3>
                <div class="info-row">
                  <span class="info-label">Name:</span>
                  <span class="info-value">${payrollEntry.employee?.firstName || "N/A"} ${payrollEntry.employee?.lastName || ""}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Employee Code:</span>
                  <span class="info-value">${payrollEntry.employee?.employeeCode || "N/A"}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Position:</span>
                  <span class="info-value">${payrollEntry.employee?.position || "N/A"}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Department:</span>
                  <span class="info-value">${payrollEntry.employee?.department || "N/A"}</span>
                </div>
              </div>

              <div class="info-section">
                <h3>Pay Period</h3>
                <div class="info-row">
                  <span class="info-label">Month:</span>
                  <span class="info-value">${getMonthName(payrollEntry.month)} ${payrollEntry.year}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Calendar Days:</span>
                  <span class="info-value">${payrollEntry.workingDays}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Generated Date:</span>
                  <span class="info-value">${new Date(payrollEntry.generatedDate).toLocaleDateString()}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Status:</span>
                  <span class="info-value" style="text-transform: capitalize">${payrollEntry.status}</span>
                </div>
              </div>
            </div>

            <div class="earnings-section">
              <div class="section-title earnings-title">Earnings</div>
              <div class="amount-row">
                <span>Basic Salary</span>
                <span>${formatCurrency(payrollEntry.basicSalary)}</span>
              </div>
              ${additions
                .map(
                  (addition) => `
                <div class="amount-row">
                  <span>${addition.description}</span>
                  <span>${formatCurrency(addition.amount)}</span>
                </div>
              `,
                )
                .join("")}
              <div class="amount-row total-row">
                <span>Total Earnings</span>
                <span>${formatCurrency(totalEarnings)}</span>
              </div>
            </div>

            <div class="deductions-section">
              <div class="section-title deductions-title">Deductions</div>
              ${
                deductions.length === 0
                  ? '<div style="text-align: center; color: #666; font-style: italic;">No deductions for this period</div>'
                  : deductions
                      .map(
                        (deduction) => `
                  <div class="amount-row">
                    <span>${deduction.description}</span>
                    <span>${formatCurrency(deduction.amount)}</span>
                  </div>
                `,
                      )
                      .join("") +
                    `
                <div class="amount-row total-row">
                  <span>Total Deductions</span>
                  <span>${formatCurrency(totalDeductions)}</span>
                </div>`
              }
            </div>

            <div class="net-pay">
              <div class="net-pay-label">Net Pay</div>
              <div class="net-pay-amount">${formatCurrency(payrollEntry.totalAmount)}</div>
            </div>

            <div class="footer">
              <p>This is a computer-generated payslip and does not require a signature.</p>
              <p>Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Wait for content to load then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 1000);
      };

      toast({
        title: "Success",
        description: `Payslip generated for ${payrollEntry.employee?.firstName} ${payrollEntry.employee?.lastName}`,
      });
    } catch (error) {
      console.error("Error generating payslip:", error);
      toast({
        title: "Error",
        description: "Failed to generate payslip",
        variant: "destructive",
      });
    }
  };

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleConfirmGenerate = async () => {
    try {
      // First generate the payslip
      await generateSinglePayslip();
      
      // Then update status to paid (this will also create double-entry accounting records on the server)
      await updatePayrollStatusMutation.mutateAsync(payrollEntry.id);
      
      // Close the dialog after successful completion
      setIsDialogOpen(false);
      
      toast({
        title: "Success",
        description: "Payslip generated successfully and payroll entry marked as paid.",
      });
    } catch (error) {
      console.error("Error in payslip generation process:", error);
      toast({
        title: "Error",
        description: "Failed to complete payroll processing. Please try again.",
        variant: "destructive",
      });
      // Keep dialog open on error so user can see the error state
    }
  };

  return (
    <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="default" size="sm">
          <Download className="h-4 w-4 mr-1" />
          Generate Payslip
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Generate Payslip</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to generate the payslip for{" "}
            {payrollEntry.employee?.firstName}{" "}
            {payrollEntry.employee?.lastName}? This action will mark the payroll
            entry as "Paid" and create the necessary accounting entries. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmGenerate}
            disabled={updatePayrollStatusMutation.isPending}
          >
            {updatePayrollStatusMutation.isPending
              ? "Processing..."
              : "Generate & Mark as Paid"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Print Payslip Button Component for Paid Entries
function PrintPayslipButton({
  payrollEntry,
}: {
  payrollEntry: PayrollEntry;
}) {
  const { toast } = useToast();
  const { data: additions = [] } = useQuery<PayrollAddition[]>({
    queryKey: [`/api/payroll/${payrollEntry.id}/additions`],
  });

  const { data: deductions = [] } = useQuery<PayrollDeduction[]>({
    queryKey: [`/api/payroll/${payrollEntry.id}/deductions`],
  });

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const getMonthName = (month: number) => {
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
    return months[month - 1];
  };

  const printPayslip = async () => {
    try {
      // Create a new window for the payslip
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast({
          title: "Error",
          description: "Please allow popups to print payslip",
          variant: "destructive",
        });
        return;
      }

      const totalEarnings =
        parseFloat(payrollEntry.basicSalary) +
        parseFloat(payrollEntry.totalAdditions || "0");

      const totalDeductions = deductions.reduce(
        (sum, deduction) => sum + parseFloat(deduction.amount),
        0,
      );

      // Generate HTML content for the payslip
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Payroll Slip - ${payrollEntry.employee?.firstName} ${payrollEntry.employee?.lastName}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 20px; 
              font-size: 12px;
            }
            .payslip { 
              border: 1px solid #ddd; 
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
            }
            .header { 
              text-align: center; 
              border-bottom: 2px solid #333; 
              padding-bottom: 10px; 
              margin-bottom: 20px; 
            }
            .company-name { 
              font-size: 18px; 
              font-weight: bold; 
              margin-bottom: 5px; 
            }
            .payslip-title { 
              font-size: 14px; 
              color: #666; 
            }
            .info-grid { 
              display: grid; 
              grid-template-columns: 1fr 1fr; 
              gap: 20px; 
              margin-bottom: 20px; 
            }
            .info-section h3 { 
              font-size: 14px; 
              margin-bottom: 10px; 
              border-bottom: 1px solid #eee; 
              padding-bottom: 5px; 
            }
            .info-row { 
              display: flex; 
              justify-content: space-between; 
              margin-bottom: 5px; 
              font-size: 11px; 
            }
            .info-label { color: #666; }
            .info-value { font-weight: bold; }
            .earnings-section, .deductions-section { 
              margin-bottom: 20px; 
              padding: 15px; 
              border-radius: 5px; 
            }
            .earnings-section { 
              background-color: #f0f9ff; 
              border: 1px solid #bae6fd; 
            }
            .deductions-section { 
              background-color: #fef2f2; 
              border: 1px solid #fecaca; 
            }
            .section-title { 
              font-weight: bold; 
              margin-bottom: 10px; 
              font-size: 13px; 
            }
            .earnings-title { color: #059669; }
            .deductions-title { color: #dc2626; }
            .amount-row { 
              display: flex; 
              justify-content: space-between; 
              margin-bottom: 5px; 
              font-size: 11px; 
            }
            .total-row { 
              border-top: 1px solid #999; 
              padding-top: 5px; 
              font-weight: bold; 
            }
            .net-pay { 
              background-color: #f3f4f6; 
              border: 2px solid #d1d5db; 
              padding: 15px; 
              text-align: center; 
              margin-bottom: 20px; 
            }
            .net-pay-label { 
              font-size: 16px; 
              font-weight: bold; 
              margin-bottom: 5px; 
            }
            .net-pay-amount { 
              font-size: 24px; 
              font-weight: bold; 
              color: #059669; 
            }
            .footer { 
              text-align: center; 
              font-size: 10px; 
              color: #666; 
              border-top: 1px solid #eee; 
              padding-top: 10px; 
            }
            @media print {
              body { margin: 0; padding: 0; }
              .payslip { margin: 0; border: none; }
            }
          </style>
        </head>
        <body>
          <div class="payslip">
            <div class="header">
              <div class="company-name">AquaNav Marine Solutions</div>
              <div class="payslip-title">Payroll Slip            </div>

            <div class="info-grid">
              <div class="info-section">
                <h3>Employee Information</h3>
                <div class="info-row">
                  <span class="info-label">Name:</span>
                  <span class="info-value">${payrollEntry.employee?.firstName || "N/A"} ${payrollEntry.employee?.lastName || ""}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Employee Code:</span>
                  <span class="info-value">${payrollEntry.employee?.employeeCode || "N/A"}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Position:</span>
                  <span class="info-value">${payrollEntry.employee?.position || "N/A"}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Department:</span>
                  <span class="info-value">${payrollEntry.employee?.department || "N/A"}</span>
                </div>
              </div>

              <div class="info-section">
                <h3>Pay Period</h3>
                <div class="info-row">
                  <span class="info-label">Month:</span>
                  <span class="info-value">${getMonthName(payrollEntry.month)} ${payrollEntry.year}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Calendar Days:</span>
                  <span class="info-value">${payrollEntry.workingDays}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Generated Date:</span>
                  <span class="info-value">${new Date(payrollEntry.generatedDate).toLocaleDateString()}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Status:</span>
                  <span class="info-value" style="text-transform: capitalize">${payrollEntry.status}</span>
                </div>
              </div>
            </div>

            <div class="earnings-section">
              <div class="section-title earnings-title">Earnings</div>
              <div class="amount-row">
                <span>Basic Salary</span>
                <span>${formatCurrency(payrollEntry.basicSalary)}</span>
              </div>
              ${additions
                .map(
                  (addition) => `
                <div class="amount-row">
                  <span>${addition.description}</span>
                  <span>${formatCurrency(addition.amount)}</span>
                </div>
              `,
                )
                .join("")}
              <div class="amount-row total-row">
                <span>Total Earnings</span>
                <span>${formatCurrency(totalEarnings)}</span>
              </div>
            </div>

            <div class="deductions-section">
              <div class="section-title deductions-title">Deductions</div>
              ${
                deductions.length === 0
                  ? '<div style="text-align: center; color: #666; font-style: italic;">No deductions for this period</div>'
                  : deductions
                      .map(
                        (deduction) => `
                  <div class="amount-row">
                    <span>${deduction.description}</span>
                    <span>${formatCurrency(deduction.amount)}</span>
                  </div>
                `,
                      )
                      .join("") +
                    `
                <div class="amount-row total-row">
                  <span>Total Deductions</span>
                  <span>${formatCurrency(totalDeductions)}</span>
                </div>`
              }
            </div>

            <div class="net-pay">
              <div class="net-pay-label">Net Pay</div>
              <div class="net-pay-amount">${formatCurrency(payrollEntry.totalAmount)}</div>
            </div>

            <div class="footer">
              <p>This is a computer-generated payslip and does not require a signature.</p>
              <p>Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Wait for content to load then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 1000);
      };

      toast({
        title: "Success",
        description: `Payslip printed for ${payrollEntry.employee?.firstName} ${payrollEntry.employee?.lastName}`,
      });
    } catch (error) {
      console.error("Error printing payslip:", error);
      toast({
        title: "Error",
        description: "Failed to print payslip",
        variant: "destructive",
      });
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={printPayslip}>
      <Download className="h-4 w-4 mr-1" />
      Print Payslip
    </Button>
  );
}

// Payslip Dialog Component
function PayslipDialog({
  payrollEntry,
  isOpen,
  onOpenChange,
}: {
  payrollEntry: PayrollEntry;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: additions = [] } = useQuery<PayrollAddition[]>({
    queryKey: [`/api/payroll/${payrollEntry.id}/additions`],
    enabled: isOpen,
  });

  const { data: deductions = [] } = useQuery<PayrollDeduction[]>({
    queryKey: [`/api/payroll/${payrollEntry.id}/deductions`],
    enabled: isOpen,
  });

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const getMonthName = (month: number) => {
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
    return months[month - 1];
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payroll Slip</DialogTitle>
        </DialogHeader>

        <div className="payslip-content space-y-6 p-6">
          {/* Header */}
          <div className="text-center border-b pb-4">
            <h2 className="text-xl font-bold">AquaNav Marine Solutions</h2>
            <p className="text-sm text-slate-600">Payroll Slip</p>
          </div>

          {/* Employee & Period Info */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">Employee Information</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Name:</span>
                  <span className="font-medium">
                    {payrollEntry.employee?.firstName}{" "}
                    {payrollEntry.employee?.lastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Employee Code:</span>
                  <span className="font-medium">
                    {payrollEntry.employee?.employeeCode}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Position:</span>
                  <span className="font-medium">
                    {payrollEntry.employee?.position || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Department:</span>
                  <span className="font-medium">
                    {payrollEntry.employee?.department || "N/A"}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Pay Period</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Month:</span>
                  <span className="font-medium">
                    {getMonthName(payrollEntry.month)} {payrollEntry.year}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Calendar Days:</span>
                  <span className="font-medium">
                    {payrollEntry.workingDays}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Generated Date:</span>
                  <span className="font-medium">
                    {new Date(payrollEntry.generatedDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Status:</span>
                  <span className="font-medium capitalize">
                    {payrollEntry.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Earnings */}
          <div>
            <h3 className="font-semibold mb-3 text-green-700">Earnings</h3>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Basic Salary</span>
                  <span className="font-medium">
                    {formatCurrency(payrollEntry.basicSalary)}
                  </span>
                </div>
                {additions.map((addition) => (
                  <div
                    key={addition.id}
                    className="flex justify-between text-sm"
                  >
                    <span>{addition.description}</span>
                    <span className="font-medium">
                      {formatCurrency(addition.amount)}
                    </span>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>Total Earnings</span>
                  <span>
                    {formatCurrency(
                      parseFloat(payrollEntry.basicSalary) +
                        parseFloat(payrollEntry.totalAdditions || "0"),
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <h3 className="font-semibold mb-3 text-red-700">Deductions</h3>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              {deductions.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No deductions for this period
                </p>
              ) : (
                <div className="space-y-2">
                  {deductions.map((deduction) => (
                    <div
                      key={deduction.id}
                      className="flex justify-between text-sm"
                    >
                      <span>{deduction.description}</span>
                      <span className="font-medium">
                        {formatCurrency(deduction.amount)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t pt-2 flex justify-between font-semibold">
                    <span>Total Deductions</span>
                    <span>
                      {formatCurrency(
                        deductions.reduce(
                          (sum, deduction) => sum + parseFloat(deduction.amount),
                          0,
                        )
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Net Pay */}
          <div className="bg-slate-100 border border-slate-300 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold">Net Pay</span>
              <span className="text-2xl font-bold text-green-600">
                {formatCurrency(payrollEntry.totalAmount)}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-slate-500 border-t pt-4">
            <p>
              This is a computer-generated payslip and does not require a
              signature.
            </p>
            <p>
              Generated on {new Date().toLocaleDateString()} at{" "}
              {new Date().toLocaleTimeString()}
            </p>
          </div>

          {/* Print Button */}
          <div className="flex justify-center pt-4">
            <Button onClick={handlePrint} className="no-print">
              <Download className="h-4 w-4 mr-2" />
              Print Payslip
            </Button>
          </div>
        </div>

        <style
          dangerouslySetInnerHTML={{
            __html: `
            @media print {
              .no-print {
                display: none !important;
              }
              .payslip-content {
                max-width: none !important;
                box-shadow: none !important;
                border: none !important;
              }
            }
          `,
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

// Payroll History Tab Component
function PayrollHistoryTab({ 
  payrollEntries, 
  formatCurrency, 
  getMonthName 
}: { 
  payrollEntries: any[], 
  formatCurrency: (amount: string | number) => string,
  getMonthName: (month: number) => string 
}) {
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<any>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  // Get unique years from payroll entries
  const availableYears = Array.from(
    new Set(payrollEntries.map(entry => entry.year.toString()))
  ).sort((a, b) => parseInt(b) - parseInt(a));

  // Filter entries by selected year
  const filteredEntries = selectedYear === "all" 
    ? payrollEntries 
    : payrollEntries.filter(entry => entry.year.toString() === selectedYear);

  // Group entries by period (month-year)
  const groupedPeriods = Object.entries(
    filteredEntries.reduce((acc, entry) => {
      const key = `${entry.month}-${entry.year}`;
      if (!acc[key]) {
        acc[key] = {
          month: entry.month,
          year: entry.year,
          entries: [],
          totalAmount: 0,
          employeeCount: 0,
          statuses: new Set(),
          latestGeneratedDate: null,
        };
      }
      acc[key].entries.push(entry);
      acc[key].totalAmount += parseFloat(entry.totalAmount || "0");
      acc[key].employeeCount += 1;
      acc[key].statuses.add(entry.status);

      const entryDate = new Date(entry.generatedDate);
      if (!acc[key].latestGeneratedDate || entryDate > acc[key].latestGeneratedDate) {
        acc[key].latestGeneratedDate = entryDate;
      }

      return acc;
    }, {} as Record<string, any>)
  ).map(([key, period]) => ({
    key,
    ...period,
    overallStatus: period.statuses.has('paid') ? 'paid' : 
                   period.statuses.has('approved') ? 'approved' : 'draft'
  })).sort((a, b) => b.year - a.year || b.month - a.month);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: {
        class: "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400",
        label: "Draft",
      },
      approved: {
        class: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
        label: "Approved",
      },
      paid: {
        class: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
        label: "Completed",
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <Badge className={config.class}>{config.label}</Badge>;
  };

  const handleViewPeriod = (period: any) => {
    setSelectedPeriod(period);
    setIsViewDialogOpen(true);
  };

  const handleExportPeriod = async (period: any) => {
    // In a real implementation, this would generate and download an Excel/CSV file
    console.log("Exporting period:", period);
    // For now, just show a toast
    alert(`Exporting data for ${getMonthName(period.month)} ${period.year}`);
  };

  const handleExportAll = async () => {
    // In a real implementation, this would generate and download all history
    console.log("Exporting all payroll history");
    alert("Exporting all payroll history");
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-4 px-4 md:px-6">
          <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
            <CardTitle className="text-lg md:text-xl">Payroll History</CardTitle>
            <div className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-2">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-full md:w-[140px]">
                  <SelectValue placeholder="Filter by year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="w-full md:w-auto" onClick={handleExportAll}>
                <Download className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Export History</span>
                <span className="sm:hidden">Export</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 md:px-6">
          {groupedPeriods.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Calendar className="h-12 w-12 md:h-16 md:w-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-base md:text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                No payroll history
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {selectedYear === "all" 
                  ? "Previous payroll records will appear here"
                  : `No payroll records found for ${selectedYear}`
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Desktop Table View */}
              <div className="hidden lg:block">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[120px]">Period</TableHead>
                        <TableHead className="min-w-[100px]">Employees</TableHead>
                        <TableHead className="min-w-[130px]">Total Amount</TableHead>
                        <TableHead className="min-w-[100px]">Status</TableHead>
                        <TableHead className="min-w-[130px]">Generated Date</TableHead>
                        <TableHead className="min-w-[150px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedPeriods.map((period) => (
                        <TableRow key={period.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <TableCell className="font-medium">
                            {getMonthName(period.month)} {period.year}
                          </TableCell>
                          <TableCell>{period.employeeCount}</TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(period.totalAmount)}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(period.overallStatus)}
                          </TableCell>
                          <TableCell>
                            {period.latestGeneratedDate?.toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleViewPeriod(period)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleExportPeriod(period)}
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Export
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Tablet Table View */}
              <div className="hidden md:block lg:hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Employees</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedPeriods.map((period) => (
                        <TableRow key={period.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <TableCell className="font-medium">
                            <div>
                              <div>{getMonthName(period.month)} {period.year}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {period.latestGeneratedDate?.toLocaleDateString()}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{period.employeeCount}</TableCell>
                          <TableCell className="font-semibold">
                            <div className="text-sm">
                              {formatCurrency(period.totalAmount)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(period.overallStatus)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col space-y-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 px-2 justify-start"
                                onClick={() => handleViewPeriod(period)}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="h-8 px-2 justify-start"
                                onClick={() => handleExportPeriod(period)}
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Export
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3 px-4">
                {groupedPeriods.map((period) => (
                  <Card key={period.key} className="border border-slate-200 dark:border-slate-700">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {getMonthName(period.month)} {period.year}
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {period.employeeCount} employee{period.employeeCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="flex-shrink-0 ml-2">
                          {getStatusBadge(period.overallStatus)}
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            Total Amount:
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                            {formatCurrency(period.totalAmount)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            Generated:
                          </span>
                          <span className="text-sm text-slate-900 dark:text-slate-100">
                            {period.latestGeneratedDate?.toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col space-y-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full justify-center"
                          onClick={() => handleViewPeriod(period)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full justify-center"
                          onClick={() => handleExportPeriod(period)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export Data
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Period Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto mx-4">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl">
              Payroll Details - {selectedPeriod && `${getMonthName(selectedPeriod.month)} ${selectedPeriod.year}`}
            </DialogTitle>
            <DialogDescription>
              Detailed breakdown of payroll entries for this period
            </DialogDescription>
          </DialogHeader>

          {selectedPeriod && (
            <div className="space-y-4">
              {/* Period Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Period</p>
                  <p className="font-semibold text-sm md:text-base">
                    {getMonthName(selectedPeriod.month)} {selectedPeriod.year}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Employees</p>
                  <p className="font-semibold text-sm md:text-base">{selectedPeriod.employeeCount}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total Amount</p>
                  <p className="font-semibold text-green-600 text-sm md:text-base">
                    {formatCurrency(selectedPeriod.totalAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Status</p>
                  <div className="mt-1">
                    {getStatusBadge(selectedPeriod.overallStatus)}
                  </div>
                </div>
              </div>

              {/* Individual Entries */}
              <div className="space-y-2">
                <h4 className="font-medium text-slate-900 dark:text-slate-100 text-sm md:text-base">
                  Employee Breakdown
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedPeriod.entries.map((entry: any) => (
                    <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg space-y-2 sm:space-y-0">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 dark:text-slate-100 text-sm md:text-base truncate">
                          {entry.employee?.firstName} {entry.employee?.lastName}
                        </p>
                        <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 truncate">
                          {entry.employee?.employeeCode} • {entry.employee?.position}
                        </p>
                      </div>
                      <div className="flex justify-between sm:flex-col sm:text-right">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm md:text-base">
                          {formatCurrency(entry.totalAmount)}
                        </p>
                        <div className="mt-0 sm:mt-1">
                          {getStatusBadge(entry.status)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)} className="w-full sm:w-auto">
              Close
            </Button>
            {selectedPeriod && (
              <Button onClick={() => handleExportPeriod(selectedPeriod)} className="w-full sm:w-auto">
                <Download className="h-4 w-4 mr-2" />
                Export Period
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Annual Payroll Report Dialog Component
function AnnualPayrollReportDialog({
  employees,
  formatCurrency,
  getMonthName,
}: {
  employees: Employee[];
  formatCurrency: (amount: string | number) => string;
  getMonthName: (month: number) => string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateAnnualReport = async () => {
    if (!employees.length) {
      toast({
        title: "No Employees",
        description: "No employees found to generate annual report",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Create a new window for the annual report
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast({
          title: "Error",
          description: "Please allow popups to generate the annual report",
          variant: "destructive",
        });
        setIsGenerating(false);
        return;
      }

      // Fetch payroll data for all 12 months of the selected year
      const monthlyData: any[] = [];
      let totalAnnualPayroll = 0;
      let totalEmployeesProcessed = 0;

      for (let month = 1; month <= 12; month++) {
        try {
          const payrollEntries = await queryClient.fetchQuery({
            queryKey: ["/api/payroll", { month, year: selectedYear }],
            queryFn: async () => {
              const response = await apiRequest(`/api/payroll?month=${month}&year=${selectedYear}`, {
                method: "GET"
              });
              return response.json();
            },
          });

          const enrichedEntries = (payrollEntries || []).map((entry: any) => ({
            ...entry,
            employee: employees.find((emp: any) => emp.id === entry.employeeId),
          }));

          const monthTotal = enrichedEntries.reduce(
            (sum: number, entry: any) => sum + parseFloat(entry.totalAmount || "0"),
            0
          );

          totalAnnualPayroll += monthTotal;

          monthlyData.push({
            month,
            entries: enrichedEntries,
            total: monthTotal,
            employeeCount: enrichedEntries.length,
          });

          if (enrichedEntries.length > totalEmployeesProcessed) {
            totalEmployeesProcessed = enrichedEntries.length;
          }
        } catch (error) {
          console.error(`Error fetching payroll for ${month}/${selectedYear}:`, error);
          monthlyData.push({
            month,
            entries: [],
            total: 0,
            employeeCount: 0,
          });
        }
      }

      // Calculate department-wise annual totals
      const departmentTotals: Record<string, {
        totalPayroll: number;
        employeeCount: number;
        employees: Set<number>;
      }> = {};

      monthlyData.forEach((monthData) => {
        monthData.entries.forEach((entry: any) => {
          const dept = entry.employee?.department || "Unassigned";
          if (!departmentTotals[dept]) {
            departmentTotals[dept] = {
              totalPayroll: 0,
              employeeCount: 0,
              employees: new Set(),
            };
          }
          departmentTotals[dept].totalPayroll += parseFloat(entry.totalAmount || "0");
          departmentTotals[dept].employees.add(entry.employeeId);
        });
      });

      // Update employee counts based on unique employees
      Object.keys(departmentTotals).forEach((dept) => {
        departmentTotals[dept].employeeCount = departmentTotals[dept].employees.size;
      });

      // Calculate employee-wise annual totals
      const employeeAnnualTotals: Record<number, {
        employee: any;
        totalPayroll: number;
        monthsWorked: number;
        averageMonthly: number;
      }> = {};

      monthlyData.forEach((monthData) => {
        monthData.entries.forEach((entry: any) => {
          if (!employeeAnnualTotals[entry.employeeId]) {
            employeeAnnualTotals[entry.employeeId] = {
              employee: entry.employee,
              totalPayroll: 0,
              monthsWorked: 0,
              averageMonthly: 0,
            };
          }
          employeeAnnualTotals[entry.employeeId].totalPayroll += parseFloat(entry.totalAmount || "0");
          employeeAnnualTotals[entry.employeeId].monthsWorked += 1;
        });
      });

      // Calculate averages
      Object.keys(employeeAnnualTotals).forEach((empId) => {
        const empData = employeeAnnualTotals[parseInt(empId)];
        empData.averageMonthly = empData.totalPayroll / empData.monthsWorked;
      });

      // Generate HTML content for the annual report
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Annual Payroll Report ${selectedYear} - AquaNav Marine Solutions</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              font-size: 12px;
              color: #333;
              line-height: 1.4;
            }
            .header { 
              text-align: center; 
              border-bottom: 3px solid #333; 
              padding-bottom: 20px; 
              margin-bottom: 30px; 
            }
            .company-name { 
              font-size: 28px; 
              font-weight: bold; 
              margin-bottom: 10px; 
              color: #1e40af;
            }
            .report-title { 
              font-size: 22px; 
              color: #666; 
              margin-bottom: 5px;
              font-weight: 600;
            }
            .year { 
              font-size: 18px; 
              color: #888; 
              font-weight: 500;
            }
            .executive-summary {
              background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
              border: 2px solid #0ea5e9;
              border-radius: 12px;
              padding: 25px;
              margin-bottom: 30px;
            }
            .summary-title {
              font-size: 18px;
              font-weight: bold;
              color: #0c4a6e;
              margin-bottom: 15px;
              text-align: center;
            }
            .summary-grid { 
              display: grid; 
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
              gap: 20px; 
            }
            .summary-card { 
              background: white;
              border: 1px solid #bae6fd; 
              border-radius: 8px; 
              padding: 20px; 
              text-align: center;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .summary-label { 
              font-size: 14px; 
              color: #475569; 
              margin-bottom: 8px;
              font-weight: 500;
            }
            .summary-value { 
              font-size: 24px; 
              font-weight: bold; 
              color: #0c4a6e; 
            }
            .currency { color: #059669; }
            .count { color: #3b82f6; }
            .percentage { color: #dc2626; }
            .section-title { 
              font-size: 18px; 
              font-weight: bold; 
              margin: 30px 0 15px 0; 
              border-bottom: 2px solid #e2e8f0; 
              padding-bottom: 8px;
              color: #1e293b;
            }
            .table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 25px;
              background: white;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .table th, .table td { 
              border: 1px solid #e2e8f0; 
              padding: 12px 8px; 
              text-align: left; 
              font-size: 11px;
            }
            .table th { 
              background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); 
              font-weight: bold; 
              color: #1e293b;
              font-size: 12px;
            }
            .table .number { text-align: right; }
            .table .center { text-align: center; }
            .table-striped tbody tr:nth-child(even) {
              background-color: #f8fafc;
            }
            .total-row {
              font-weight: bold;
              background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%) !important;
              border-top: 2px solid #d97706;
            }
            .chart-section {
              margin: 30px 0;
              padding: 20px;
              background: #f8fafc;
              border-radius: 8px;
              border: 1px solid #e2e8f0;
            }
            .chart-title {
              font-size: 16px;
              font-weight: bold;
              color: #1e293b;
              margin-bottom: 15px;
              text-align: center;
            }
            .footer { 
              text-align: center; 
              font-size: 10px; 
              color: #64748b; 
              border-top: 2px solid #e2e8f0; 
              padding-top: 20px; 
              margin-top: 40px;
            }
            .page-break {
              page-break-before: always;
            }
            .highlight {
              background-color: #fef3c7;
              padding: 2px 4px;
              border-radius: 3px;
            }
            @media print {
              body { margin: 0; }
              .summary-grid { grid-template-columns: repeat(4, 1fr); }
              .page-break { page-break-before: always; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">AquaNav Marine Solutions</div>
            <div class="report-title">Annual Payroll Report</div>
            <div class="year">Year ${selectedYear}</div>
          </div>

          <div class="executive-summary">
            <div class="summary-title">Executive Summary</div>
            <div class="summary-grid">
              <div class="summary-card">
                <div class="summary-label">Total Annual Payroll</div>
                <div class="summary-value currency">${formatCurrency(totalAnnualPayroll)}</div>
              </div>
              <div class="summary-card">
                <div class="summary-label">Average Monthly Payroll</div>
                <div class="summary-value currency">${formatCurrency(totalAnnualPayroll / 12)}</div>
              </div>
              <div class="summary-card">
                <div class="summary-label">Active Employees</div>
                <div class="summary-value count">${totalEmployeesProcessed}</div>
              </div>
              <div class="summary-card">
                <div class="summary-label">Departments</div>
                <div class="summary-value count">${Object.keys(departmentTotals).length}</div>
              </div>
            </div>
          </div>

          <div class="section-title">Monthly Payroll Breakdown</div>
          <table class="table table-striped">
            <thead>
              <tr>
                <th>Month</th>
                <th class="number">Employees</th>
                <th class="number">Total Payroll</th>
                <th class="number">Average per Employee</th>
                <th class="number">% of Annual Total</th>
              </tr>
            </thead>
            <tbody>
              ${monthlyData.map((monthData, index) => {
                const percentage = totalAnnualPayroll > 0 ? (monthData.total / totalAnnualPayroll * 100) : 0;
                const avgPerEmployee = monthData.employeeCount > 0 ? monthData.total / monthData.employeeCount : 0;
                return `
                  <tr>
                    <td><strong>${getMonthName(monthData.month)}</strong></td>
                    <td class="number">${monthData.employeeCount}</td>
                    <td class="number">${formatCurrency(monthData.total)}</td>
                    <td class="number">${formatCurrency(avgPerEmployee)}</td>
                    <td class="number">${percentage.toFixed(1)}%</td>
                  </tr>
                `;
              }).join('')}
              <tr class="total-row">
                <td><strong>Annual Total</strong></td>
                <td class="number"><strong>${totalEmployeesProcessed}</strong></td>
                <td class="number"><strong>${formatCurrency(totalAnnualPayroll)}</strong></td>
                <td class="number"><strong>${formatCurrency(totalAnnualPayroll / 12 / (totalEmployeesProcessed || 1))}</strong></td>
                <td class="number"><strong>100.0%</strong></td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">Department-wise Annual Summary</div>
          <table class="table table-striped">
            <thead>
              <tr>
                <th>Department</th>
                <th class="number">Employees</th>
                <th class="number">Total Annual Payroll</th>
                <th class="number">Average per Employee</th>
                <th class="number">% of Total Payroll</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(departmentTotals)
                .sort(([,a], [,b]) => b.totalPayroll - a.totalPayroll)
                .map(([dept, data]) => {
                  const percentage = totalAnnualPayroll > 0 ? (data.totalPayroll / totalAnnualPayroll * 100) : 0;
                  const avgPerEmployee = data.employeeCount > 0 ? data.totalPayroll / data.employeeCount : 0;
                  return `
                    <tr>
                      <td><strong>${dept}</strong></td>
                      <td class="number">${data.employeeCount}</td>
                      <td class="number">${formatCurrency(data.totalPayroll)}</td>
                      <td class="number">${formatCurrency(avgPerEmployee)}</td>
                      <td class="number">${percentage.toFixed(1)}%</td>
                    </tr>
                  `;
                }).join('')}
              <tr class="total-row">
                <td><strong>Grand Total</strong></td>
                <td class="number"><strong>${Object.values(departmentTotals).reduce((sum, dept) => sum + dept.employeeCount, 0)}</strong></td>
                <td class="number"><strong>${formatCurrency(totalAnnualPayroll)}</strong></td>
                <td class="number"><strong>${formatCurrency(totalAnnualPayroll / Object.values(departmentTotals).reduce((sum, dept) => sum + dept.employeeCount, 0))}</strong></td>
                <td class="number"><strong>100.0%</strong></td>
              </tr>
            </tbody>
          </table>

          <div class="page-break"></div>

          <div class="section-title">Employee Annual Summary</div>
          <table class="table table-striped">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Position</th>
                <th class="number">Months Worked</th>
                <th class="number">Total Annual Pay</th>
                <th class="number">Average Monthly Pay</th>
                <th class="number">% of Total Payroll</th>
              </tr>
            </thead>
            <tbody>
              ${Object.values(employeeAnnualTotals)
                .sort((a, b) => b.totalPayroll - a.totalPayroll)
                .map((empData) => {
                  const percentage = totalAnnualPayroll > 0 ? (empData.totalPayroll / totalAnnualPayroll * 100) : 0;
                  return `
                    <tr>
                      <td><strong>${empData.employee?.firstName || 'N/A'} ${empData.employee?.lastName || ''}</strong></td>
                      <td>${empData.employee?.department || 'N/A'}</td>
                      <td>${empData.employee?.position || 'N/A'}</td>
                      <td class="number">${empData.monthsWorked}</td>
                      <td class="number">${formatCurrency(empData.totalPayroll)}</td>
                      <td class="number">${formatCurrency(empData.averageMonthly)}</td>
                      <td class="number">${percentage.toFixed(1)}%</td>
                    </tr>
                  `;
                }).join('')}
              <tr class="total-row">
                <td colspan="4"><strong>Grand Total</strong></td>
                <td class="number"><strong>${formatCurrency(totalAnnualPayroll)}</strong></td>
                <td class="number"><strong>${formatCurrency(totalAnnualPayroll / 12)}</strong></td>
                <td class="number"><strong>100.0%</strong></td>
              </tr>
            </tbody>
          </table>

          <div class="chart-section">
            <div class="chart-title">Key Performance Indicators</div>
            <div class="summary-grid">
              <div class="summary-card">
                <div class="summary-label">Highest Monthly Payroll</div>
                <div class="summary-value currency">${formatCurrency(Math.max(...monthlyData.map(m => m.total)))}</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 5px;">
                  ${getMonthName(monthlyData.find(m => m.total === Math.max(...monthlyData.map(m => m.total)))?.month || 1)}
                </div>
              </div>
              <div class="summary-card">
                <div class="summary-label">Lowest Monthly Payroll</div>
                <div class="summary-value currency">${formatCurrency(Math.min(...monthlyData.map(m => m.total)))}</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 5px;">
                  ${getMonthName(monthlyData.find(m => m.total === Math.min(...monthlyData.map(m => m.total)))?.month || 1)}
                </div>
              </div>
              <div class="summary-card">
                <div class="summary-label">Payroll Variance</div>
                <div class="summary-value percentage">${((Math.max(...monthlyData.map(m => m.total)) - Math.min(...monthlyData.map(m => m.total))) / (totalAnnualPayroll / 12) * 100).toFixed(1)}%</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 5px;">
                  From average monthly
                </div>
              </div>
              <div class="summary-card">
                <div class="summary-label">Top Department</div>
                <div class="summary-value" style="font-size: 16px;">${Object.entries(departmentTotals).sort(([,a], [,b]) => b.totalPayroll - a.totalPayroll)[0]?.[0] || 'N/A'}</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 5px;">
                  ${formatCurrency(Object.entries(departmentTotals).sort(([,a], [,b]) => b.totalPayroll - a.totalPayroll)[0]?.[1]?.totalPayroll || 0)}
                </div>
              </div>
            </div>
          </div>

          <div class="footer">
            <p><strong>Report Generated:</strong> ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
            <p><strong>Generated by:</strong> AquaNav Marine Solutions Payroll Management System</p>
            <p style="margin-top: 10px; font-style: italic;">This report contains confidential payroll information and should be handled accordingly.</p>
          </div>
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Wait for content to load then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 1000);
      };

      toast({
        title: "Success",
        description: `Annual payroll report generated for ${selectedYear}`,
      });

      setIsOpen(false);
    } catch (error) {
      console.error("Error generating annual payroll report:", error);
      toast({
        title: "Error",
        description: "Failed to generate annual payroll report",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start">
          <Download className="h-4 w-4 mr-2" />
          Annual Payroll Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md mx-4">
        <DialogHeader>
          <DialogTitle className="text-lg">Generate Annual Payroll Report</DialogTitle>
          <DialogDescription className="text-sm">
            Select the year for the comprehensive annual payroll report
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="annual-year" className="text-sm">Year</Label>
            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 10 }, (_, i) => {
                  const year = new Date().getFullYear() - 5 + i;
                  return (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 p-3 md:p-4 rounded-lg">
            <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2 text-sm md:text-base">
              Report Includes
            </h4>
            <ul className="space-y-1 text-xs md:text-sm text-slate-600 dark:text-slate-400">
              <li>• Executive summary with key metrics</li>
              <li>• Monthly payroll breakdown</li>
              <li>• Department-wise analysis</li>
              <li>• Individual employee summaries</li>
              <li>• Year-over-year comparisons</li>
              <li>• Key performance indicators</li>
            </ul>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 md:p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-xs md:text-sm text-blue-800 dark:text-blue-300">
              <strong>Note:</strong> This report will include all payroll data for {selectedYear}. 
              The generation may take a few moments for large datasets.
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isGenerating}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={generateAnnualReport}
            disabled={isGenerating}
            className="w-full sm:w-auto"
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Generate Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Employee Cost Analysis Dialog Component
function EmployeeCostAnalysisDialog({
  employees,
  formatCurrency,
  getMonthName,
}: {
  employees: Employee[];
  formatCurrency: (amount: string | number) => string;
  getMonthName: (month: number) => string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [analysisType, setAnalysisType] = useState<'department' | 'position' | 'individual' | 'trends'>('department');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateCostAnalysisReport = async () => {
    if (!employees.length) {
      toast({
        title: "No Employees",
        description: "No employees found to generate cost analysis",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Create a new window for the cost analysis report
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast({
          title: "Error",
          description: "Please allow popups to generate the cost analysis report",
          variant: "destructive",
        });
        setIsGenerating(false);
        return;
      }

      // Fetch payroll data for the selected year
      const yearlyPayrollData: any[] = [];
      let totalYearlyPayroll = 0;

      for (let month = 1; month <= 12; month++) {
        try {
          const payrollEntries = await queryClient.fetchQuery({
            queryKey: ["/api/payroll", { month, year: selectedYear }],
            queryFn: async () => {
              const response = await apiRequest(`/api/payroll?month=${month}&year=${selectedYear}`, {
                method: "GET"
              });
              return response.json();
            },
          });

          const enrichedEntries = (payrollEntries || []).map((entry: any) => ({
            ...entry,
            employee: employees.find((emp: any) => emp.id === entry.employeeId),
          }));

          yearlyPayrollData.push(...enrichedEntries);
          totalYearlyPayroll += enrichedEntries.reduce(
            (sum: number, entry: any) => sum + parseFloat(entry.totalAmount || "0"),
            0
          );
        } catch (error) {
          console.error(`Error fetching payroll for ${month}/${selectedYear}:`, error);
        }
      }

      // Calculate department cost analysis
      const departmentAnalysis = yearlyPayrollData.reduce((acc, entry) => {
        const dept = entry.employee?.department || "Unassigned";
        if (!acc[dept]) {
          acc[dept] = {
            totalCost: 0,
            employees: new Set(),
            avgMonthlyCost: 0,
            maxMonthlyCost: 0,
            minMonthlyCost: Infinity,
            payrollEntries: []
          };
        }
        const cost = parseFloat(entry.totalAmount || "0");
        acc[dept].totalCost += cost;
        acc[dept].employees.add(entry.employeeId);
        acc[dept].payrollEntries.push({ ...entry, cost });
        if (cost > acc[dept].maxMonthlyCost) acc[dept].maxMonthlyCost = cost;
        if (cost < acc[dept].minMonthlyCost && cost > 0) acc[dept].minMonthlyCost = cost;
        return acc;
      }, {} as Record<string, any>);

      // Calculate averages for departments
      Object.keys(departmentAnalysis).forEach(dept => {
        const entries = departmentAnalysis[dept].payrollEntries;
        departmentAnalysis[dept].avgMonthlyCost = entries.length > 0 
          ? departmentAnalysis[dept].totalCost / entries.length 
          : 0;
        departmentAnalysis[dept].employeeCount = departmentAnalysis[dept].employees.size;
        if (departmentAnalysis[dept].minMonthlyCost === Infinity) {
          departmentAnalysis[dept].minMonthlyCost = 0;
        }
      });

      // Calculate position-based analysis
      const positionAnalysis = yearlyPayrollData.reduce((acc, entry) => {
        const position = entry.employee?.position || "Unassigned";
        if (!acc[position]) {
          acc[position] = {
            totalCost: 0,
            employees: new Set(),
            avgSalary: 0,
            departments: new Set()
          };
        }
        acc[position].totalCost += parseFloat(entry.totalAmount || "0");
        acc[position].employees.add(entry.employeeId);
        if (entry.employee?.department) {
          acc[position].departments.add(entry.employee.department);
        }
        return acc;
      }, {} as Record<string, any>);

      // Calculate averages for positions
      Object.keys(positionAnalysis).forEach(position => {
        const analysis = positionAnalysis[position];
        analysis.employeeCount = analysis.employees.size;
        analysis.avgSalary = analysis.employeeCount > 0 ? analysis.totalCost / analysis.employeeCount : 0;
        analysis.departmentCount = analysis.departments.size;
      });

      // Calculate individual employee analysis
      const individualAnalysis = employees.map(employee => {
        const employeeEntries = yearlyPayrollData.filter(entry => entry.employeeId === employee.id);
        const totalPaid = employeeEntries.reduce((sum, entry) => sum + parseFloat(entry.totalAmount || "0"), 0);
        const monthsWorked = employeeEntries.length;
        const avgMonthlySalary = monthsWorked > 0 ? totalPaid / monthsWorked : 0;
        const annualSalary = parseFloat(employee.salary || "0") * 12;
        const utilizationRate = annualSalary > 0 ? (totalPaid / annualSalary) * 100 : 0;

        return {
          ...employee,
          totalPaid,
          monthsWorked,
          avgMonthlySalary,
          annualSalary,
          utilizationRate: Math.min(utilizationRate, 100)
        };
      }).sort((a, b) => b.totalPaid - a.totalPaid);

      // Calculate monthly trends
      const monthlyTrends = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const monthEntries = yearlyPayrollData.filter(entry => entry.month === month);
        const totalCost = monthEntries.reduce((sum, entry) => sum + parseFloat(entry.totalAmount || "0"), 0);
        const employeeCount = new Set(monthEntries.map(entry => entry.employeeId)).size;
        const avgCostPerEmployee = employeeCount > 0 ? totalCost / employeeCount : 0;

        return {
          month,
          monthName: getMonthName(month),
          totalCost,
          employeeCount,
          avgCostPerEmployee
        };
      });

      // Calculate cost efficiency metrics
      const totalEmployees = employees.length;
      const avgCostPerEmployee = totalEmployees > 0 ? totalYearlyPayroll / totalEmployees : 0;
      const highestPaidEmployee = individualAnalysis[0];
      const lowestPaidEmployee = individualAnalysis[individualAnalysis.length - 1];
      const mostExpensiveDept = Object.entries(departmentAnalysis)
        .sort(([,a], [,b]) => b.totalCost - a.totalCost)[0];
      const leastExpensiveDept = Object.entries(departmentAnalysis)
        .sort(([,a], [,b]) => a.totalCost - b.totalCost)[0];

      // Generate HTML content for the cost analysis report
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Employee Cost Analysis ${selectedYear} - AquaNav Marine Solutions</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              font-size: 12px;
              color: #333;
              line-height: 1.4;
            }
            .header { 
              text-align: center; 
              border-bottom: 3px solid #333; 
              padding-bottom: 20px; 
              margin-bottom: 30px; 
            }
            .company-name { 
              font-size: 28px; 
              font-weight: bold; 
              margin-bottom: 10px; 
              color: #1e40af;
            }
            .report-title { 
              font-size: 22px; 
              color: #666; 
              margin-bottom: 5px;
              font-weight: 600;
            }
            .year { 
              font-size: 18px; 
              color: #888; 
              font-weight: 500;
            }
            .executive-summary {
              background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
              border: 2px solid #0ea5e9;
              border-radius: 12px;
              padding: 25px;
              margin-bottom: 30px;
            }
            .summary-title {
              font-size: 18px;
              font-weight: bold;
              color: #0c4a6e;
              margin-bottom: 15px;
              text-align: center;
            }
            .summary-grid { 
              display: grid; 
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
              gap: 20px; 
            }
            .summary-card { 
              background: white;
              border: 1px solid #bae6fd; 
              border-radius: 8px; 
              padding: 20px; 
              text-align: center;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .summary-label { 
              font-size: 14px; 
              color: #475569; 
              margin-bottom: 8px;
              font-weight: 500;
            }
            .summary-value { 
              font-size: 24px; 
              font-weight: bold; 
              color: #0c4a6e; 
            }
            .currency { color: #059669; }
            .count { color: #3b82f6; }
            .percentage { color: #dc2626; }
            .section-title { 
              font-size: 18px; 
              font-weight: bold; 
              margin: 30px 0 15px 0; 
              border-bottom: 2px solid #e2e8f0; 
              padding-bottom: 8px;
              color: #1e293b;
            }
            .table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 25px;
              background: white;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .table th, .table td { 
              border: 1px solid #e2e8f0; 
              padding: 12px 8px; 
              text-align: left; 
              font-size: 11px;
            }
            .table th { 
              background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); 
              font-weight: bold; 
              color: #1e293b;
              font-size: 12px;
            }
            .table .number { text-align: right; }
            .table .center { text-align: center; }
            .table-striped tbody tr:nth-child(even) {
              background-color: #f8fafc;
            }
            .total-row {
              font-weight: bold;
              background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%) !important;
              border-top: 2px solid #d97706;
            }
            .highlight-box {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
            .metrics-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
              gap: 15px;
              margin: 20px 0;
            }
            .metric-item {
              background: white;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 15px;
            }
            .metric-label {
              font-size: 12px;
              color: #64748b;
              margin-bottom: 5px;
            }
            .metric-value {
              font-size: 16px;
              font-weight: bold;
              color: #1e293b;
            }
            .footer { 
              text-align: center; 
              font-size: 10px; 
              color: #64748b; 
              border-top: 2px solid #e2e8f0; 
              padding-top: 20px; 
              margin-top: 40px;
            }
            .page-break {
              page-break-before: always;
            }
            .cost-efficiency {
              background: #fef3c7;
              border: 2px solid #f59e0b;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
            .efficiency-title {
              font-size: 16px;
              font-weight: bold;
              color: #92400e;
              margin-bottom: 10px;
            }
            @media print {
              body { margin: 0; }
              .summary-grid { grid-template-columns: repeat(4, 1fr); }
              .page-break { page-break-before: always; }
              .metrics-grid { grid-template-columns: repeat(3, 1fr); }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">AquaNav Marine Solutions</div>
            <div class="report-title">Employee Cost Analysis Report</div>
            <div class="year">Year ${selectedYear}</div>
          </div>

          <div class="executive-summary">
            <div class="summary-title">Executive Summary</div>
            <div class="summary-grid">
              <div class="summary-card">
                <div class="summary-label">Total Payroll Cost</div>
                <div class="summary-value currency">${formatCurrency(totalYearlyPayroll)}</div>
              </div>
              <div class="summary-card">
                <div class="summary-label">Average Cost per Employee</div>
                <div class="summary-value currency">${formatCurrency(avgCostPerEmployee)}</div>
              </div>
              <div class="summary-card">
                <div class="summary-label">Total Employees Analyzed</div>
                <div class="summary-value count">${totalEmployees}</div>
              </div>
              <div class="summary-card">
                <div class="summary-label">Departments</div>
                <div class="summary-value count">${Object.keys(departmentAnalysis).length}</div>
              </div>
            </div>
          </div>

          <div class="cost-efficiency">
            <div class="efficiency-title">Cost Efficiency Highlights</div>
            <div class="metrics-grid">
              <div class="metric-item">
                <div class="metric-label">Highest Paid Employee</div>
                <div class="metric-value">${highestPaidEmployee?.firstName} ${highestPaidEmployee?.lastName}</div>
                <div class="metric-label" style="margin-top: 5px;">${formatCurrency(highestPaidEmployee?.totalPaid || 0)}</div>
              </div>
              <div class="metric-item">
                <div class="metric-label">Most Expensive Department</div>
                <div class="metric-value">${mostExpensiveDept ? mostExpensiveDept[0] : 'N/A'}</div>
                <div class="metric-label" style="margin-top: 5px;">${formatCurrency(mostExpensiveDept ? mostExpensiveDept[1].totalCost : 0)}</div>
              </div>
              <div class="metric-item">
                <div class="metric-label">Cost per Employee Range</div>
                <div class="metric-value">${formatCurrency(lowestPaidEmployee?.totalPaid || 0)} - ${formatCurrency(highestPaidEmployee?.totalPaid || 0)}</div>
              </div>
            </div>
          </div>

          <div class="section-title">Department Cost Analysis</div>
          <table class="table table-striped">
            <thead>
              <tr>
                <th>Department</th>
                <th class="number">Total Cost</th>
                <th class="number">Employees</th>
                <th class="number">Avg Cost/Employee</th>
                <th class="number">Max Monthly Cost</th>
                <th class="number">Min Monthly Cost</th>
                <th class="number">% of Total Cost</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(departmentAnalysis)
                .sort(([,a], [,b]) => b.totalCost - a.totalCost)
                .map(([dept, analysis]) => {
                  const percentage = totalYearlyPayroll > 0 ? (analysis.totalCost / totalYearlyPayroll * 100) : 0;
                  const avgCostPerEmp = analysis.employeeCount > 0 ? analysis.totalCost / analysis.employeeCount : 0;
                  return `
                    <tr>
                      <td><strong>${dept}</strong></td>
                      <td class="number">${formatCurrency(analysis.totalCost)}</td>
                      <td class="number">${analysis.employeeCount}</td>
                      <td class="number">${formatCurrency(avgCostPerEmp)}</td>
                      <td class="number">${formatCurrency(analysis.maxMonthlyCost)}</td>
                      <td class="number">${formatCurrency(analysis.minMonthlyCost)}</td>
                      <td class="number">${percentage.toFixed(1)}%</td>
                    </tr>
                  `;
                }).join('')}
              <tr class="total-row">
                <td><strong>Total</strong></td>
                <td class="number"><strong>${formatCurrency(totalYearlyPayroll)}</strong></td>
                <td class="number"><strong>${totalEmployees}</strong></td>
                <td class="number"><strong>${formatCurrency(avgCostPerEmployee)}</strong></td>
                <td class="number"><strong>-</strong></td>
                <td class="number"><strong>-</strong></td>
                <td class="number"><strong>100.0%</strong></td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">Position-Based Cost Analysis</div>
          <table class="table table-striped">
            <thead>
              <tr>
                <th>Position</th>
                <th class="number">Total Cost</th>
                <th class="number">Employees</th>
                <th class="number">Avg Annual Salary</th>
                <th class="number">Departments</th>
                <th class="number">% of Total Cost</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(positionAnalysis)
                .sort(([,a], [,b]) => b.totalCost - a.totalCost)
                .map(([position, analysis]) => {
                  const percentage = totalYearlyPayroll > 0 ? (analysis.totalCost / totalYearlyPayroll * 100) : 0;
                  return `
                    <tr>
                      <td><strong>${position}</strong></td>
                      <td class="number">${formatCurrency(analysis.totalCost)}</td>
                      <td class="number">${analysis.employeeCount}</td>
                      <td class="number">${formatCurrency(analysis.avgSalary)}</td>
                      <td class="number">${analysis.departmentCount}</td>
                      <td class="number">${percentage.toFixed(1)}%</td>
                    </tr>
                  `;
                }).join('')}
            </tbody>
          </table>

          <div class="page-break"></div>

          <div class="section-title">Individual Employee Cost Analysis</div>
          <table class="table table-striped">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Position</th>
                <th class="number">Total Paid</th>
                <th class="number">Months Worked</th>
                <th class="number">Avg Monthly</th>
                <th class="number">Annual Salary</th>
                <th class="number">Utilization %</th>
              </tr>
            </thead>
            <tbody>
              ${individualAnalysis.map(emp => `
                <tr>
                  <td><strong>${emp.firstName} ${emp.lastName}</strong></td>
                  <td>${emp.department || 'N/A'}</td>
                  <td>${emp.position || 'N/A'}</td>
                  <td class="number">${formatCurrency(emp.totalPaid)}</td>
                  <td class="number">${emp.monthsWorked}</td>
                  <td class="number">${formatCurrency(emp.avgMonthlySalary)}</td>
                  <td class="number">${formatCurrency(emp.annualSalary)}</td>
                  <td class="number">${emp.utilizationRate.toFixed(1)}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="section-title">Monthly Cost Trends</div>
          <table class="table table-striped">
            <thead>
              <tr>
                <th>Month</th>
                <th class="number">Total Cost</th>
                <th class="number">Employees</th>
                <th class="number">Avg Cost/Employee</th>
                <th class="number">% of Annual Total</th>
              </tr>
            </thead>
            <tbody>
              ${monthlyTrends.map(trend => {
                const percentage = totalYearlyPayroll > 0 ? (trend.totalCost / totalYearlyPayroll * 100) : 0;
                return `
                  <tr>
                    <td><strong>${trend.monthName}</strong></td>
                    <td class="number">${formatCurrency(trend.totalCost)}</td>
                    <td class="number">${trend.employeeCount}</td>
                    <td class="number">${formatCurrency(trend.avgCostPerEmployee)}</td>
                    <td class="number">${percentage.toFixed(1)}%</td>
                  </tr>
                `;
              }).join('')}
              <tr class="total-row">
                <td><strong>Annual Total</strong></td>
                <td class="number"><strong>${formatCurrency(totalYearlyPayroll)}</strong></td>
                <td class="number"><strong>-</strong></td>
                <td class="number"><strong>${formatCurrency(totalYearlyPayroll / 12)}</strong></td>
                <td class="number"><strong>100.0%</strong></td>
              </tr>
            </tbody>
          </table>

          <div class="highlight-box">
            <h3 style="color: #1e293b; margin-bottom: 15px;">Key Cost Insights</h3>
            <ul style="margin: 0; padding-left: 20px;">
              <li>Average monthly payroll: <strong>${formatCurrency(totalYearlyPayroll / 12)}</strong></li>
              <li>Highest cost month: <strong>${monthlyTrends.reduce((max, trend) => trend.totalCost > max.totalCost ? trend : max).monthName}</strong> 
                  (${formatCurrency(Math.max(...monthlyTrends.map(t => t.totalCost)))})</li>
              <li>Lowest cost month: <strong>${monthlyTrends.reduce((min, trend) => trend.totalCost < min.totalCost ? trend : min).monthName}</strong> 
                  (${formatCurrency(Math.min(...monthlyTrends.map(t => t.totalCost)))})</li>
              <li>Cost variance: <strong>${((Math.max(...monthlyTrends.map(t => t.totalCost)) - Math.min(...monthlyTrends.map(t => t.totalCost))) / (totalYearlyPayroll / 12) * 100).toFixed(1)}%</strong> from average</li>
              <li>Department with highest cost efficiency: <strong>${leastExpensiveDept ? leastExpensiveDept[0] : 'N/A'}</strong></li>
            </ul>
          </div>

          <div class="footer">
            <p><strong>Report Generated:</strong> ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
            <p><strong>Generated by:</strong> AquaNav Marine Solutions Payroll Management System</p>
            <p style="margin-top: 10px; font-style: italic;">This report contains confidential employee cost information and should be handled accordingly.</p>
          </div>
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Wait for content to load then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 1000);
      };

      toast({
        title: "Success",
        description: `Employee cost analysis report generated for ${selectedYear}`,
      });

      setIsOpen(false);
    } catch (error) {
      console.error("Error generating employee cost analysis:", error);
      toast({
        title: "Error",
        description: "Failed to generate employee cost analysis",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start">
          <Download className="h-4 w-4 mr-2" />
          Employee Cost Analysis
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md mx-4">
        <DialogHeader>
          <DialogTitle className="text-lg">Generate Employee Cost Analysis</DialogTitle>
          <DialogDescription className="text-sm">
            Comprehensive analysis of employee costs, efficiency, and trends
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cost-analysis-year" className="text-sm">Analysis Year</Label>
            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 10 }, (_, i) => {
                  const year = new Date().getFullYear() - 5 + i;
                  return (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 p-3 md:p-4 rounded-lg">
            <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2 text-sm md:text-base">
              Analysis Includes
            </h4>
            <ul className="space-y-1 text-xs md:text-sm text-slate-600 dark:text-slate-400">
              <li>• Department cost breakdown and efficiency</li>
              <li>• Position-based salary analysis</li>
              <li>• Individual employee cost metrics</li>
              <li>• Monthly cost trends and variance</li>
              <li>• Cost efficiency insights and recommendations</li>
              <li>• Utilization rates and performance metrics</li>
            </ul>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 md:p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-xs md:text-sm text-blue-800 dark:text-blue-300">
              <strong>Note:</strong> This analysis will process all payroll data for {selectedYear} to provide 
              comprehensive cost insights across departments, positions, and individual employees.
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isGenerating}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={generateCostAnalysisReport}
            disabled={isGenerating}
            className="w-full sm:w-auto"
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Generate Analysis
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Employee Salary Slips Dialog Component
function EmployeeSalarySlipsDialog({
  employees,
  formatCurrency,
  getMonthName,
}: {
  employees: Employee[];
  formatCurrency: (amount: string | number) => string;
  getMonthName: (month: number) => string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<Array<{month: number, year: number}>>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleEmployeeToggle = (employeeId: number) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleSelectAllEmployees = () => {
    if (selectedEmployees.length === employees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(employees.map(emp => emp.id));
    }
  };

  const handleAddMonth = () => {
    const monthYear = { month: currentMonth, year: currentYear };
    const exists = selectedMonths.some(m => m.month === currentMonth && m.year === currentYear);
    
    if (!exists) {
      setSelectedMonths(prev => [...prev, monthYear]);
    }
  };

  const handleRemoveMonth = (index: number) => {
    setSelectedMonths(prev => prev.filter((_, i) => i !== index));
  };

  const generateSelectedPayslips = async () => {
    if (selectedEmployees.length === 0) {
      toast({
        title: "No Employees Selected",
        description: "Please select at least one employee",
        variant: "destructive",
      });
      return;
    }

    if (selectedMonths.length === 0) {
      toast({
        title: "No Months Selected",
        description: "Please select at least one month",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create a new window for all payslips
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast({
          title: "Error",
          description: "Please allow popups to generate payslips",
          variant: "destructive",
        });
        return;
      }

      // Generate HTML content for all payslips
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Employee Salary Slips</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 20px; 
              font-size: 12px;
            }
            .payslip { 
              page-break-after: always; 
              margin-bottom: 40px; 
              border: 1px solid #ddd; 
              padding: 20px;
              min-height: 600px;
            }
            .payslip:last-child { page-break-after: avoid; }
            .header { 
              text-align: center; 
              border-bottom: 2px solid #333; 
              padding-bottom: 10px; 
              margin-bottom: 20px; 
            }
            .company-name { 
              font-size: 18px; 
              font-weight: bold; 
              margin-bottom: 5px; 
            }
            .payslip-title { 
              font-size: 14px; 
              color: #666; 
            }
            .info-grid { 
              display: grid; 
              grid-template-columns: 1fr 1fr; 
              gap: 20px; 
              margin-bottom: 20px; 
            }
            .info-section h3 { 
              font-size: 14px; 
              margin-bottom: 10px; 
              border-bottom: 1px solid #eee; 
              padding-bottom: 5px; 
            }
            .info-row { 
              display: flex; 
              justify-content: space-between; 
              margin-bottom: 5px; 
              font-size: 11px; 
            }
            .info-label { color: #666; }
            .info-value { font-weight: bold; }
            .earnings-section, .deductions-section { 
              margin-bottom: 20px; 
              padding: 15px; 
              border-radius: 5px; 
            }
            .earnings-section { 
              background-color: #f0f9ff; 
              border: 1px solid #bae6fd; 
            }
            .deductions-section { 
              background-color: #fef2f2; 
              border: 1px solid #fecaca; 
            }
            .section-title { 
              font-weight: bold; 
              margin-bottom: 10px; 
              font-size: 13px; 
            }
            .earnings-title { color: #059669; }
            .deductions-title { color: #dc2626; }
            .amount-row { 
              display: flex; 
              justify-content: space-between; 
              margin-bottom: 5px; 
              font-size: 11px; 
            }
            .total-row { 
              border-top: 1px solid #999; 
              padding-top: 5px; 
              font-weight: bold; 
            }
            .net-pay { 
              background-color: #f3f4f6; 
              border: 2px solid #d1d5db; 
              padding: 15px; 
              text-align: center; 
              margin-bottom: 20px; 
            }
            .net-pay-label { 
              font-size: 16px; 
              font-weight: bold; 
              margin-bottom: 5px; 
            }
            .net-pay-amount { 
              font-size: 24px; 
              font-weight: bold; 
              color: #059669; 
            }
            .footer { 
              text-align: center; 
              font-size: 10px; 
              color: #666; 
              border-top: 1px solid #eee; 
              padding-top: 10px; 
            }
            .no-data { 
              text-align: center; 
              color: #666; 
              font-style: italic; 
              padding: 20px; 
            }
            @media print {
              body { margin: 0; padding: 0; }
              .payslip { margin: 0; border: none; }
            }
          </style>
        </head>
        <body>
      `;

      let totalSlipsGenerated = 0;

      // Fetch payroll data for selected employees and months
      for (const employee of employees.filter(emp => selectedEmployees.includes(emp.id))) {
        for (const monthYear of selectedMonths) {
          try {
            // Fetch payroll entries for this employee and month
            const payrollResponse = await queryClient.fetchQuery({
              queryKey: ["/api/payroll", { month: monthYear.month, year: monthYear.year }],
            });

            const employeePayroll = payrollResponse.find((entry: any) => entry.employeeId === employee.id);

            if (!employeePayroll) {
              // Add a "no data" payslip
              htmlContent += `
                <div class="payslip">
                  <div class="header">
                    <div class="company-name">AquaNav Marine Solutions</div>
                    <div class="payslip-title">Payroll Slip</div>
                  </div>
                  <div class="info-grid">
                    <div class="info-section">
                      <h3>Employee Information</h3>
                      <div class="info-row">
                        <span class="info-label">Name:</span>
                        <span class="info-value">${employee.firstName} ${employee.lastName}</span>
                      </div>
                      <div class="info-row">
                        <span class="info-label">Employee Code:</span>
                        <span class="info-value">${employee.employeeCode}</span>
                      </div>
                    </div>
                    <div class="info-section">
                      <h3>Pay Period</h3>
                      <div class="info-row">
                        <span class="info-label">Month:</span>
                        <span class="info-value">${getMonthName(monthYear.month)} ${monthYear.year}</span>
                      </div>
                    </div>
                  </div>
                  <div class="no-data">
                    <h3>No Payroll Data Available</h3>
                    <p>No payroll entry found for ${employee.firstName} ${employee.lastName} in ${getMonthName(monthYear.month)} ${monthYear.year}</p>
                  </div>
                </div>
              `;
              continue;
            }

            // Fetch additions and deductions for this payroll entry
            const [additionsRes, deductionsRes] = await Promise.all([
              queryClient.fetchQuery({
                queryKey: [`/api/payroll/${employeePayroll.id}/additions`],
              }).catch(() => []),
              queryClient.fetchQuery({
                queryKey: [`/api/payroll/${employeePayroll.id}/deductions`],
              }).catch(() => []),
            ]);

            const additions = additionsRes || [];
            const deductions = deductionsRes || [];

            const totalEarnings = parseFloat(employeePayroll.basicSalary) + parseFloat(employeePayroll.totalAdditions || "0");
            const totalDeductions = deductions.reduce((sum: number, deduction: any) => sum + parseFloat(deduction.amount), 0);

            htmlContent += `
              <div class="payslip">
                <div class="header">
                  <div class="company-name">AquaNav Marine Solutions</div>
                  <div class="payslip-title">Payroll Slip</div>
                </div>

                <div class="info-grid">
                  <div class="info-section">
                    <h3>Employee Information</h3>
                    <div class="info-row">
                      <span class="info-label">Name:</span>
                      <span class="info-value">${employee.firstName} ${employee.lastName}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Employee Code:</span>
                      <span class="info-value">${employee.employeeCode}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Position:</span>
                      <span class="info-value">${employee.position || "N/A"}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Department:</span>
                      <span class="info-value">${employee.department || "N/A"}</span>
                    </div>
                  </div>

                  <div class="info-section">
                    <h3>Pay Period</h3>
                    <div class="info-row">
                      <span class="info-label">Month:</span>
                      <span class="info-value">${getMonthName(monthYear.month)} ${monthYear.year}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Calendar Days:</span>
                      <span class="info-value">${employeePayroll.workingDays}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Generated Date:</span>
                      <span class="info-value">${new Date(employeePayroll.generatedDate).toLocaleDateString()}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Status:</span>
                      <span class="info-value" style="text-transform: capitalize">${employeePayroll.status}</span>
                    </div>
                  </div>
                </div>

                <div class="earnings-section">
                  <div class="section-title earnings-title">Earnings</div>
                  <div class="amount-row">
                    <span>Basic Salary</span>
                    <span>${formatCurrency(employeePayroll.basicSalary)}</span>
                  </div>
                  ${additions.map((addition: any) => `
                    <div class="amount-row">
                      <span>${addition.description}</span>
                      <span>${formatCurrency(addition.amount)}</span>
                    </div>
                  `).join("")}
                  <div class="amount-row total-row">
                    <span>Total Earnings</span>
                    <span>${formatCurrency(totalEarnings)}</span>
                  </div>
                </div>

                <div class="deductions-section">
                  <div class="section-title deductions-title">Deductions</div>
                  ${deductions.length === 0
                    ? '<div style="text-align: center; color: #666; font-style: italic;">No deductions for this period</div>'
                    : deductions.map((deduction: any) => `
                      <div class="amount-row">
                        <span>${deduction.description}</span>
                        <span>${formatCurrency(deduction.amount)}</span>
                      </div>
                    `).join("") + `
                    <div class="amount-row total-row">
                      <span>Total Deductions</span>
                      <span>${formatCurrency(totalDeductions)}</span>
                    </div>`
                  }
                </div>

                <div class="net-pay">
                  <div class="net-pay-label">Net Pay</div>
                  <div class="net-pay-amount">${formatCurrency(employeePayroll.totalAmount)}</div>
                </div>

                <div class="footer">
                  <p>This is a computer-generated payslip and does not require a signature.</p>
                  <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
                </div>
              </div>
            `;

            totalSlipsGenerated++;
          } catch (error) {
            console.error(`Error fetching payroll for employee ${employee.id} in ${monthYear.month}/${monthYear.year}:`, error);
          }
        }
      }

      htmlContent += `
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Wait for content to load then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 1000);
      };

      toast({
        title: "Success",
        description: `Generated payslips for ${selectedEmployees.length} employees across ${selectedMonths.length} months`,
      });

      setIsOpen(false);
    } catch (error) {
      console.error("Error generating payslips:", error);
      toast({
        title: "Error",
        description: "Failed to generate payslips",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start">
          <Download className="h-4 w-4 mr-2" />
          Employee Salary Slips
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Employee Salary Slips</DialogTitle>
          <DialogDescription>
            Select employees and months to generate salary slips
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Employee Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-slate-900 dark:text-slate-100">
                Select Employees ({selectedEmployees.length} selected)
              </h4>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSelectAllEmployees}
              >
                {selectedEmployees.length === employees.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto border rounded-lg p-4">
              {employees.map((employee) => (
                <div key={employee.id} className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id={`employee-${employee.id}`}
                    checked={selectedEmployees.includes(employee.id)}
                    onChange={() => handleEmployeeToggle(employee.id)}
                    className="rounded border-gray-300"
                  />
                  <label 
                    htmlFor={`employee-${employee.id}`}
                    className="text-sm cursor-pointer flex-1"
                  >
                    <div className="font-medium">{employee.firstName} {employee.lastName}</div>
                    <div className="text-slate-500">{employee.employeeCode} • {employee.position}</div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Month Selection */}
          <div className="space-y-4">
            <h4 className="font-medium text-slate-900 dark:text-slate-100">
              Select Months ({selectedMonths.length} selected)
            </h4>
            
            <div className="flex gap-4 items-end">
              <div className="space-y-2">
                <Label>Month</Label>
                <Select
                  value={currentMonth.toString()}
                  onValueChange={(value) => setCurrentMonth(parseInt(value))}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        {getMonthName(i + 1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Select
                  value={currentYear.toString()}
                  onValueChange={(value) => setCurrentYear(parseInt(value))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 7 }, (_, i) => {
                      const year = new Date().getFullYear() - 2 + i;
                      return (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddMonth} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Month
              </Button>
            </div>

            {selectedMonths.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Months:</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedMonths.map((monthYear, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 px-3 py-1 rounded-full text-sm"
                    >
                      <span>{getMonthName(monthYear.month)} {monthYear.year}</span>
                      <button
                        onClick={() => handleRemoveMonth(index)}
                        className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
            <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2">
              Generation Summary
            </h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Employees:</span>
                <span className="font-medium">{selectedEmployees.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Months:</span>
                <span className="font-medium">{selectedMonths.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Total Slips:</span>
                <span className="font-medium">{selectedEmployees.length * selectedMonths.length}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={generateSelectedPayslips}
            disabled={selectedEmployees.length === 0 || selectedMonths.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Generate Salary Slips
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Payroll Details Dialog Component
function PayrollDetailsDialog({
  payrollEntry,
}: {
  payrollEntry: PayrollEntry;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("additions");
  const [additionForm, setAdditionForm] = useState({
    description: "",
    amount: "",
    note: "",
  });
  const [deductionForm, setDeductionForm] = useState({
    description: "",
    amount: "",
    note: "",
  });
  const [editingAddition, setEditingAddition] =
    useState<PayrollAddition | null>(null);
  const [editingDeduction, setEditingDeduction] =
    useState<PayrollDeduction | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: additions = [] } = useQuery<PayrollAddition[]>({
    queryKey: [`/api/payroll/${payrollEntry.id}/additions`],
    enabled: isOpen,
  });

  const { data: deductions = [] } = useQuery<PayrollDeduction[]>({
    queryKey: [`/api/payroll/${payrollEntry.id}/deductions`],
    enabled: isOpen,
  });

  const additionMutation = useMutation({
    mutationFn: async (data: {
      description: string;
      amount: string;
      note?: string;
    }) => {
      if (editingAddition) {
        return apiRequest(
          "PUT",
          `/api/payroll/additions/${editingAddition.id}`,
          data,
        );
      } else {
        return apiRequest(
          "POST",
          `/api/payroll/${payrollEntry.id}/additions`,
          data,
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/payroll/${payrollEntry.id}/additions`],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      setAdditionForm({ description: "", amount: "", note: "" });
      setEditingAddition(null);
      toast({
        title: "Success",
        description: editingAddition
          ? "Addition updated successfully"
          : "Addition added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save addition",
        variant: "destructive",
      });
    },
  });

  const deductionMutation = useMutation({
    mutationFn: async (data: {
      description: string;
      amount: string;
      note?: string;
    }) => {
      if (editingDeduction) {
        return apiRequest(
          "PUT",
          `/api/payroll/deductions/${editingDeduction.id}`,
          data,
        );
      } else {
        return apiRequest(
          "POST",
          `/api/payroll/${payrollEntry.id}/deductions`,
          data,
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/payroll/${payrollEntry.id}/deductions`],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      setDeductionForm({ description: "", amount: "", note: "" });
      setEditingDeduction(null);
      toast({
        title: "Success",
        description: editingDeduction
          ? "Deduction updated successfully"
          : "Deduction added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save deduction",
        variant: "destructive",
      });
    },
  });

  const deleteAdditionMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/payroll/additions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/payroll/${payrollEntry.id}/additions`],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      toast({
        title: "Success",
        description: "Addition deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete addition",
        variant: "destructive",
      });
    },
  });

  const deleteDeductionMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/payroll/deductions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/payroll/${payrollEntry.id}/deductions`],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      toast({
        title: "Success",
        description: "Deduction deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete deduction",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const handleAdditionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!additionForm.description || !additionForm.amount) {
      toast({
        title: "Error",
        description: "Description and amount are required",
        variant: "destructive",
      });
      return;
    }
    additionMutation.mutate(additionForm);
  };

  const handleDeductionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deductionForm.description || !deductionForm.amount) {
      toast({
        title: "Error",
        description: "Description and amount are required",
        variant: "destructive",
      });
      return;
    }
    deductionMutation.mutate(deductionForm);
  };

  const startEditAddition = (addition: PayrollAddition) => {
    setEditingAddition(addition);
    setAdditionForm({
      description: addition.description,
      amount: addition.amount,
      note: addition.note || "",
    });
  };

  const startEditDeduction = (deduction: PayrollDeduction) => {
    setEditingDeduction(deduction);
    setDeductionForm({
      description: deduction.description,
      amount: deduction.amount,
      note: deduction.note || "",
    });
  };

  const cancelEdit = () => {
    setEditingAddition(null);
    setEditingDeduction(null);
    setAdditionForm({ description: "", amount: "", note: "" });
    setDeductionForm({ description: "", amount: "", note: "" });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={
            payrollEntry.status === "approved" || payrollEntry.status === "paid"
          }
        >
          <Edit className="h-4 w-4 mr-1" />
          Details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Payroll Details - {payrollEntry.employee?.firstName}{" "}
            {payrollEntry.employee?.lastName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Basic Salary
              </p>
              <p className="font-semibold">
                {formatCurrency(payrollEntry.basicSalary)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Total Additions
              </p>
              <p className="font-semibold text-green-600">
                {formatCurrency(payrollEntry.totalAdditions || "0")}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Total Deductions
              </p>
              <p className="font-semibold text-red-600">
                {formatCurrency(payrollEntry.totalDeductions || "0")}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Net Amount
              </p>
              <p className="font-semibold text-lg">
                {formatCurrency(payrollEntry.totalAmount)}
              </p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="additions">
                Additions ({additions.length})
              </TabsTrigger>
              <TabsTrigger value="deductions">
                Deductions ({deductions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="additions" className="space-y-4">
              {/* Add Addition Form */}
              {payrollEntry.status !== "approved" &&
                payrollEntry.status !== "paid" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {editingAddition ? "Edit Addition" : "Add New Addition"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form
                        onSubmit={handleAdditionSubmit}
                        className="space-y-4"
                      >
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="addition-description">
                              Description*
                            </Label>
                            <Input
                              id="addition-description"
                              value={additionForm.description}
                              onChange={(e) =>
                                setAdditionForm((prev) => ({
                                  ...prev,
                                  description: e.target.value,
                                }))
                              }
                              placeholder="e.g., Overtime, Bonus, Allowance"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="addition-amount">Amount*</Label>
                            <Input
                              id="addition-amount"
                              type="number"
                              step="0.01"
                              value={additionForm.amount}
                              onChange={(e) =>
                                setAdditionForm((prev) => ({
                                  ...prev,
                                  amount: e.target.value,
                                }))
                              }
                              placeholder="0.00"
                              required
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="addition-note">Note (Optional)</Label>
                          <Textarea
                            id="addition-note"
                            value={additionForm.note}
                            onChange={(e) =>
                              setAdditionForm((prev) => ({
                                ...prev,
                                note: e.target.value,
                              }))
                            }
                            placeholder="Additional notes or comments"
                          />
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            type="submit"
                            disabled={additionMutation.isPending}
                          >
                            {additionMutation.isPending
                              ? "Saving..."
                              : editingAddition
                                ? "Update"
                                : "Add"}
                          </Button>
                          {editingAddition && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={cancelEdit}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

              {/* Additions List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Current Additions</CardTitle>
                </CardHeader>
                <CardContent>
                  {additions.length === 0 ? (
                    <p className="text-slate-500 dark:text-slate-400 text-center py-4">
                      No additions added yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {additions.map((addition) => (
                        <div
                          key={addition.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="flex items-center space-x-4">
                              <div>
                                <p className="font-medium">
                                  {addition.description}
                                </p>
                                {addition.note && !addition.note.includes("calendar days worked") && (
                                  <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {addition.note}
                                  </p>
                                )}
                              </div>
                              <div className="text-green-600 font-semibold">
                                {formatCurrency(addition.amount)}
                              </div>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditAddition(addition)}
                              disabled={
                                payrollEntry.status === "approved" ||
                                payrollEntry.status === "paid"
                              }
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                deleteAdditionMutation.mutate(addition.id)
                              }
                              disabled={
                                deleteAdditionMutation.isPending ||
                                payrollEntry.status === "approved" ||
                                payrollEntry.status === "paid"
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="deductions" className="space-y-4">
              {/* Add Deduction Form */}
              {payrollEntry.status !== "approved" &&
                payrollEntry.status !== "paid" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {editingDeduction
                          ? "Edit Deduction"
                          : "Add New Deduction"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form
                        onSubmit={handleDeductionSubmit}
                        className="space-y-4"
                      >
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="deduction-description">
                              Description*
                            </Label>
                            <Input
                              id="deduction-description"
                              value={deductionForm.description}
                              onChange={(e) =>
                                setDeductionForm((prev) => ({
                                  ...prev,
                                  description: e.target.value,
                                }))
                              }
                              placeholder="e.g., Tax, Insurance, Loan"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="deduction-amount">Amount*</Label>
                            <Input
                              id="deduction-amount"
                              type="number"
                              step="0.01"
                              value={deductionForm.amount}
                              onChange={(e) =>
                                setDeductionForm((prev) => ({
                                  ...prev,
                                  amount: e.target.value,
                                }))
                              }
                              placeholder="0.00"
                              required
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="deduction-note">
                            Note (Optional)
                          </Label>
                          <Textarea
                            id="deduction-note"
                            value={deductionForm.note}
                            onChange={(e) =>
                              setDeductionForm((prev) => ({
                                ...prev,
                                note: e.target.value,
                              }))
                            }
                            placeholder="Additional notes or comments"
                          />
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            type="submit"
                            disabled={deductionMutation.isPending}
                          >
                            {deductionMutation.isPending
                              ? "Saving..."
                              : editingDeduction
                                ? "Update"
                                : "Add"}
                          </Button>
                          {editingDeduction && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={cancelEdit}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

              {/* Deductions List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Current Deductions</CardTitle>
                </CardHeader>
                <CardContent>
                  {deductions.length === 0 ? (
                    <p className="text-slate-500 dark:text-slate-400 text-center py-4">
                      No deductions added yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {deductions.map((deduction) => (
                        <div
                          key={deduction.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="flex items-center space-x-4">
                              <div>
                                <p className="font-medium">
                                  {deduction.description}
                                </p>
                                {deduction.note && (
                                  <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {deduction.note}
                                  </p>
                                )}
                              </div>
                              <div className="text-red-600 font-semibold">
                                {formatCurrency(deduction.amount)}
                              </div>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditDeduction(deduction)}
                              disabled={
                                payrollEntry.status === "approved" ||
                                payrollEntry.status === "paid"
                              }
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                deleteDeductionMutation.mutate(deduction.id)
                              }
                              disabled={
                                deleteDeductionMutation.isPending ||
                                payrollEntry.status === "approved" ||
                                payrollEntry.status === "paid"
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}