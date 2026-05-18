import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Download, Eye, FileText, Calendar } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Company, Employee } from "@shared/schema";
import { generateCommonHeader, generateCommonFooter, getPayslipStyles, formatDisplayDate } from "@/lib/utils";
import { printHtml } from "@/lib/print-utils";

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
  employee?: {
    id: number;
    firstName: string;
    lastName: string;
    employeeCode: string;
    category?: string;
  };
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

const formatCurrency = (amount: string | number) => {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return `AED ${num.toFixed(2)}`;
};

const getMonthName = (month: number) => {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return months[month - 1];
};

export default function MyPayslips() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [filterYear, setFilterYear] = useState<string>("all");
  const [viewEntry, setViewEntry] = useState<PayrollEntry | null>(null);

  const { data: company } = useQuery<Company>({
    queryKey: ["/api/company"],
    enabled: isAuthenticated,
  });

  const { data: payslips = [], isLoading } = useQuery<PayrollEntry[]>({
    queryKey: ["/api/my-payslips"],
    enabled: isAuthenticated,
  });

  const filteredPayslips = filterYear === "all"
    ? payslips
    : payslips.filter((p) => p.year === parseInt(filterYear));

  const years = [...new Set(payslips.map((p) => p.year))].sort((a, b) => b - a);

  if (!isAuthenticated) return null;

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">My Payslips</h1>
        <p className="text-slate-600 dark:text-slate-400">
          View and download your payroll slips
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            Payslips
          </CardTitle>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-500" />
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Filter year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-slate-500">Loading payslips...</div>
          ) : filteredPayslips.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              {payslips.length === 0
                ? "No payslips available yet. Payslips will appear here once your payroll has been processed."
                : "No payslips found for the selected year."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Basic Salary</TableHead>
                  <TableHead>Additions</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>Net Pay</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayslips.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {getMonthName(entry.month)} {entry.year}
                    </TableCell>
                    <TableCell>{formatCurrency(entry.basicSalary)}</TableCell>
                    <TableCell className="text-green-600 dark:text-green-400">
                      +{formatCurrency(entry.totalAdditions || "0")}
                    </TableCell>
                    <TableCell className="text-red-600 dark:text-red-400">
                      -{formatCurrency(entry.totalDeductions || "0")}
                    </TableCell>
                    <TableCell className="font-semibold">{formatCurrency(entry.totalAmount)}</TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {formatDisplayDate(entry.generatedDate)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewEntry(entry)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <PrintPayslipBtn entry={entry} company={company} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {viewEntry && (
        <PayslipViewDialog
          entry={viewEntry}
          isOpen={!!viewEntry}
          onOpenChange={(open) => { if (!open) setViewEntry(null); }}
          company={company}
        />
      )}
    </div>
  );
}

function PrintPayslipBtn({ entry, company }: { entry: PayrollEntry; company?: Company }) {
  const { toast } = useToast();

  const handlePrint = async () => {
    try {
      const [addRes, dedRes] = await Promise.all([
        fetch(`/api/my-payslips/${entry.id}/additions`, { credentials: "include" }),
        fetch(`/api/my-payslips/${entry.id}/deductions`, { credentials: "include" }),
      ]);
      const additions: PayrollAddition[] = addRes.ok ? await addRes.json() : [];
      const deductions: PayrollDeduction[] = dedRes.ok ? await dedRes.json() : [];

      const totalEarnings = parseFloat(entry.basicSalary) + parseFloat(entry.totalAdditions || "0");
      const totalDeductionsAmt = deductions.reduce((sum, d) => sum + parseFloat(d.amount), 0);

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Payroll Slip - ${entry.employee?.firstName} ${entry.employee?.lastName}</title>
          ${getPayslipStyles()}
        </head>
        <body>
          <div class="payslip-container">
            ${generateCommonHeader({ company })}
            <table class="report-wrapper" style="width: 100%; border-collapse: collapse; border: none !important;">
              <thead>
                <tr><td style="border: none !important; padding: 0 !important;"><div class="report-header-space"></div></td></tr>
              </thead>
              <tbody>
                <tr>
                  <td class="report-content-cell">
                    <div class="payslip-title-section">
                      <div class="payslip-title">Payroll Slip</div>
                    </div>
                    <div class="payslip-content">
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
                        </div>
                        <div class="info-section">
                          <h3>Pay Period</h3>
                          <div class="info-row">
                            <span class="info-label">Month:</span>
                            <span class="info-value">${getMonthName(entry.month)} ${entry.year}</span>
                          </div>
                          <div class="info-row">
                            <span class="info-label">Calendar Days:</span>
                            <span class="info-value">${new Date(entry.year, entry.month, 0).getDate()}</span>
                          </div>
                          ${['contract','consultant'].includes(entry.employee?.category || '') ? `
                          <div class="info-row">
                            <span class="info-label">Working Days:</span>
                            <span class="info-value">${entry.workingDays}</span>
                          </div>` : ''}
                          <div class="info-row">
                            <span class="info-label">Generated Date:</span>
                            <span class="info-value">${formatDisplayDate(entry.generatedDate)}</span>
                          </div>
                        </div>
                      </div>
                      <div class="earnings-section">
                        <div class="section-title earnings-title">Earnings</div>
                        ${parseFloat(entry.basicSalary) > 0 ? `
                        <div class="amount-row">
                          <span>Basic Salary</span>
                          <span>${formatCurrency(entry.basicSalary)}</span>
                        </div>
                        ` : ''}
                        ${additions.map((a) => `
                        <div class="amount-row">
                          <span>${a.description}</span>
                          <span>${formatCurrency(a.amount)}</span>
                        </div>`).join("")}
                        <div class="amount-row total-row">
                          <span>Total Earnings</span>
                          <span>${formatCurrency(totalEarnings)}</span>
                        </div>
                      </div>
                      <div class="deductions-section">
                        <div class="section-title deductions-title">Deductions</div>
                        ${deductions.length === 0
                          ? '<div style="text-align: center; color: #666; font-style: italic;">No deductions for this period</div>'
                          : deductions.map((d) => `
                        <div class="amount-row">
                          <span>${d.description}</span>
                          <span>${formatCurrency(d.amount)}</span>
                        </div>`).join("") + `
                        <div class="amount-row total-row">
                          <span>Total Deductions</span>
                          <span>${formatCurrency(totalDeductionsAmt)}</span>
                        </div>`}
                      </div>
                      <div class="net-pay">
                        <div class="net-pay-label">Net Pay</div>
                        <div class="net-pay-amount">${formatCurrency(entry.totalAmount)}</div>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr><td style="border: none !important; padding: 0 !important;"><div class="report-footer-space"></div></td></tr>
              </tfoot>
            </table>
            ${generateCommonFooter({ company })}
          </div>
        </body>
        </html>
      `;

      await printHtml(htmlContent);
      toast({ title: "Success", description: "Payslip ready for printing/download" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to print payslip", variant: "destructive" });
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handlePrint}>
      <Download className="h-4 w-4 mr-1" />
      Print
    </Button>
  );
}

function PayslipViewDialog({
  entry,
  isOpen,
  onOpenChange,
  company,
}: {
  entry: PayrollEntry;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  company?: Company;
}) {
  const { data: additions = [] } = useQuery<PayrollAddition[]>({
    queryKey: ["/api/my-payslips", entry.id, "additions"],
    queryFn: async () => {
      const res = await fetch(`/api/my-payslips/${entry.id}/additions`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isOpen,
  });

  const { data: deductions = [] } = useQuery<PayrollDeduction[]>({
    queryKey: ["/api/my-payslips", entry.id, "deductions"],
    queryFn: async () => {
      const res = await fetch(`/api/my-payslips/${entry.id}/deductions`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isOpen,
  });

  const totalEarnings = parseFloat(entry.basicSalary) + parseFloat(entry.totalAdditions || "0");
  const totalDeductionsAmt = deductions.reduce((sum, d) => sum + parseFloat(d.amount), 0);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Payslip - {getMonthName(entry.month)} {entry.year}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500 dark:text-slate-400">Employee</p>
              <p className="font-medium">{entry.employee?.firstName} {entry.employee?.lastName}</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">Employee Code</p>
              <p className="font-medium">{entry.employee?.employeeCode || "N/A"}</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">Calendar Days</p>
              <p className="font-medium">{new Date(entry.year, entry.month, 0).getDate()}</p>
            </div>
            {['contract','consultant'].includes(entry.employee?.category || '') && (
              <div>
                <p className="text-slate-500 dark:text-slate-400">Working Days</p>
                <p className="font-medium">{entry.workingDays}</p>
              </div>
            )}
            <div>
              <p className="text-slate-500 dark:text-slate-400">Generated Date</p>
              <p className="font-medium">{formatDisplayDate(entry.generatedDate)}</p>
            </div>
          </div>

          <div className="border-t pt-3">
            <h4 className="font-semibold text-green-700 dark:text-green-400 mb-2">Earnings</h4>
            <div className="space-y-1 text-sm">
              {parseFloat(entry.basicSalary) > 0 && (
                <div className="flex justify-between">
                  <span>Basic Salary</span>
                  <span>{formatCurrency(entry.basicSalary)}</span>
                </div>
              )}
              {additions.map((a) => (
                <div key={a.id} className="flex justify-between">
                  <span>{a.description}</span>
                  <span>{formatCurrency(a.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold border-t pt-1">
                <span>Total Earnings</span>
                <span>{formatCurrency(totalEarnings)}</span>
              </div>
            </div>
          </div>

          <div className="border-t pt-3">
            <h4 className="font-semibold text-red-700 dark:text-red-400 mb-2">Deductions</h4>
            {deductions.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No deductions for this period</p>
            ) : (
              <div className="space-y-1 text-sm">
                {deductions.map((d) => (
                  <div key={d.id} className="flex justify-between">
                    <span>{d.description}</span>
                    <span>{formatCurrency(d.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold border-t pt-1">
                  <span>Total Deductions</span>
                  <span>{formatCurrency(totalDeductionsAmt)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="border-t pt-3 bg-slate-50 dark:bg-slate-800 -mx-6 px-6 py-3 rounded-b-lg">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold">Net Pay</span>
              <span className="text-lg font-bold text-green-700 dark:text-green-400">{formatCurrency(entry.totalAmount)}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
