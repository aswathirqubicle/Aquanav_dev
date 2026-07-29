import { formatDisplayDate } from "@/lib/utils";
import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Download,
  FileText,
  Users,
  DollarSign,
  Wrench,
  Building2,
  TrendingUp,
  Calendar,
  Eye,
  Filter,
  ChevronDown,
  ChevronRight,
  ArrowDown,
  LayoutList,
  X,
  Loader2,
} from "lucide-react";

interface Project {
  id: number;
  title: string;
  status: string;
  estimatedBudget: string;
  actualCost: string;
  customerId: number;
  customer?: { name: string };
  revenue?: string;
}

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  position: string;
  department: string;
  salary: string;
  isActive: boolean;
}

interface PayrollEntry {
  id: number;
  employeeId: number;
  month: number;
  year: number;
  totalAmount: string;
  status: string;
  employee?: Employee;
}

interface InventoryItem {
  id: number;
  name: string;
  category: string;
  currentStock: number;
  minStockLevel: number;
  avgCost: string;
}

interface ReportData {
  projects: Project[];
  employees: Employee[];
  payroll: PayrollEntry[];
  inventory: InventoryItem[];
}

export default function ReportsIndex() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<string>("");
  const [generatedReportData, setGeneratedReportData] = useState<any>(null);
  
  // Dialog-level filters for all reports
  const [dialogYear, setDialogYear] = useState(new Date().getFullYear());
  const [dialogMonth, setDialogMonth] = useState<string>("all");
  const [dialogMonths, setDialogMonths] = useState<string[]>([]); // Multiple months for payroll
  const [dialogEmployeeType, setDialogEmployeeType] = useState<string>("all"); // Employee type filter
  const [dialogDepartments, setDialogDepartments] = useState<string[]>([]); // Multiple departments
  const [dialogStartDate, setDialogStartDate] = useState<string>(""); // Date range start
  const [dialogEndDate, setDialogEndDate] = useState<string>(""); // Date range end
  const [dialogProject, setDialogProject] = useState<string>("all");
  const [dialogProjectStatus, setDialogProjectStatus] = useState<string>("all");
  const [dialogProjectCustomer, setDialogProjectCustomer] = useState<string>("all");
  const [dialogProjectDateFrom, setDialogProjectDateFrom] = useState<string>("");
  const [dialogProjectDateTo, setDialogProjectDateTo] = useState<string>("");
  const [dialogAssetCategory, setDialogAssetCategory] = useState<string>("all");
  const [dialogAssetStatus, setDialogAssetStatus] = useState<string>("all");
  const [dialogAssetDateRangeType, setDialogAssetDateRangeType] = useState<string>("all"); // all, financial_year, custom
  const [dialogAssetFinancialYear, setDialogAssetFinancialYear] = useState<string>(new Date().getFullYear().toString()); // FY starting year
  const [dialogAssetDateFrom, setDialogAssetDateFrom] = useState<string>("");
  const [dialogAssetDateTo, setDialogAssetDateTo] = useState<string>("");
  const [expandedDepartments, setExpandedDepartments] = useState<string[]>([]);
  const [showDialogFilters, setShowDialogFilters] = useState(false);
  const [showChart, setShowChart] = useState(true);
  const [showSummaryCards, setShowSummaryCards] = useState(true);
  const [expandedStatuses, setExpandedStatuses] = useState<string[]>([]);
  const [expandedAssetStatuses, setExpandedAssetStatuses] = useState<string[]>([]);
  const [expandedAssetRows, setExpandedAssetRows] = useState<number[]>([]);
  const [expandedTrendMonths, setExpandedTrendMonths] = useState<string[]>([]);
  const [dialogStatementCustomer, setDialogStatementCustomer] = useState<string>("all");
  const [dialogStatementSupplier, setDialogStatementSupplier] = useState<string>("all");
  const [dialogStatementDateFrom, setDialogStatementDateFrom] = useState<string>("");
  const [dialogStatementDateTo, setDialogStatementDateTo] = useState<string>("");
  const [dialogStatementDueMoreThan, setDialogStatementDueMoreThan] = useState<string>("");
  const [statementPage, setStatementPage] = useState(1);
  const statementPageSize = 10;
  const [isStatementFetching, setIsStatementFetching] = useState(false);
  const [statementPagination, setStatementPagination] = useState<{
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  } | null>(null);
  const [statementTotals, setStatementTotals] = useState<{
    debit: number;
    credit: number;
    balance: number;
  } | null>(null);
  const detailsSectionRef = useRef<HTMLDivElement>(null);
  
  const scrollToDetails = () => {
    detailsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  
  // Check if any project filters are active
  const hasActiveProjectFilters = dialogProject !== "all" || dialogProjectStatus !== "all" || dialogProjectCustomer !== "all" || dialogProjectDateFrom !== "" || dialogProjectDateTo !== "";
  const hasActiveStatementFilters = dialogStatementCustomer !== "all" || dialogStatementSupplier !== "all" || dialogStatementDateFrom !== "" || dialogStatementDateTo !== "" || dialogStatementDueMoreThan !== "";

  // Helper function to regenerate statement report with server-side pagination
  // Pass filter values directly to avoid async state issues
  const regenerateStatementReport = (reportType: string, filters?: {
    customer?: string;
    supplier?: string;
    dateFrom?: string;
    dateTo?: string;
    dueMoreThan?: string;
  }) => {
    setStatementPage(1);
    const statementType = reportType === 'customer-statement' ? 'customer-statement' : 'supplier-statement';
    fetchStatementData(statementType, 1, filters || {
      customer: dialogStatementCustomer,
      supplier: dialogStatementSupplier,
      dateFrom: dialogStatementDateFrom,
      dateTo: dialogStatementDateTo,
      dueMoreThan: dialogStatementDueMoreThan,
    }).then(result => {
      const title = reportType === 'customer-statement' 
        ? 'Customer Statement of Account' 
        : 'Supplier Statement of Account';
      setGeneratedReportData({
        title,
        type: 'statement',
        statementType: reportType === 'customer-statement' ? 'customer' : 'supplier',
        data: result.data,
        summary: {
          totalTransactions: result.pagination?.totalCount || 0,
          totalDebit: result.totals?.debit || 0,
          totalCredit: result.totals?.credit || 0,
          outstandingBalance: result.totals?.balance || 0,
        }
      });
    });
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, setLocation]);

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: isAuthenticated,
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    enabled: isAuthenticated,
  });

  const { data: payrollEntries = [] } = useQuery<PayrollEntry[]>({
    queryKey: ["/api/payroll"],
    enabled: isAuthenticated,
  });

  const { data: inventoryData } = useQuery<{ data: InventoryItem[], total: number }>({
    queryKey: ["/api/inventory"],
    enabled: isAuthenticated,
  });
  const inventory = inventoryData?.data || [];

  const { data: assetTypes = [] } = useQuery({
    queryKey: ["/api/asset-types"],
    enabled: isAuthenticated,
  });

  const { data: assetInstances = [] } = useQuery({
    queryKey: ["/api/asset-inventory/instances"],
    enabled: isAuthenticated,
  });

  const { data: assetAssignments = [] } = useQuery({
    queryKey: ["/api/asset-assignments"],
    enabled: isAuthenticated,
  });

  const { data: customersData } = useQuery<{ data: { id: number; name: string }[] }>({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const response = await fetch("/api/customers?limit=1000");
      return response.json();
    },
    enabled: isAuthenticated,
  });
  const customers = customersData?.data || [];

  // Fetch project revenues from the dedicated API
  const projectIdsString = projects.map(p => p.id).join(',');
  const { data: projectRevenuesData = [] } = useQuery<{
    projectId: number;
    totalRevenue: string;
    totalCost: string;
    profit: string;
  }[]>({
    queryKey: [`/api/projects/revenues?projectIds=${projectIdsString}`],
    enabled: isAuthenticated && projects.length > 0,
  });

  const { data: assetInstanceAssignments = [] } = useQuery({
    queryKey: ["/api/asset-instance-assignments"],
    enabled: isAuthenticated,
  });

  const { data: maintenanceRecords = [] } = useQuery({
    queryKey: ["/api/maintenance-records"],
    enabled: isAuthenticated,
  });

  // Statement of Accounts data
  const { data: salesInvoicesResponse, isLoading: salesInvoicesLoading } = useQuery<any>({
    queryKey: ["/api/sales-invoices"],
    enabled: isAuthenticated,
  });
  const salesInvoices = Array.isArray(salesInvoicesResponse) ? salesInvoicesResponse : (salesInvoicesResponse?.data || []);


  const { data: suppliersData } = useQuery<{ data: { id: number; name: string }[] }>({
    queryKey: ["/api/suppliers"],
    enabled: isAuthenticated,
  });
  const suppliers = suppliersData?.data || [];

  const { data: purchaseInvoicesResponse } = useQuery<any>({
    queryKey: ["/api/purchase-invoices"],
    enabled: isAuthenticated,
  });
  const purchaseInvoices = Array.isArray(purchaseInvoicesResponse) ? purchaseInvoicesResponse : (purchaseInvoicesResponse?.data || []);

  if (!isAuthenticated) {
    return null;
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

  const getMonthName = (month: number) => {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return months[month - 1];
  };

  // Helper function to get asset date range based on filter type
  const getAssetDateRange = (): { start: Date | null; end: Date | null } => {
    if (dialogAssetDateRangeType === 'all') {
      return { start: null, end: null };
    }
    if (dialogAssetDateRangeType === 'financial_year') {
      const fyYear = parseInt(dialogAssetFinancialYear);
      // UAE Financial Year: Jan 1 to Dec 31 (calendar year)
      return {
        start: new Date(fyYear, 0, 1),
        end: new Date(fyYear, 11, 31)
      };
    }
    if (dialogAssetDateRangeType === 'custom') {
      return {
        start: dialogAssetDateFrom ? new Date(dialogAssetDateFrom) : null,
        end: dialogAssetDateTo ? new Date(dialogAssetDateTo) : null
      };
    }
    return { start: null, end: null };
  };

  // Helper function to filter projects based on all filters
  const getFilteredProjects = () => {
    return projects.filter(project => {
      // Single project filter
      if (dialogProject !== "all" && project.id.toString() !== dialogProject) {
        return false;
      }
      // Status filter
      if (dialogProjectStatus !== "all" && project.status !== dialogProjectStatus) {
        return false;
      }
      // Customer filter
      if (dialogProjectCustomer !== "all" && project.customerId?.toString() !== dialogProjectCustomer) {
        return false;
      }
      // Date range filter (based on project start date)
      if (dialogProjectDateFrom) {
        const projectStart = (project as any).startDate ? new Date((project as any).startDate) : null;
        if (!projectStart || projectStart < new Date(dialogProjectDateFrom)) {
          return false;
        }
      }
      if (dialogProjectDateTo) {
        const projectStart = (project as any).startDate ? new Date((project as any).startDate) : null;
        if (!projectStart || projectStart > new Date(dialogProjectDateTo)) {
          return false;
        }
      }
      return true;
    });
  };

  // Get project revenue from the API data
  const getProjectRevenue = (projectId: number) => {
    const revenueData = projectRevenuesData.find(r => r.projectId === projectId);
    return revenueData ? parseFloat(revenueData.totalRevenue || "0") : 0;
  };

  // Generate project financial data
  const generateProjectFinancialData = () => {
    const filteredProjects = getFilteredProjects();

    return filteredProjects.map(project => {
      const revenue = getProjectRevenue(project.id);
      const actualCost = parseFloat(project.actualCost || "0");
      const profit = revenue - actualCost;
      
      return {
        name: project.title.substring(0, 20) + (project.title.length > 20 ? "..." : ""),
        estimated: parseFloat(parseFloat(project.estimatedBudget || "0").toFixed(2)),
        actual: parseFloat(actualCost.toFixed(2)),
        revenue: parseFloat(revenue.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        variance: parseFloat((parseFloat(project.estimatedBudget || "0") - actualCost).toFixed(2)),
        status: project.status,
      };
    });
  };

  // Generate payroll summary data
  const generatePayrollSummaryData = () => {
    const filteredPayroll = payrollEntries.filter(entry => {
      const yearMatch = entry.year === dialogYear;
      // Multi-month filter: if dialogMonths is empty or has no items, show all; otherwise filter by selected months
      const monthMatch = dialogMonths.length === 0 || dialogMonths.includes(entry.month.toString());
      
      // Employee type filter
      if (dialogEmployeeType !== "all") {
        const employee = employees.find((e: any) => e.id === entry.employeeId);
        if (!employee || employee.employmentType !== dialogEmployeeType) {
          return false;
        }
      }
      
      return yearMatch && monthMatch;
    });

    const monthlyData = filteredPayroll.reduce((acc, entry) => {
      const key = `${getMonthName(entry.month)} ${entry.year}`;
      if (!acc[key]) {
        acc[key] = { month: key, amount: 0, count: 0 };
      }
      acc[key].amount += parseFloat(entry.totalAmount);
      acc[key].count += 1;
      return acc;
    }, {} as Record<string, any>);

    return Object.values(monthlyData);
  };

  // Generate department cost breakdown using payroll data with year/month filter
  const generateDepartmentCostData = () => {
    // Filter payroll entries by year and optional months
    const filteredPayroll = payrollEntries.filter(entry => {
      // Year filter
      if (entry.year !== dialogYear) return false;
      
      // Month filter (optional - if dialogMonths is empty, include all)
      if (dialogMonths.length > 0 && !dialogMonths.includes(entry.month.toString())) {
        return false;
      }
      return true;
    });

    // Build department costs from payroll with employee details
    const departmentCosts: Record<string, { 
      department: string; 
      cost: number; 
      count: number;
      employees: Array<{ name: string; amount: number; entries: number }>;
    }> = {};
    
    filteredPayroll.forEach(entry => {
      const employee = employees.find((e: any) => e.id === entry.employeeId);
      const dept = employee?.department || "Unassigned";
      const empName = employee ? `${employee.firstName} ${employee.lastName}` : "Unknown";
      
      // Filter by selected departments (empty means all)
      if (dialogDepartments.length > 0 && !dialogDepartments.includes(dept)) {
        return;
      }
      
      if (!departmentCosts[dept]) {
        departmentCosts[dept] = { department: dept, cost: 0, count: 0, employees: [] };
      }
      departmentCosts[dept].cost += parseFloat(entry.totalAmount);
      departmentCosts[dept].count += 1;
      
      // Track individual employee costs
      const existingEmp = departmentCosts[dept].employees.find(e => e.name === empName);
      if (existingEmp) {
        existingEmp.amount += parseFloat(entry.totalAmount);
        existingEmp.entries += 1;
      } else {
        departmentCosts[dept].employees.push({ name: empName, amount: parseFloat(entry.totalAmount), entries: 1 });
      }
    });

    return Object.values(departmentCosts);
  };
  
  // Get unique departments from employees
  const allDepartments = [...new Set(employees.map(e => e.department || "Unassigned"))].sort();

  // Generate inventory value data
  const generateInventoryValueData = () => {
    if (!Array.isArray(inventory)) return [];

    const categoryValues = inventory.reduce((acc, item) => {
      const category = item.category || "Uncategorized";
      if (!acc[category]) {
        acc[category] = { category, value: 0, items: 0 };
      }
      acc[category].value += item.currentStock * parseFloat(item.avgCost || "0");
      acc[category].items += 1;
      return acc;
    }, {} as Record<string, any>);

    return Object.values(categoryValues);
  };

  // Generate asset utilization data - uses instance assignments for revenue
  const generateAssetUtilizationData = () => {
    if (!Array.isArray(assetInstances) || assetInstances.length === 0) return [];
    
    // Safely get assignments, defaulting to empty array if not available
    const instanceAssignmentsArr = Array.isArray(assetInstanceAssignments) ? assetInstanceAssignments : [];
    const legacyAssignmentsArr = Array.isArray(assetAssignments) ? assetAssignments : [];
    
    // Apply filters
    const filteredInstances = assetInstances.filter((instance: any) => {
      const assetType = assetTypes.find((t: any) => t.id === instance.assetTypeId);
      const category = assetType?.category || 'Uncategorized';
      
      if (dialogAssetCategory !== 'all' && category !== dialogAssetCategory) return false;
      if (dialogAssetStatus !== 'all' && instance.status !== dialogAssetStatus) return false;
      return true;
    });

    const assetUtilization = filteredInstances.map((instance: any) => {
      const assetType = assetTypes.find((t: any) => t.id === instance.assetTypeId);
      // Get instance assignments (new system)
      const instanceAssigns = instanceAssignmentsArr.filter((a: any) => a.instanceId === instance.id);
      // Also check legacy assignments
      const legacyAssigns = legacyAssignmentsArr.filter((a: any) => a.assetId === instance.id);
      const allAssignments = [...instanceAssigns, ...legacyAssigns];
      
      // Filter assignments by year and month
      const yearFilteredAssignments = allAssignments.filter((assignment: any) => {
        const startDate = new Date(assignment.startDate);
        const endDate = assignment.endDate ? new Date(assignment.endDate) : new Date();
        
        // Check if assignment overlaps with selected year
        const yearStart = new Date(dialogYear, 0, 1);
        const yearEnd = new Date(dialogYear, 11, 31);
        
        // Assignment overlaps with year if it starts before year end and ends after year start
        const overlapsYear = startDate <= yearEnd && endDate >= yearStart;
        if (!overlapsYear) return false;
        
        // If month filter is active, check month overlap too
        if (dialogMonth !== 'all') {
          const monthNum = parseInt(dialogMonth) - 1;
          const monthStart = new Date(dialogYear, monthNum, 1);
          const monthEnd = new Date(dialogYear, monthNum + 1, 0);
          const overlapsMonth = startDate <= monthEnd && endDate >= monthStart;
          return overlapsMonth;
        }
        
        return true;
      });
      
      const totalDays = yearFilteredAssignments.reduce((sum: number, assignment: any) => {
        const start = new Date(assignment.startDate);
        const end = assignment.endDate ? new Date(assignment.endDate) : new Date();
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return sum + Math.max(0, days);
      }, 0);

      // Revenue = totalCost from project assignments (rental rate entered when assigning to project)
      const totalRevenue = yearFilteredAssignments.reduce((sum: number, assignment: any) => {
        return sum + parseFloat(assignment.totalCost || '0');
      }, 0);

      return {
        name: assetType?.name || instance.barcode || `Asset #${instance.id}`,
        category: assetType?.category || 'Uncategorized',
        totalDays,
        assignments: yearFilteredAssignments.length,
        revenue: parseFloat(totalRevenue.toFixed(2)),
        utilizationRate: parseFloat((totalDays > 0 ? Math.min(100, (totalDays / 365) * 100) : 0).toFixed(2)),
        status: instance.status
      };
    });

    return assetUtilization.sort((a, b) => b.revenue - a.revenue);
  };

  // Generate asset revenue by category - uses both instance and legacy assignments
  const generateAssetRevenueByCategoryData = () => {
    if (!Array.isArray(assetInstances) || assetInstances.length === 0) return [];
    
    // Safely get assignments
    const instanceAssignmentsArr = Array.isArray(assetInstanceAssignments) ? assetInstanceAssignments : [];
    const legacyAssignmentsArr = Array.isArray(assetAssignments) ? assetAssignments : [];
    
    // Apply filters
    const filteredInstances = assetInstances.filter((instance: any) => {
      const assetType = assetTypes.find((t: any) => t.id === instance.assetTypeId);
      const category = assetType?.category || 'Uncategorized';
      
      if (dialogAssetCategory !== 'all' && category !== dialogAssetCategory) return false;
      if (dialogAssetStatus !== 'all' && instance.status !== dialogAssetStatus) return false;
      return true;
    });

    const categoryRevenue = filteredInstances.reduce((acc: any, instance: any) => {
      const assetType = assetTypes.find((t: any) => t.id === instance.assetTypeId);
      const category = assetType?.category || 'Uncategorized';
      // Combine instance and legacy assignments
      const instanceAssigns = instanceAssignmentsArr.filter((a: any) => a.instanceId === instance.id);
      const legacyAssigns = legacyAssignmentsArr.filter((a: any) => a.assetId === instance.id);
      const allAssignments = [...instanceAssigns, ...legacyAssigns];
      
      // Revenue = totalCost from project assignments
      const revenue = allAssignments.reduce((sum: number, assignment: any) => {
        return sum + parseFloat(assignment.totalCost || '0');
      }, 0);

      if (!acc[category]) {
        acc[category] = {
          category,
          revenue: 0,
          assets: 0,
          assignments: 0
        };
      }

      acc[category].revenue += revenue;
      acc[category].assets += 1;
      acc[category].assignments += allAssignments.length;

      return acc;
    }, {});

    return Object.values(categoryRevenue).map((item: any) => ({
      ...item,
      name: item.category,
      value: parseFloat(item.revenue.toFixed(2)),
      revenue: parseFloat(item.revenue.toFixed(2))
    }));
  };

  // Generate asset instances with category and project assignment details
  const generateAssetCategoryInstancesData = () => {
    if (!Array.isArray(assetInstances) || assetInstances.length === 0) return [];
    
    const instanceAssignmentsArr = Array.isArray(assetInstanceAssignments) ? assetInstanceAssignments : [];
    
    const filteredInstances = assetInstances.filter((instance: any) => {
      const assetType = assetTypes.find((t: any) => t.id === instance.assetTypeId);
      const category = assetType?.category || 'Uncategorized';
      
      if (dialogAssetCategory !== 'all' && category !== dialogAssetCategory) return false;
      if (dialogAssetStatus !== 'all' && instance.status !== dialogAssetStatus) return false;
      return true;
    });

    return filteredInstances.map((instance: any) => {
      const assetType = assetTypes.find((t: any) => t.id === instance.assetTypeId);
      const category = assetType?.category || 'Uncategorized';
      
      const instanceAssigns = instanceAssignmentsArr.filter((a: any) => a.instanceId === instance.id);
      
      const assignmentDetails = instanceAssigns.map((assignment: any) => {
        const project = projects.find((p: any) => p.id === assignment.projectId);
        const monthlyRate = parseFloat(assignment.monthlyRate || '0');
        const dailyRate = monthlyRate / 30;
        const start = new Date(assignment.startDate);
        const end = assignment.endDate ? new Date(assignment.endDate) : new Date();
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const revenue = dailyRate * Math.max(0, days);
        return {
          projectName: project?.title || 'Unknown Project',
          startDate: assignment.startDate,
          endDate: assignment.endDate || 'Ongoing',
          days,
          monthlyRate,
          revenue: parseFloat(revenue.toFixed(2))
        };
      });

      const totalRevenue = assignmentDetails.reduce((sum: number, a: any) => sum + a.revenue, 0);

      return {
        id: instance.id,
        name: `${assetType?.name || 'Unknown'} - ${instance.barcode || instance.serialNumber || `#${instance.id}`}`,
        category,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        assignmentCount: instanceAssigns.length,
        status: instance.status,
        assignments: assignmentDetails
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
  };

  // Generate asset status distribution
  const generateAssetStatusDistribution = () => {
    if (!Array.isArray(assetInstances)) return [];
    
    // Apply category filter only for status distribution
    const filteredInstances = assetInstances.filter((instance: any) => {
      const assetType = assetTypes.find((t: any) => t.id === instance.assetTypeId);
      const category = assetType?.category || 'Uncategorized';
      
      if (dialogAssetCategory !== 'all' && category !== dialogAssetCategory) return false;
      return true;
    });

    const statusCounts = filteredInstances.reduce((acc: any, instance: any) => {
      const status = instance.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const colors = {
      'available': '#10b981',
      'in_use': '#f59e0b',
      'maintenance': '#ef4444',
      'retired': '#6b7280',
      'unknown': '#9ca3af'
    };

    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status.replace('_', ' ').toUpperCase(),
      value: count,
      color: colors[status as keyof typeof colors] || '#6b7280',
      statusKey: status
    }));
  };

  // Generate asset instances grouped by status with assignment/maintenance details
  const generateAssetStatusInstancesData = () => {
    if (!Array.isArray(assetInstances)) return {};
    
    const instanceAssignmentsArr = Array.isArray(assetInstanceAssignments) ? assetInstanceAssignments : [];
    const maintenanceRecordsArr = Array.isArray(maintenanceRecords) ? maintenanceRecords : [];
    
    const filteredInstances = assetInstances.filter((instance: any) => {
      const assetType = assetTypes.find((t: any) => t.id === instance.assetTypeId);
      const category = assetType?.category || 'Uncategorized';
      
      if (dialogAssetCategory !== 'all' && category !== dialogAssetCategory) return false;
      return true;
    });

    const statusGroups: any = {};
    
    filteredInstances.forEach((instance: any) => {
      const status = instance.status || 'unknown';
      const assetType = assetTypes.find((t: any) => t.id === instance.assetTypeId);
      const instanceName = `${assetType?.name || 'Unknown'} - ${instance.barcode || instance.serialNumber || `#${instance.id}`}`;
      
      if (!statusGroups[status]) {
        statusGroups[status] = [];
      }
      
      // For in_use status, get current project assignment
      if (status === 'in_use') {
        const currentAssignment = instanceAssignmentsArr.find((a: any) => 
          a.instanceId === instance.id && (!a.endDate || new Date(a.endDate) >= new Date())
        );
        const project = currentAssignment ? projects.find((p: any) => p.id === currentAssignment.projectId) : null;
        
        statusGroups[status].push({
          id: instance.id,
          name: instanceName,
          projectName: project?.title || 'No Project',
          startDate: currentAssignment?.startDate || '-',
          endDate: currentAssignment?.endDate || 'Ongoing'
        });
      }
      // For maintenance status, get maintenance record details
      else if (status === 'maintenance') {
        const maintenanceRecord = maintenanceRecordsArr.find((r: any) => 
          r.instanceId === instance.id && r.status !== 'completed'
        );
        
        statusGroups[status].push({
          id: instance.id,
          name: instanceName,
          maintenanceType: maintenanceRecord?.maintenanceType || 'Scheduled',
          maintenanceDate: maintenanceRecord?.scheduledDate || maintenanceRecord?.maintenanceDate || '-',
          description: maintenanceRecord?.description || '-'
        });
      }
      // For other statuses, just show the instance name
      else {
        statusGroups[status].push({
          id: instance.id,
          name: instanceName
        });
      }
    });
    
    return statusGroups;
  };

  // Generate asset maintenance cost analysis and ROI
  // - Revenue: totalCost from project assignments (rental rate when assigning to project)
  // - Operating Cost: monthlyRentalAmount from asset instance * usage months (expense rate)
  // - Maintenance Cost: from maintenance records
  // - ROI: (Revenue - Operating Cost - Maintenance) / acquisitionCost
  const generateAssetMaintenanceData = () => {
    if (!Array.isArray(assetInstances) || assetInstances.length === 0) return [];
    
    // Get assignments from asset instance assignments table (has monthlyRate field)
    const instanceAssignmentsArr = Array.isArray(assetInstanceAssignments) ? assetInstanceAssignments : [];
    
    // Get date range filter
    const { start: dateRangeStart, end: dateRangeEnd } = getAssetDateRange();
    
    // Apply filters
    const filteredInstances = assetInstances.filter((instance: any) => {
      const assetType = assetTypes.find((t: any) => t.id === instance.assetTypeId);
      const category = assetType?.category || 'Uncategorized';
      
      if (dialogAssetCategory !== 'all' && category !== dialogAssetCategory) return false;
      if (dialogAssetStatus !== 'all' && instance.status !== dialogAssetStatus) return false;
      return true;
    });

    return filteredInstances.map((instance: any) => {
      const assetType = assetTypes.find((t: any) => t.id === instance.assetTypeId);
      // Use acquisitionCost for ROI calculation
      const acquisitionCost = parseFloat(instance.acquisitionCost || '0');
      
      // Get assignments for this instance - filtered by date range
      let instanceAssigns = instanceAssignmentsArr.filter((a: any) => a.instanceId === instance.id);
      
      // Filter assignments by date range if set
      if (dateRangeStart || dateRangeEnd) {
        instanceAssigns = instanceAssigns.filter((a: any) => {
          const assignStart = new Date(a.startDate);
          const assignEnd = a.endDate ? new Date(a.endDate) : new Date();
          // Check if assignment overlaps with date range
          if (dateRangeStart && assignEnd < dateRangeStart) return false;
          if (dateRangeEnd && assignStart > dateRangeEnd) return false;
          return true;
        });
      }
      
      // Calculate revenue from monthly rental rate prorated by days assigned (within date range)
      // Daily rate = monthlyRate / 30, then multiply by days
      const assignmentDetails = instanceAssigns.map((assignment: any) => {
        const project = projects.find((p: any) => p.id === assignment.projectId);
        const monthlyRate = parseFloat(assignment.monthlyRate || '0');
        const dailyRate = monthlyRate / 30;
        let start = new Date(assignment.startDate);
        let end = assignment.endDate ? new Date(assignment.endDate) : new Date();
        
        // Clip dates to range if filtering
        if (dateRangeStart && start < dateRangeStart) start = dateRangeStart;
        if (dateRangeEnd && end > dateRangeEnd) end = dateRangeEnd;
        
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const revenue = dailyRate * Math.max(0, days);
        return {
          projectName: project?.title || 'Unknown Project',
          startDate: assignment.startDate,
          endDate: assignment.endDate || 'Ongoing',
          days,
          monthlyRate,
          revenue: parseFloat(revenue.toFixed(2))
        };
      });

      const totalRevenue = assignmentDetails.reduce((sum: number, a: any) => sum + a.revenue, 0);

      // Get maintenance cost from asset_inventory_maintenance_records - filtered by date range
      let assetMaintenanceRecords = maintenanceRecords.filter((record: any) => record.instanceId === instance.id);
      
      // Filter maintenance records by date range if set
      if (dateRangeStart || dateRangeEnd) {
        assetMaintenanceRecords = assetMaintenanceRecords.filter((record: any) => {
          const recordDate = record.maintenanceDate || record.scheduledDate;
          if (!recordDate) return false;
          const date = new Date(recordDate);
          if (dateRangeStart && date < dateRangeStart) return false;
          if (dateRangeEnd && date > dateRangeEnd) return false;
          return true;
        });
      }
      
      const maintenanceCost = assetMaintenanceRecords.reduce((sum: number, record: any) => {
        return sum + parseFloat(record.maintenanceCost || '0');
      }, 0);
      
      // Format maintenance details for display
      const maintenanceDetails = assetMaintenanceRecords.map((record: any) => ({
        type: record.maintenanceType || 'General',
        description: record.description || '-',
        date: record.maintenanceDate || record.scheduledDate || '-',
        cost: parseFloat(record.maintenanceCost || '0'),
        status: record.status || 'completed'
      }));
      
      // Calculate net profit and ROI
      const netProfit = totalRevenue - maintenanceCost;
      let roi = 0;

      if (acquisitionCost > 0) {
        roi = (netProfit / acquisitionCost) * 100;
      }

      return {
        id: instance.id,
        name: `${assetType?.name || 'Unknown'} - ${instance.barcode || instance.serialNumber || `#${instance.id}`}`,
        acquisitionCost: parseFloat(acquisitionCost.toFixed(2)),
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        maintenanceCost: parseFloat(maintenanceCost.toFixed(2)),
        maintenanceCount: assetMaintenanceRecords.length,
        netProfit: parseFloat(netProfit.toFixed(2)),
        roi: parseFloat(roi.toFixed(2)),
        status: instance.status,
        assignmentCount: instanceAssigns.length,
        assignments: assignmentDetails,
        maintenanceRecords: maintenanceDetails
      };
    }).sort((a, b) => b.roi - a.roi);
  };

  // Generate monthly asset revenue trend - combines both instance and legacy assignments
  const generateAssetRevenueTrendData = () => {
    // Combine instance and legacy assignments
    let allAssignments = [
      ...(Array.isArray(assetInstanceAssignments) ? assetInstanceAssignments : []),
      ...(Array.isArray(assetAssignments) ? assetAssignments : [])
    ];
    
    if (allAssignments.length === 0) return [];
    
    // Apply category and status filters
    if (dialogAssetCategory !== 'all' || dialogAssetStatus !== 'all') {
      const filteredInstanceIds = assetInstances.filter((instance: any) => {
        const assetType = assetTypes.find((t: any) => t.id === instance.assetTypeId);
        const category = assetType?.category || 'Uncategorized';
        
        if (dialogAssetCategory !== 'all' && category !== dialogAssetCategory) return false;
        if (dialogAssetStatus !== 'all' && instance.status !== dialogAssetStatus) return false;
        return true;
      }).map((i: any) => i.id);
      
      allAssignments = allAssignments.filter((a: any) => 
        filteredInstanceIds.includes(a.instanceId) || filteredInstanceIds.includes(a.assetId)
      );
    }
    
    // Apply year filter - check if assignment overlaps with selected year
    allAssignments = allAssignments.filter((a: any) => {
      const startDate = new Date(a.startDate);
      const endDate = a.endDate ? new Date(a.endDate) : new Date();
      const yearStart = new Date(dialogYear, 0, 1);
      const yearEnd = new Date(dialogYear, 11, 31);
      
      // Assignment overlaps with year if it starts before year end and ends after year start
      return startDate <= yearEnd && endDate >= yearStart;
    });
    
    // Apply month filter - check if assignment overlaps with selected month
    if (dialogMonth !== 'all') {
      const monthNum = parseInt(dialogMonth) - 1;
      const monthStart = new Date(dialogYear, monthNum, 1);
      const monthEnd = new Date(dialogYear, monthNum + 1, 0);
      
      allAssignments = allAssignments.filter((a: any) => {
        const startDate = new Date(a.startDate);
        const endDate = a.endDate ? new Date(a.endDate) : new Date();
        return startDate <= monthEnd && endDate >= monthStart;
      });
    }

    const monthlyRevenue = allAssignments.reduce((acc: any, assignment: any) => {
      const startDate = new Date(assignment.startDate);
      const monthKey = `${startDate.getFullYear()}-${(startDate.getMonth() + 1).toString().padStart(2, '0')}`;

      if (!acc[monthKey]) {
        acc[monthKey] = {
          month: monthKey,
          revenue: 0,
          assignments: 0,
          instances: []
        };
      }

      // Get asset instance details
      const instanceId = assignment.instanceId || assignment.assetId;
      const instance = assetInstances.find((i: any) => i.id === instanceId);
      const assetType = instance ? assetTypes.find((t: any) => t.id === instance.assetTypeId) : null;
      const project = projects.find((p: any) => p.id === assignment.projectId);
      
      acc[monthKey].instances.push({
        assetName: assetType?.name || instance?.barcode || `Asset #${instanceId}`,
        projectName: project?.title || 'Unknown Project',
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        revenue: parseFloat(assignment.totalCost || '0')
      });

      acc[monthKey].revenue += parseFloat(assignment.totalCost || '0');
      acc[monthKey].assignments += 1;

      return acc;
    }, {});

    return Object.values(monthlyRevenue).map((item: any) => ({
      ...item,
      revenue: parseFloat(item.revenue.toFixed(2)),
      instances: item.instances.map((inst: any) => ({
        ...inst,
        revenue: parseFloat(inst.revenue.toFixed(2))
      }))
    })).sort((a: any, b: any) => a.month.localeCompare(b.month));
  };

  // Generate project status distribution (using filtered projects)
  const generateProjectStatusData = () => {
    const filteredProjects = getFilteredProjects();
    const statusGroups = filteredProjects.reduce((acc, project) => {
      const status = project.status || "Unknown";
      if (!acc[status]) {
        acc[status] = [];
      }
      acc[status].push(project);
      return acc;
    }, {} as Record<string, typeof filteredProjects>);

    const colors = {
      'not_started': '#ef4444',
      'in_progress': '#f59e0b',
      'completed': '#10b981',
      'on_hold': '#6b7280',
      'cancelled': '#dc2626',
    };

    return Object.entries(statusGroups).map(([status, projectList]) => ({
      name: status.replace('_', ' ').toUpperCase(),
      status: status,
      value: projectList.length,
      color: colors[status as keyof typeof colors] || '#6b7280',
      projects: projectList.map(p => ({
        id: p.id,
        title: p.title,
        startDate: p.startDate,
        plannedEndDate: p.endDate,
        actualEndDate: p.actualEndDate,
      }))
    }));
  };

  // Fetch statement data from server with pagination
  const fetchStatementData = async (
    statementType: 'customer-statement' | 'supplier-statement',
    page: number,
    filters: {
      customer?: string;
      supplier?: string;
      dateFrom?: string;
      dateTo?: string;
      dueMoreThan?: string;
    }
  ) => {
    setIsStatementFetching(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', statementPageSize.toString());
      
      if (statementType === 'customer-statement') {
        if (filters.customer && filters.customer !== 'all') {
          params.set('customerId', filters.customer);
        }
      } else {
        if (filters.supplier && filters.supplier !== 'all') {
          params.set('supplierId', filters.supplier);
        }
      }
      
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      if (filters.dueMoreThan) params.set('dueMoreThan', filters.dueMoreThan);
      
      const endpoint = statementType === 'customer-statement' 
        ? '/api/reports/customer-statement'
        : '/api/reports/supplier-statement';
      
      const response = await fetch(`${endpoint}?${params.toString()}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch statement data');
      }
      
      const result = await response.json();
      
      // Update pagination and totals state
      setStatementPagination(result.pagination);
      setStatementTotals(result.totals);
      
      // Format data for display - calculate running balance per page
      // Note: This is a running balance for the current page only
      // The overall balance is shown in totals from server
      let runningBalance = 0;
      const transactionData = result.data.map((t: any) => {
        runningBalance += t.debit - t.credit;
        return {
          date: t.date,
          type: t.type === 'invoice' ? 'Invoice' : 'Payment',
          reference: t.reference,
          description: t.customerName || t.supplierName || t.description,
          debit: t.debit,
          credit: t.credit,
          balance: runningBalance,
          customerId: t.customerId,
          customerName: t.customerName,
          supplierId: t.supplierId,
          supplierName: t.supplierName,
        };
      });
      
      return {
        data: transactionData,
        pagination: result.pagination,
        totals: result.totals
      };
    } catch (error) {
      console.error('Error fetching statement:', error);
      return { data: [], pagination: null, totals: null };
    } finally {
      setIsStatementFetching(false);
    }
  };

  const generateReport = (reportType: string, statementFilters?: {
    customer?: string;
    supplier?: string;
    dateFrom?: string;
    dateTo?: string;
    dueMoreThan?: string;
  }) => {
    let reportData: any = {};
    
    // Use passed filter values or fall back to state
    const effectiveStatementCustomer = statementFilters?.customer ?? dialogStatementCustomer;
    const effectiveStatementSupplier = statementFilters?.supplier ?? dialogStatementSupplier;
    const effectiveStatementDateFrom = statementFilters?.dateFrom ?? dialogStatementDateFrom;
    const effectiveStatementDateTo = statementFilters?.dateTo ?? dialogStatementDateTo;
    const effectiveStatementDueMoreThan = statementFilters?.dueMoreThan ?? dialogStatementDueMoreThan;

    switch (reportType) {
      case "project-financial":
        const projectFinancialData = generateProjectFinancialData();
        // Calculate totals from the generated data (which uses GL-based revenue)
        const totalCost = projectFinancialData.reduce((sum, p) => sum + p.actual, 0);
        const totalRevenue = projectFinancialData.reduce((sum, p) => sum + p.revenue, 0);
        const totalProfit = projectFinancialData.reduce((sum, p) => sum + p.profit, 0);
        reportData = {
          title: "Project Financial Summary",
          type: "chart",
          chartType: "bar",
          data: projectFinancialData,
          summary: {
            totalProjects: projectFinancialData.length,
            totalCost: parseFloat(totalCost.toFixed(2)),
            totalRevenue: parseFloat(totalRevenue.toFixed(2)),
            totalProfit: parseFloat(totalProfit.toFixed(2)),
          }
        };
        break;

      case "payroll-summary":
        reportData = {
          title: "Payroll Summary Report",
          type: "chart",
          chartType: "line",
          data: generatePayrollSummaryData(),
          summary: {
            totalEntries: payrollEntries.length,
            totalAmount: parseFloat(payrollEntries.reduce((sum, p) => sum + parseFloat(p.totalAmount), 0).toFixed(2)),
            averagePerEmployee: parseFloat((payrollEntries.length > 0 ? payrollEntries.reduce((sum, p) => sum + parseFloat(p.totalAmount), 0) / employees.length : 0).toFixed(2)),
          }
        };
        break;

      case "department-costs":
        const deptCostData = generateDepartmentCostData();
        const DEPT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];
        reportData = {
          title: "Department Cost Breakdown",
          type: "chart",
          chartType: "pie",
          data: deptCostData,
          chartData: deptCostData.map((dept: any, idx: number) => ({
            name: dept.department,
            value: dept.cost,
            color: DEPT_COLORS[idx % DEPT_COLORS.length]
          })),
          summary: {
            totalDepartments: new Set(employees.map(e => e.department)).size,
            totalAnnualCost: employees.reduce((sum, e) => sum + parseFloat(e.salary || "0") * 12, 0),
            activeEmployees: employees.filter(e => e.isActive).length,
          }
        };
        break;

      case "inventory-value":
        reportData = {
          title: "Inventory Value Analysis",
          type: "chart",
          chartType: "bar",
          data: generateInventoryValueData(),
          summary: {
            totalItems: inventory.length,
            totalValue: inventory.reduce((sum, i) => sum + (i.currentStock * parseFloat(i.avgCost || "0")), 0),
            lowStockItems: inventory.filter(i => i.currentStock <= i.minStockLevel).length,
          }
        };
        break;

      case "project-status":
        const filteredStatusProjects = getFilteredProjects();
        reportData = {
          title: "Project Status Distribution",
          type: "chart",
          chartType: "pie",
          data: generateProjectStatusData(),
          summary: {
            totalProjects: filteredStatusProjects.length,
            activeProjects: filteredStatusProjects.filter(p => p.status === "in_progress").length,
            completedProjects: filteredStatusProjects.filter(p => p.status === "completed").length,
          }
        };
        break;

      case "asset-utilization":
        {
          const utilizationData = generateAssetUtilizationData();
          const filteredTotalRevenue = utilizationData.reduce((sum, asset) => sum + asset.revenue, 0);
          reportData = {
            title: "Asset Utilization Analysis",
            type: "chart",
            chartType: "bar",
            data: utilizationData,
            summary: {
              totalAssets: utilizationData.length,
              totalRevenue: parseFloat(filteredTotalRevenue.toFixed(2)),
              averageUtilization: utilizationData.length > 0 ? parseFloat((utilizationData.reduce((sum, asset) => sum + asset.utilizationRate, 0) / utilizationData.length).toFixed(2)) : 0,
            }
          };
        }
        break;

      case "asset-revenue-category":
        {
          const categoryData = generateAssetRevenueByCategoryData();
          const instanceData = generateAssetCategoryInstancesData();
          const filteredCategoryRevenue = categoryData.reduce((sum: number, cat: any) => sum + cat.revenue, 0);
          const filteredCategoryAssignments = categoryData.reduce((sum: number, cat: any) => sum + cat.assignments, 0);
          reportData = {
            title: "Asset Revenue by Category",
            type: "chart",
            chartType: "pie",
            data: instanceData,
            chartData: categoryData,
            summary: {
              totalCategories: categoryData.length,
              totalRevenue: parseFloat(filteredCategoryRevenue.toFixed(2)),
              totalAssignments: filteredCategoryAssignments,
              totalAssets: instanceData.length
            }
          };
        }
        break;

      case "asset-status":
        {
          const statusData = generateAssetStatusDistribution();
          const statusInstances = generateAssetStatusInstancesData();
          const filteredStatusTotal = statusData.reduce((sum: number, s: any) => sum + s.value, 0);
          const availableCount = statusData.find((s: any) => s.name === 'AVAILABLE')?.value || 0;
          const inUseCount = statusData.find((s: any) => s.name === 'IN USE')?.value || 0;
          reportData = {
            title: "Asset Status Distribution",
            type: "chart",
            chartType: "pie",
            data: statusData,
            statusInstances,
            summary: {
              totalAssets: filteredStatusTotal,
              availableAssets: availableCount,
              inUseAssets: inUseCount,
            }
          };
        }
        break;

      case "asset-maintenance":
        {
          const maintenanceData = generateAssetMaintenanceData();
          const filteredAcquisition = maintenanceData.reduce((sum, asset) => sum + asset.acquisitionCost, 0);
          const filteredMaintenance = maintenanceData.reduce((sum, asset) => sum + asset.maintenanceCost, 0);
          const filteredRevenue = maintenanceData.reduce((sum, asset) => sum + asset.totalRevenue, 0);
          const filteredProfit = maintenanceData.reduce((sum, asset) => sum + asset.netProfit, 0);
          reportData = {
            title: "Asset Maintenance & ROI Analysis",
            type: "chart",
            chartType: "bar",
            data: maintenanceData,
            summary: {
              totalAssets: maintenanceData.length,
              totalRevenue: parseFloat(filteredRevenue.toFixed(2)),
              totalMaintenanceCost: parseFloat(filteredMaintenance.toFixed(2)),
              totalProfit: parseFloat(filteredProfit.toFixed(2)),
              averageROI: maintenanceData.length > 0 ? parseFloat((maintenanceData.reduce((sum, asset) => sum + asset.roi, 0) / maintenanceData.length).toFixed(2)) : 0,
            }
          };
        }
        break;

      case "asset-revenue-trend":
        {
          const trendData = generateAssetRevenueTrendData();
          const filteredTrendRevenue = trendData.reduce((sum: number, month: any) => sum + month.revenue, 0);
          const filteredTrendAssignments = trendData.reduce((sum: number, month: any) => sum + month.assignments, 0);
          reportData = {
            title: "Asset Revenue Trend",
            type: "chart",
            chartType: "line",
            data: trendData,
            summary: {
              totalMonths: trendData.length,
              totalRevenue: parseFloat(filteredTrendRevenue.toFixed(2)),
              totalAssignments: filteredTrendAssignments,
              averageMonthlyRevenue: trendData.length > 0 ? parseFloat((filteredTrendRevenue / trendData.length).toFixed(2)) : 0,
            }
          };
        }
        break;

      case "customer-statement":
        {
          // Use server-side pagination for customer statement
          setStatementPage(1);
          fetchStatementData('customer-statement', 1, {
            customer: effectiveStatementCustomer,
            dateFrom: effectiveStatementDateFrom,
            dateTo: effectiveStatementDateTo,
            dueMoreThan: effectiveStatementDueMoreThan,
          }).then(result => {
            setGeneratedReportData({
              title: "Customer Statement of Account",
              type: "statement",
              statementType: "customer",
              data: result.data,
              summary: {
                totalTransactions: result.pagination?.totalCount || 0,
                totalDebit: result.totals?.debit || 0,
                totalCredit: result.totals?.credit || 0,
                outstandingBalance: result.totals?.balance || 0,
              }
            });
          });
          return; // Return early since we're handling async
        }
        break;

      case "supplier-statement":
        {
          // Use server-side pagination for supplier statement
          setStatementPage(1);
          fetchStatementData('supplier-statement', 1, {
            supplier: effectiveStatementSupplier,
            dateFrom: effectiveStatementDateFrom,
            dateTo: effectiveStatementDateTo,
            dueMoreThan: effectiveStatementDueMoreThan,
          }).then(result => {
            setGeneratedReportData({
              title: "Supplier Statement of Account",
              type: "statement",
              statementType: "supplier",
              data: result.data,
              summary: {
                totalTransactions: result.pagination?.totalCount || 0,
                totalDebit: result.totals?.debit || 0,
                totalCredit: result.totals?.credit || 0,
                outstandingBalance: result.totals?.balance || 0,
              }
            });
          });
          return; // Return early since we're handling async
        }
        break;

      default:
        return;
    }

    setGeneratedReportData(reportData);
    setIsReportDialogOpen(true);
  };

  const exportReport = async (format: string) => {
    if (!generatedReportData) return;

    try {
      // Generate CSV data
      let csvContent = "";

      // Asset Status Distribution - export with instance details
      if (selectedReportType === 'asset-status' && generatedReportData.statusInstances) {
        csvContent = "Status,Asset Name,Project/Maintenance Type,Start Date,End Date,Description\n";
        
        generatedReportData.data.forEach((statusItem: any) => {
          const statusKey = statusItem.statusKey;
          const instances = generatedReportData.statusInstances[statusKey] || [];
          
          instances.forEach((asset: any) => {
            if (statusKey === 'in_use') {
              csvContent += `"${statusItem.name}","${asset.name}","${asset.projectName}","${asset.startDate}","${asset.endDate}",""\n`;
            } else if (statusKey === 'maintenance') {
              csvContent += `"${statusItem.name}","${asset.name}","${asset.maintenanceType}","${asset.maintenanceDate}","","${asset.description}"\n`;
            } else {
              csvContent += `"${statusItem.name}","${asset.name}","","","",""\n`;
            }
          });
        });
      }
      // Asset Maintenance & ROI - export with assignment and maintenance details
      else if (selectedReportType === 'asset-maintenance') {
        csvContent = "Asset Name,Acquisition Cost,Total Revenue,Maintenance Cost,Maintenance Count,Net Profit,ROI %,Status,Assignment Count\n";
        
        generatedReportData.data.forEach((row: any) => {
          csvContent += `"${row.name}",${row.acquisitionCost},${row.totalRevenue},${row.maintenanceCost},${row.maintenanceCount},${row.netProfit},${row.roi},"${row.status}",${row.assignmentCount}\n`;
        });
        
        // Add assignment details section
        csvContent += "\n\nASSIGNMENT DETAILS\n";
        csvContent += "Asset Name,Project Name,Start Date,End Date,Days,Revenue\n";
        
        generatedReportData.data.forEach((row: any) => {
          if (row.assignments && row.assignments.length > 0) {
            row.assignments.forEach((assignment: any) => {
              csvContent += `"${row.name}","${assignment.projectName}","${assignment.startDate}","${assignment.endDate}",${assignment.days},${assignment.revenue}\n`;
            });
          }
        });
        
        // Add maintenance details section
        csvContent += "\n\nMAINTENANCE DETAILS\n";
        csvContent += "Asset Name,Maintenance Type,Date,Cost,Status,Description\n";
        
        generatedReportData.data.forEach((row: any) => {
          if (row.maintenanceRecords && row.maintenanceRecords.length > 0) {
            row.maintenanceRecords.forEach((record: any) => {
              csvContent += `"${row.name}","${record.type}","${record.date}",${record.cost},"${record.status}","${record.description}"\n`;
            });
          }
        });
      }
      // Asset Revenue by Category - export with instance assignment details
      else if (selectedReportType === 'asset-revenue-category') {
        csvContent = "Asset Name,Category,Total Revenue,Assignment Count\n";
        
        generatedReportData.data.forEach((row: any) => {
          csvContent += `"${row.name}","${row.category}",${row.totalRevenue},${row.assignmentCount}\n`;
        });
        
        // Add assignment details section
        csvContent += "\n\nPROJECT ASSIGNMENT DETAILS\n";
        csvContent += "Asset Name,Project Name,Start Date,End Date,Days,Revenue\n";
        
        generatedReportData.data.forEach((row: any) => {
          if (row.assignments && row.assignments.length > 0) {
            row.assignments.forEach((assignment: any) => {
              csvContent += `"${row.name}","${assignment.projectName}","${assignment.startDate}","${assignment.endDate}",${assignment.days},${assignment.revenue}\n`;
            });
          }
        });
      }
      // Statement of Accounts export
      else if (generatedReportData.type === "statement") {
        const isCustomer = selectedReportType === 'customer-statement';
        const entityName = isCustomer ? 
          (dialogStatementCustomer !== 'all' ? customers.find((c: any) => c.id.toString() === dialogStatementCustomer)?.name : 'All Customers') :
          (dialogStatementSupplier !== 'all' ? suppliers.find((s: any) => s.id.toString() === dialogStatementSupplier)?.name : 'All Suppliers');
        
        // Header section
        csvContent = `${isCustomer ? 'Customer' : 'Supplier'} Statement of Account\n`;
        csvContent += `${isCustomer ? 'Customer' : 'Supplier'}: ${entityName}\n`;
        csvContent += `Period: ${dialogStatementDateFrom || 'Start'} to ${dialogStatementDateTo || 'Present'}\n`;
        if (dialogStatementDueMoreThan) {
          csvContent += `Due More Than: ${dialogStatementDueMoreThan} days\n`;
        }
        csvContent += `Generated: ${formatDisplayDate()}\n\n`;
        
        // Summary section
        csvContent += "SUMMARY\n";
        csvContent += `Total Transactions,${generatedReportData.summary.totalTransactions}\n`;
        csvContent += `Total Debit,AED ${generatedReportData.summary.totalDebit.toFixed(2)}\n`;
        csvContent += `Total Credit,AED ${generatedReportData.summary.totalCredit.toFixed(2)}\n`;
        csvContent += `Outstanding Balance,AED ${generatedReportData.summary.outstandingBalance.toFixed(2)}\n\n`;
        
        // Transaction details table
        csvContent += "TRANSACTION DETAILS\n";
        csvContent += `Date,Type,Reference,Description,Debit,Credit,Balance\n`;
        
        generatedReportData.data.forEach((row: any) => {
          csvContent += `${formatDisplayDate(row.date)},"${row.type}","${row.reference}","${row.description}",${row.debit.toFixed(2)},${row.credit.toFixed(2)},${row.balance.toFixed(2)}\n`;
        });
      }
      // Default export for other chart reports
      else if (generatedReportData.type === "chart") {
        const headers = Object.keys(generatedReportData.data[0] || {}).filter(key => 
          key !== 'assignments' && key !== 'maintenanceRecords' && key !== 'statusInstances'
        ).join(",");
        csvContent = headers + "\n";

        generatedReportData.data.forEach((row: any) => {
          const values = Object.entries(row)
            .filter(([key]) => key !== 'assignments' && key !== 'maintenanceRecords' && key !== 'statusInstances')
            .map(([, val]) => typeof val === "string" ? `"${val}"` : val)
            .join(",");
          csvContent += values + "\n";
        });
      }

      // Create and download file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `${generatedReportData.title.toLowerCase().replace(/\s+/g, "_")}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Successful",
        description: `Report exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export report",
        variant: "destructive",
      });
    }
  };

  const reportCategories = [
    {
      title: "Financial Reports",
      icon: DollarSign,
      reports: [
        { 
          id: "payroll-summary",
          name: "Payroll Summary", 
          description: "Monthly payroll breakdown and trends" 
        },
        { 
          id: "department-costs",
          name: "Department Cost Analysis", 
          description: "Cost breakdown by department" 
        },
        {
          id: "trial-balance",
          name: "Trial Balance",
          description: "Every account's debit and credit balance, proving the ledger balances"
        },
        {
          id: "balance-sheet",
          name: "Balance Sheet",
          description: "Assets, liabilities and equity as at a date"
        },
        {
          id: "profit-loss",
          name: "Profit & Loss Report",
          description: "Comprehensive financial performance analysis"
        },
        { 
          id: "payables-receivables",
          name: "Payables & Receivables", 
          description: "Analysis of amounts owed and due" 
        },
        { 
          id: "customer-statement",
          name: "Customer Statement of Account", 
          description: "Detailed statement showing invoices and payments for customers" 
        },
        { 
          id: "supplier-statement",
          name: "Supplier Statement of Account", 
          description: "Detailed statement showing invoices and payments for suppliers" 
        },
      ]
    },
    {
      title: "Asset Reports",
      icon: Wrench,
      reports: [
        { 
          id: "asset-utilization",
          name: "Asset Utilization Analysis", 
          description: "Asset usage rates and revenue generation" 
        },
        { 
          id: "asset-revenue-category",
          name: "Revenue by Asset Category", 
          description: "Revenue breakdown by asset categories" 
        },
        { 
          id: "asset-status",
          name: "Asset Status Distribution", 
          description: "Current status of all assets" 
        },
        { 
          id: "asset-maintenance",
          name: "Maintenance & ROI Analysis", 
          description: "Actual maintenance costs and return on investment analysis" 
        },
        { 
          id: "asset-revenue-trend",
          name: "Asset Revenue Trend", 
          description: "Monthly asset revenue trends over time" 
        },
      ]
    },
    {
      title: "Project Reports",
      icon: Building2,
      reports: [
        { 
          id: "project-financial",
          name: "Project Financial Summary", 
          description: "Budget vs actual costs for all projects" 
        },
        { 
          id: "project-status",
          name: "Project Status Distribution", 
          description: "Overview of project status breakdown" 
        },
        { 
          id: "project-location",
          name: "Project Location Report", 
          description: "Daily activity summary by project location" 
        },
      ]
    },
    {
      title: "Inventory Reports",
      icon: Wrench,
      reports: [
        { 
          id: "inventory-value",
          name: "Inventory Value Report", 
          description: "Current inventory value by category" 
        },
      ]
    },
    {
      title: "Employee Reports",
      icon: Users,
      reports: [
        {
          id: "employee-readiness",
          name: "Employee Readiness",
          description: "When each employee expects to be available to deploy, grouped by month"
        },
      ]
    },
  ];

  const quickStats = [
    {
      title: "Total Projects",
      value: projects.length,
      icon: Building2,
      color: "text-blue-600",
    },
    {
      title: "Active Employees",
      value: employees.filter(e => e.isActive).length,
      icon: Users,
      color: "text-green-600",
    },
    {
      title: "Asset Revenue",
      value: formatCurrency(
        Array.isArray(assetAssignments) ? assetAssignments.reduce((sum: number, assignment: any) => sum + parseFloat(assignment.totalCost || '0'), 0) : 0
      ),
      icon: DollarSign,
      color: "text-purple-600",
    },
    {
      title: "Total Assets",
      value: Array.isArray(assetInstances) ? assetInstances.length : 0,
      icon: Wrench,
      color: "text-orange-600",
    },
  ];

  const renderChart = (data: any) => {
    const chartData = data.chartData || data.data;
    if (!data || !chartData || chartData.length === 0) {
      return <div className="text-center py-8 text-slate-500">No data available</div>;
    }

    switch (data.chartType) {
      case "bar":
        const hasMultipleBars = chartData.length > 0 && Object.keys(chartData[0]).includes('acquisitionCost');
        const dynamicHeight = Math.max(300, chartData.length * (hasMultipleBars ? 80 : 40));
        
        return (
          <ResponsiveContainer width="100%" height={dynamicHeight}>
            <BarChart 
              data={chartData} 
              layout="vertical"
              margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis 
                type="number" 
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                  return value.toString();
                }}
              />
              <YAxis 
                dataKey="name" 
                type="category"
                width={100}
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => value.length > 12 ? value.substring(0, 12) + '...' : value}
              />
              <Tooltip formatter={(value: any, name: string) => {
                if (name === 'revenue' || name === 'estimated' || name === 'actual' || name === 'acquisitionCost' || name === 'totalRevenue' || name === 'actualMaintenance' || name === 'estimatedMaintenance' || name === 'netProfit') {
                  return formatCurrency(value);
                }
                if (name === 'utilizationRate' || name === 'roi') {
                  return `${value}%`;
                }
                return value;
              }} />
              {chartData.length > 0 && Object.keys(chartData[0]).includes('estimated') && (
                <>
                  <Bar dataKey="estimated" fill="#3b82f6" name="Estimated" barSize={15} />
                  <Bar dataKey="actual" fill="#10b981" name="Actual" barSize={15} />
                </>
              )}
              {chartData.length > 0 && Object.keys(chartData[0]).includes('revenue') && !Object.keys(chartData[0]).includes('estimated') && (
                <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" barSize={20} />
              )}
              {chartData.length > 0 && Object.keys(chartData[0]).includes('utilizationRate') && (
                <Bar dataKey="utilizationRate" fill="#f59e0b" name="Utilization %" barSize={20} />
              )}
              {chartData.length > 0 && Object.keys(chartData[0]).includes('acquisitionCost') && (
                <>
                  <Bar dataKey="acquisitionCost" fill="#ef4444" name="Acquisition Cost" barSize={10} />
                  <Bar dataKey="totalRevenue" fill="#10b981" name="Total Revenue" barSize={10} />
                  <Bar dataKey="actualMaintenance" fill="#f59e0b" name="Maintenance" barSize={10} />
                  <Bar dataKey="netProfit" fill="#3b82f6" name="Net Profit" barSize={10} />
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        );

      case "line":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 8 }}
                angle={-45}
                textAnchor="end"
                height={60}
                tickFormatter={(value) => {
                  // Handle both "YYYY-MM" and "Month Year" formats
                  if (value.includes('-')) {
                    const parts = value.split('-');
                    return parts.length === 2 ? `${parts[1]}/${parts[0].slice(2)}` : value;
                  }
                  // Handle "Month Year" format - shorten month
                  const parts = value.split(' ');
                  if (parts.length === 2) {
                    return `${parts[0].slice(0, 3)} ${parts[1].slice(2)}`;
                  }
                  return value.length > 8 ? value.slice(0, 8) + '..' : value;
                }}
              />
              <YAxis 
                tick={{ fontSize: 8 }} 
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                  return value.toString();
                }}
                width={45}
              />
              <Tooltip formatter={(value: any, name: string) => {
                if (name === 'amount' || name === 'Amount' || name === 'revenue' || name === 'Revenue') {
                  return formatCurrency(value);
                }
                return value;
              }} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              {data.data.length > 0 && Object.keys(data.data[0]).includes('amount') && (
                <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} name="Amount" dot={{ r: 3 }} />
              )}
              {data.data.length > 0 && Object.keys(data.data[0]).includes('revenue') && (
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue" dot={{ r: 3 }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        );

      case "pie":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent, cx, x }) => {
                  const shortName = name.length > 8 ? name.substring(0, 8) + '..' : name;
                  return `${shortName} ${(percent * 100).toFixed(0)}%`;
                }}
                outerRadius={80}
                innerRadius={30}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.color || `hsl(${index * 45}, 70%, 60%)`} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return <div className="text-center py-8 text-slate-500">Chart type not supported</div>;
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
          Reports & Analytics
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1">
          Generate comprehensive reports and analyze business data
        </p>
      </div>

      {/* Quick Stats - 2x2 grid on mobile, 4 columns on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {quickStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="overflow-hidden">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className={`p-1.5 sm:p-2 rounded-lg bg-slate-100 dark:bg-slate-800 flex-shrink-0`}>
                    <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                      {stat.title}
                    </p>
                    <p className="text-base sm:text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
                      {stat.value}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Report Categories - Full width with horizontal report cards */}
      <div className="space-y-6">
        {reportCategories.map((category) => {
          const Icon = category.icon;
          return (
            <Card key={category.title}>
              <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6">
                <CardTitle className="flex items-center text-base sm:text-lg">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-slate-100 dark:bg-slate-800 mr-2 sm:mr-3">
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600 dark:text-slate-400" />
                  </div>
                  <span className="truncate">{category.title}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6 pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {category.reports.map((report) => (
                    <button
                      key={report.id}
                      onClick={() => {
                        if (report.id === "profit-loss") {
                          setLocation("/reports/profit-loss");
                          return;
                        }
                        if (report.id === "payables-receivables") {
                          setLocation("/reports/payables-receivables");
                          return;
                        }
                        if (report.id === "project-location") {
                          setLocation("/reports/project-location");
                          return;
                        }
                        if (report.id === "trial-balance") {
                          setLocation("/reports/trial-balance");
                          return;
                        }
                        if (report.id === "balance-sheet") {
                          setLocation("/reports/balance-sheet");
                          return;
                        }
                        if (report.id === "employee-readiness") {
                          setLocation("/reports/employee-readiness");
                          return;
                        }
                        setDialogYear(new Date().getFullYear());
                        setDialogMonth("all");
                        setDialogMonths([]);
                        setDialogEmployeeType("all");
                        setDialogDepartments([]);
                        setDialogStartDate("");
                        setDialogEndDate("");
                        setDialogProject("all");
                        setDialogAssetCategory("all");
                        setDialogAssetStatus("all");
                        setDialogStatementCustomer("all");
                        setDialogStatementSupplier("all");
                        setDialogStatementDateFrom("");
                        setDialogStatementDateTo("");
                        setDialogStatementDueMoreThan("");
                        setStatementPage(1);
                        // Navigate to dedicated pages for statement reports
                        if (report.id === 'customer-statement') {
                          setLocation('/reports/customer-statement');
                          return;
                        }
                        if (report.id === 'supplier-statement') {
                          setLocation('/reports/supplier-statement');
                          return;
                        }
                        setSelectedReportType(report.id);
                        generateReport(report.id);
                      }}
                      className="text-left p-3 sm:p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group h-full"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium text-slate-900 dark:text-slate-100 text-sm sm:text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {report.name}
                          </h4>
                          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                            {report.description}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex-shrink-0 transition-colors mt-0.5" />
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Report Preview Dialog */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader className="pb-2">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <DialogTitle className="text-lg sm:text-xl truncate pr-4">
                  {generatedReportData?.title}
                </DialogTitle>
                <div className="flex flex-wrap gap-2">
                  {/* Filter toggle button - for reports with filters */}
                  {(selectedReportType === 'payroll-summary' || selectedReportType === 'department-costs' || selectedReportType === 'project-financial' || selectedReportType === 'project-status' || selectedReportType === 'customer-statement' || selectedReportType === 'supplier-statement' || (selectedReportType.startsWith('asset-') && selectedReportType !== 'asset-status')) && (
                    <Button 
                      variant={showDialogFilters ? "default" : "outline"} 
                      size="sm"
                      onClick={() => setShowDialogFilters(!showDialogFilters)}
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      {showDialogFilters ? "Hide Filters" : "Filters"}
                      {((selectedReportType === 'project-financial' || selectedReportType === 'project-status') && hasActiveProjectFilters) && (
                        <span className="ml-2 bg-primary-foreground text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs">!</span>
                      )}
                      {((selectedReportType === 'customer-statement' || selectedReportType === 'supplier-statement') && hasActiveStatementFilters) && (
                        <span className="ml-2 bg-primary-foreground text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs">!</span>
                      )}
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => exportReport("csv")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Export</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.print()}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Print</span>
                  </Button>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Inline Filters - toggleable with improved responsive design */}
          {showDialogFilters && (selectedReportType === 'payroll-summary' || selectedReportType === 'department-costs' || selectedReportType === 'project-financial' || selectedReportType === 'project-status' || selectedReportType === 'customer-statement' || selectedReportType === 'supplier-statement' || selectedReportType.startsWith('asset-')) && (
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 sm:p-4 space-y-4">
            {/* Project filters - for project-financial and project-status reports */}
            {(selectedReportType === 'project-financial' || selectedReportType === 'project-status') && (
              <>
                {/* Row 1: Project, Status, Customer */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Project</Label>
                    <Select value={dialogProject} onValueChange={(v) => { setDialogProject(v); generateReport(selectedReportType); }}>
                      <SelectTrigger className="w-full h-9 text-sm">
                        <SelectValue placeholder="All Projects" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Projects</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id.toString()}>{project.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Status</Label>
                    <Select value={dialogProjectStatus} onValueChange={(v) => { setDialogProjectStatus(v); generateReport(selectedReportType); }}>
                      <SelectTrigger className="w-full h-9 text-sm">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="not_started">Not Started</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="on_hold">On Hold</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Customer</Label>
                    <Select value={dialogProjectCustomer} onValueChange={(v) => { setDialogProjectCustomer(v); generateReport(selectedReportType); }}>
                      <SelectTrigger className="w-full h-9 text-sm">
                        <SelectValue placeholder="All Customers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Customers</SelectItem>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id.toString()}>{customer.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Row 2: Date range and Clear button */}
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="grid grid-cols-2 gap-3 flex-1">
                    <div>
                      <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">From Date</Label>
                      <Input
                        type="date"
                        value={dialogProjectDateFrom}
                        onChange={(e) => { setDialogProjectDateFrom(e.target.value); generateReport(selectedReportType); }}
                        className="w-full h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">To Date</Label>
                      <Input
                        type="date"
                        value={dialogProjectDateTo}
                        onChange={(e) => { setDialogProjectDateTo(e.target.value); generateReport(selectedReportType); }}
                        className="w-full h-9 text-sm"
                      />
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setDialogProject("all");
                      setDialogProjectStatus("all");
                      setDialogProjectCustomer("all");
                      setDialogProjectDateFrom("");
                      setDialogProjectDateTo("");
                      generateReport(selectedReportType);
                    }}
                    disabled={!hasActiveProjectFilters}
                    className="h-9 whitespace-nowrap"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                </div>
              </>
            )}
            
            {/* Payroll filters */}
            {selectedReportType === 'payroll-summary' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Year</Label>
                    <Select value={dialogYear.toString()} onValueChange={(v) => { setDialogYear(parseInt(v)); generateReport(selectedReportType); }}>
                      <SelectTrigger className="w-full h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 5 }, (_, i) => {
                          const year = new Date().getFullYear() - 2 + i;
                          return <SelectItem key={year} value={year.toString()}>{year}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Employee Type</Label>
                    <Select value={dialogEmployeeType} onValueChange={(v) => { setDialogEmployeeType(v); generateReport(selectedReportType); }}>
                      <SelectTrigger className="w-full h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="permanent">Permanent</SelectItem>
                        <SelectItem value="contractor">Contractor</SelectItem>
                        <SelectItem value="consultant">Consultant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">
                    Months {dialogMonths.length > 0 ? `(${dialogMonths.length} selected)` : '(All)'}
                  </Label>
                  <div className="flex flex-wrap gap-1.5 p-2 border rounded-md bg-white dark:bg-slate-900">
                    {Array.from({ length: 12 }, (_, i) => {
                      const monthNum = (i + 1).toString();
                      const isSelected = dialogMonths.includes(monthNum);
                      return (
                        <button
                          key={i + 1}
                          type="button"
                          onClick={() => {
                            const newMonths = isSelected 
                              ? dialogMonths.filter(m => m !== monthNum)
                              : [...dialogMonths, monthNum];
                            setDialogMonths(newMonths);
                            generateReport(selectedReportType);
                          }}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${isSelected ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                          {getMonthName(i + 1).slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            
            {/* Department costs filters */}
            {selectedReportType === 'department-costs' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Year</Label>
                    <Select value={dialogYear.toString()} onValueChange={(v) => { setDialogYear(parseInt(v)); generateReport(selectedReportType); }}>
                      <SelectTrigger className="w-full h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 5 }, (_, i) => {
                          const year = new Date().getFullYear() - 2 + i;
                          return <SelectItem key={year} value={year.toString()}>{year}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">
                    Months {dialogMonths.length > 0 ? `(${dialogMonths.length} selected)` : '(All)'}
                  </Label>
                  <div className="flex flex-wrap gap-1.5 p-2 border rounded-md bg-white dark:bg-slate-900">
                    {Array.from({ length: 12 }, (_, i) => {
                      const monthNum = (i + 1).toString();
                      const isSelected = dialogMonths.includes(monthNum);
                      return (
                        <button
                          key={i + 1}
                          type="button"
                          onClick={() => {
                            const newMonths = isSelected 
                              ? dialogMonths.filter(m => m !== monthNum)
                              : [...dialogMonths, monthNum];
                            setDialogMonths(newMonths);
                            generateReport(selectedReportType);
                          }}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${isSelected ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                          {getMonthName(i + 1).slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">
                    Departments {dialogDepartments.length > 0 ? `(${dialogDepartments.length} selected)` : '(All)'}
                  </Label>
                  <div className="flex flex-wrap gap-1.5 p-2 border rounded-md bg-white dark:bg-slate-900 max-h-[80px] overflow-y-auto">
                    {allDepartments.map((dept) => {
                      const isSelected = dialogDepartments.includes(dept);
                      return (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => {
                            const newDepts = isSelected 
                              ? dialogDepartments.filter(d => d !== dept)
                              : [...dialogDepartments, dept];
                            setDialogDepartments(newDepts);
                            generateReport(selectedReportType);
                          }}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${isSelected ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                          {dept}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            
            {/* Asset report filters */}
            {selectedReportType.startsWith('asset-') && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Date Range</Label>
                    <Select value={dialogAssetDateRangeType} onValueChange={(v) => { setDialogAssetDateRangeType(v); generateReport(selectedReportType); }}>
                      <SelectTrigger className="w-full h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="financial_year">Financial Year</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {dialogAssetDateRangeType === 'financial_year' && (
                    <div>
                      <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Financial Year</Label>
                      <Select value={dialogAssetFinancialYear} onValueChange={(v) => { setDialogAssetFinancialYear(v); generateReport(selectedReportType); }}>
                        <SelectTrigger className="w-full h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 6 }, (_, i) => {
                            const year = new Date().getFullYear() - 3 + i;
                            return <SelectItem key={year} value={year.toString()}>FY {year}</SelectItem>;
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {dialogAssetDateRangeType === 'custom' && (
                    <>
                      <div>
                        <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">From Date</Label>
                        <Input 
                          type="date" 
                          value={dialogAssetDateFrom}
                          onChange={(e) => { setDialogAssetDateFrom(e.target.value); generateReport(selectedReportType); }}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">To Date</Label>
                        <Input 
                          type="date" 
                          value={dialogAssetDateTo}
                          onChange={(e) => { setDialogAssetDateTo(e.target.value); generateReport(selectedReportType); }}
                          className="h-9 text-sm"
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Category</Label>
                    <Select value={dialogAssetCategory} onValueChange={(v) => { setDialogAssetCategory(v); generateReport(selectedReportType); }}>
                      <SelectTrigger className="w-full h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {Array.from(new Set((assetTypes as any[]).map((t: any) => t.category).filter(Boolean))).map((category: any) => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Status</Label>
                    <Select value={dialogAssetStatus} onValueChange={(v) => { setDialogAssetStatus(v); generateReport(selectedReportType); }}>
                      <SelectTrigger className="w-full h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="in_use">In Use</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="retired">Retired</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
            
            {/* Customer Statement filters */}
            {selectedReportType === 'customer-statement' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Customer</Label>
                    <Select value={dialogStatementCustomer} onValueChange={(v) => { 
                      setDialogStatementCustomer(v); 
                      regenerateStatementReport(selectedReportType, {
                        customer: v,
                        supplier: dialogStatementSupplier,
                        dateFrom: dialogStatementDateFrom,
                        dateTo: dialogStatementDateTo,
                        dueMoreThan: dialogStatementDueMoreThan
                      }); 
                    }}>
                      <SelectTrigger className="w-full h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Customers</SelectItem>
                        {customers.map((customer: any) => (
                          <SelectItem key={customer.id} value={customer.id.toString()}>{customer.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Date From</Label>
                    <Input 
                      type="date" 
                      value={dialogStatementDateFrom}
                      onChange={(e) => { 
                        setDialogStatementDateFrom(e.target.value); 
                        regenerateStatementReport(selectedReportType, {
                          customer: dialogStatementCustomer,
                          supplier: dialogStatementSupplier,
                          dateFrom: e.target.value,
                          dateTo: dialogStatementDateTo,
                          dueMoreThan: dialogStatementDueMoreThan
                        }); 
                      }}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Date To</Label>
                    <Input 
                      type="date" 
                      value={dialogStatementDateTo}
                      onChange={(e) => { 
                        setDialogStatementDateTo(e.target.value); 
                        regenerateStatementReport(selectedReportType, {
                          customer: dialogStatementCustomer,
                          supplier: dialogStatementSupplier,
                          dateFrom: dialogStatementDateFrom,
                          dateTo: e.target.value,
                          dueMoreThan: dialogStatementDueMoreThan
                        }); 
                      }}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Due More Than (days)</Label>
                    <Input 
                      type="number" 
                      placeholder="e.g. 30"
                      value={dialogStatementDueMoreThan}
                      onChange={(e) => { 
                        setDialogStatementDueMoreThan(e.target.value); 
                        regenerateStatementReport(selectedReportType, {
                          customer: dialogStatementCustomer,
                          supplier: dialogStatementSupplier,
                          dateFrom: dialogStatementDateFrom,
                          dateTo: dialogStatementDateTo,
                          dueMoreThan: e.target.value
                        }); 
                      }}
                      className="h-9 text-sm"
                      min="0"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setDialogStatementCustomer("all");
                      setDialogStatementDateFrom("");
                      setDialogStatementDateTo("");
                      setDialogStatementDueMoreThan("");
                      regenerateStatementReport(selectedReportType, {
                        customer: "all",
                        supplier: "all",
                        dateFrom: "",
                        dateTo: "",
                        dueMoreThan: ""
                      });
                    }}
                    disabled={!hasActiveStatementFilters}
                    className="h-8"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                </div>
              </>
            )}
            
            {/* Supplier Statement filters */}
            {selectedReportType === 'supplier-statement' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Supplier</Label>
                    <Select value={dialogStatementSupplier} onValueChange={(v) => { 
                      setDialogStatementSupplier(v); 
                      regenerateStatementReport(selectedReportType, {
                        customer: dialogStatementCustomer,
                        supplier: v,
                        dateFrom: dialogStatementDateFrom,
                        dateTo: dialogStatementDateTo,
                        dueMoreThan: dialogStatementDueMoreThan
                      }); 
                    }}>
                      <SelectTrigger className="w-full h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Suppliers</SelectItem>
                        {suppliers.map((supplier: any) => (
                          <SelectItem key={supplier.id} value={supplier.id.toString()}>{supplier.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Date From</Label>
                    <Input 
                      type="date" 
                      value={dialogStatementDateFrom}
                      onChange={(e) => { 
                        setDialogStatementDateFrom(e.target.value); 
                        regenerateStatementReport(selectedReportType, {
                          customer: dialogStatementCustomer,
                          supplier: dialogStatementSupplier,
                          dateFrom: e.target.value,
                          dateTo: dialogStatementDateTo,
                          dueMoreThan: dialogStatementDueMoreThan
                        }); 
                      }}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Date To</Label>
                    <Input 
                      type="date" 
                      value={dialogStatementDateTo}
                      onChange={(e) => { 
                        setDialogStatementDateTo(e.target.value); 
                        regenerateStatementReport(selectedReportType, {
                          customer: dialogStatementCustomer,
                          supplier: dialogStatementSupplier,
                          dateFrom: dialogStatementDateFrom,
                          dateTo: e.target.value,
                          dueMoreThan: dialogStatementDueMoreThan
                        }); 
                      }}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Due More Than (days)</Label>
                    <Input 
                      type="number" 
                      placeholder="e.g. 30"
                      value={dialogStatementDueMoreThan}
                      onChange={(e) => { 
                        setDialogStatementDueMoreThan(e.target.value); 
                        regenerateStatementReport(selectedReportType, {
                          customer: dialogStatementCustomer,
                          supplier: dialogStatementSupplier,
                          dateFrom: dialogStatementDateFrom,
                          dateTo: dialogStatementDateTo,
                          dueMoreThan: e.target.value
                        }); 
                      }}
                      className="h-9 text-sm"
                      min="0"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setDialogStatementSupplier("all");
                      setDialogStatementDateFrom("");
                      setDialogStatementDateTo("");
                      setDialogStatementDueMoreThan("");
                      regenerateStatementReport(selectedReportType, {
                        customer: "all",
                        supplier: "all",
                        dateFrom: "",
                        dateTo: "",
                        dueMoreThan: ""
                      });
                    }}
                    disabled={!hasActiveStatementFilters}
                    className="h-8"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                </div>
              </>
            )}
          </div>)}

          {generatedReportData && (
            <div className="space-y-6">
              {/* Summary Stats - with collapse option for project reports */}
              {generatedReportData.summary && (selectedReportType === 'project-financial' || selectedReportType === 'project-status') && (
                <div className="bg-white dark:bg-slate-900 rounded-lg border overflow-hidden">
                  <div className="flex items-center justify-between p-3 border-b bg-slate-50 dark:bg-slate-800">
                    <div className="flex items-center gap-2">
                      <LayoutList className="h-4 w-4 text-slate-500" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Summary</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSummaryCards(!showSummaryCards)}
                      className="h-8 px-3"
                    >
                      {showSummaryCards ? (
                        <>
                          <ChevronDown className="h-4 w-4 mr-1" />
                          <span className="text-xs">Hide</span>
                        </>
                      ) : (
                        <>
                          <ChevronRight className="h-4 w-4 mr-1" />
                          <span className="text-xs">Show</span>
                        </>
                      )}
                    </Button>
                  </div>
                  {showSummaryCards && (
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4">
                      {Object.entries(generatedReportData.summary).map(([key, value]) => {
                        const isMoneyField = typeof value === "number" && (
                          key.toLowerCase().includes("amount") || 
                          key.toLowerCase().includes("cost") || 
                          key.toLowerCase().includes("budget") || 
                          key.toLowerCase().includes("value") ||
                          key.toLowerCase().includes("revenue") ||
                          key.toLowerCase().includes("profit")
                        );
                        const isProfitField = key.toLowerCase().includes("profit");
                        const numValue = value as number;
                        
                        return (
                          <div key={key} className="text-center">
                            <p className="text-xs text-slate-500 dark:text-slate-400 capitalize truncate">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </p>
                            <p className={`text-sm sm:text-base font-bold truncate ${isProfitField && numValue < 0 ? 'text-red-600 dark:text-red-400' : isProfitField && numValue > 0 ? 'text-green-600 dark:text-green-400' : 'text-slate-900 dark:text-slate-100'}`}>
                              {isMoneyField ? formatCurrency(numValue) : value?.toString()}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              
              {/* Summary Stats - with toggle for other reports */}
              {generatedReportData.summary && selectedReportType !== 'project-financial' && selectedReportType !== 'project-status' && (
                <div className="bg-white dark:bg-slate-900 rounded-lg border overflow-hidden">
                  <div className="flex items-center justify-between p-3 border-b bg-slate-50 dark:bg-slate-800">
                    <div className="flex items-center gap-2">
                      <LayoutList className="h-4 w-4 text-slate-500" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Summary</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSummaryCards(!showSummaryCards)}
                      className="h-8 px-3"
                    >
                      {showSummaryCards ? (
                        <>
                          <ChevronDown className="h-4 w-4 mr-1" />
                          <span className="text-xs">Hide</span>
                        </>
                      ) : (
                        <>
                          <ChevronRight className="h-4 w-4 mr-1" />
                          <span className="text-xs">Show</span>
                        </>
                      )}
                    </Button>
                  </div>
                  {showSummaryCards && (
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4">
                      {Object.entries(generatedReportData.summary).map(([key, value]) => {
                        const isMoneyField = typeof value === "number" && (
                          key.toLowerCase().includes("amount") || 
                          key.toLowerCase().includes("cost") || 
                          key.toLowerCase().includes("budget") || 
                          key.toLowerCase().includes("value") ||
                          key.toLowerCase().includes("revenue") ||
                          key.toLowerCase().includes("profit")
                        );
                        const isProfitField = key.toLowerCase().includes("profit");
                        const numValue = value as number;
                        
                        return (
                          <div key={key} className="text-center">
                            <p className="text-xs text-slate-500 dark:text-slate-400 capitalize truncate">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </p>
                            <p className={`text-sm sm:text-base font-bold truncate ${isProfitField && numValue < 0 ? 'text-red-600 dark:text-red-400' : isProfitField && numValue > 0 ? 'text-green-600 dark:text-green-400' : 'text-slate-900 dark:text-slate-100'}`}>
                              {isMoneyField ? formatCurrency(numValue) : value?.toString()}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Chart - hidden for statement reports */}
              {selectedReportType !== 'customer-statement' && selectedReportType !== 'supplier-statement' && (
                <div className="bg-white dark:bg-slate-900 rounded-lg border overflow-hidden">
                  {/* Chart Header with collapse toggle */}
                  <div className="flex items-center justify-between p-3 border-b bg-slate-50 dark:bg-slate-800">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-slate-500" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Chart View</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowChart(!showChart)}
                      className="h-8 px-3"
                    >
                      {showChart ? (
                        <>
                          <ChevronDown className="h-4 w-4 mr-1" />
                          <span className="text-xs">Hide</span>
                        </>
                      ) : (
                        <>
                          <ChevronRight className="h-4 w-4 mr-1" />
                          <span className="text-xs">Show</span>
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {/* Chart content - collapsible */}
                  {showChart && (
                    <div className="p-2 sm:p-4">
                      <div className="w-full">
                        {renderChart(generatedReportData)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Department Cost Breakdown - Expandable Details */}
              {selectedReportType === 'department-costs' && generatedReportData.data && generatedReportData.data.length > 0 && (
                <div ref={detailsSectionRef} className="space-y-3 overflow-hidden scroll-mt-4">
                  <div className="flex items-center gap-2">
                    <LayoutList className="h-4 w-4 text-slate-500" />
                    <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Details (click to expand)</h4>
                  </div>
                  <div className="space-y-2 max-h-[350px] overflow-y-auto overflow-x-hidden">
                    {generatedReportData.data.map((dept: any, index: number) => {
                      const isExpanded = expandedDepartments.includes(dept.department);
                      return (
                        <div key={index} className="bg-slate-50 dark:bg-slate-800 rounded-lg border overflow-hidden">
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedDepartments(prev => 
                                isExpanded 
                                  ? prev.filter(d => d !== dept.department)
                                  : [...prev, dept.department]
                              );
                            }}
                            className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate">
                                {dept.department}
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-slate-500 dark:text-slate-400">
                                <span>Total: {formatCurrency(dept.cost)}</span>
                                <span>Payroll Entries: {dept.count}</span>
                                <span>Employees: {dept.employees?.length || 0}</span>
                              </div>
                            </div>
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0 ml-2" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0 ml-2" />
                            )}
                          </button>
                          {isExpanded && dept.employees && dept.employees.length > 0 && (
                            <div className="border-t bg-white dark:bg-slate-900 p-3">
                              <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Employee Breakdown</div>
                              <div className="space-y-2">
                                {dept.employees.sort((a: any, b: any) => b.amount - a.amount).map((emp: any, empIdx: number) => (
                                  <div key={empIdx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-1.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
                                    <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{emp.name}</span>
                                    <div className="flex gap-3 text-xs text-slate-500 dark:text-slate-400">
                                      <span>{formatCurrency(emp.amount)}</span>
                                      <span className="text-slate-400">({emp.entries} {emp.entries === 1 ? 'entry' : 'entries'})</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Project Status Distribution - Expandable Status Sections */}
              {selectedReportType === 'project-status' && generatedReportData.data && generatedReportData.data.length > 0 && (
                <div ref={detailsSectionRef} className="space-y-3 overflow-hidden scroll-mt-4">
                  <div className="flex items-center gap-2">
                    <LayoutList className="h-4 w-4 text-slate-500" />
                    <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Status Details (click to expand)</h4>
                  </div>
                  <div className="space-y-2 max-h-[350px] overflow-y-auto overflow-x-hidden">
                    {generatedReportData.data.map((statusGroup: any, index: number) => {
                      const isExpanded = expandedStatuses.includes(statusGroup.status);
                      return (
                        <div key={index} className="border rounded-lg overflow-hidden">
                          <button
                            onClick={() => {
                              if (isExpanded) {
                                setExpandedStatuses(expandedStatuses.filter(s => s !== statusGroup.status));
                              } else {
                                setExpandedStatuses([...expandedStatuses, statusGroup.status]);
                              }
                            }}
                            className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-3 h-3 rounded-full flex-shrink-0" 
                                style={{ backgroundColor: statusGroup.color }}
                              />
                              <div className="text-left">
                                <span className="font-medium text-slate-900 dark:text-slate-100">{statusGroup.name}</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                                  ({statusGroup.value} {statusGroup.value === 1 ? 'project' : 'projects'})
                                </span>
                              </div>
                            </div>
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0 ml-2" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0 ml-2" />
                            )}
                          </button>
                          {isExpanded && statusGroup.projects && statusGroup.projects.length > 0 && (
                            <div className="border-t bg-white dark:bg-slate-900 p-3">
                              <div className="space-y-2">
                                {statusGroup.projects.map((project: any, projIdx: number) => {
                                  const formatDate = (date: any) => {
                                    if (!date) return '-';
                                    return formatDisplayDate(date);
                                  };
                                  return (
                                    <div key={projIdx} className="flex flex-col gap-1 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{project.title}</span>
                                      <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                                        <span>Start: {formatDate(project.startDate)}</span>
                                        <span>Planned End: {formatDate(project.plannedEndDate)}</span>
                                        <span>Actual End: {formatDate(project.actualEndDate)}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Asset Status Distribution - Expandable Status Sections */}
              {selectedReportType === 'asset-status' && generatedReportData.data && generatedReportData.data.length > 0 && (
                <div ref={detailsSectionRef} className="space-y-3 overflow-hidden scroll-mt-4">
                  <div className="flex items-center gap-2">
                    <LayoutList className="h-4 w-4 text-slate-500" />
                    <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Asset Instances by Status (click to expand)</h4>
                  </div>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto overflow-x-hidden">
                    {generatedReportData.data.map((statusItem: any, index: number) => {
                      const statusKey = statusItem.statusKey;
                      const isExpanded = expandedAssetStatuses.includes(statusKey);
                      const instances = generatedReportData.statusInstances?.[statusKey] || [];
                      
                      return (
                        <div key={index} className="border rounded-lg overflow-hidden">
                          <button
                            onClick={() => {
                              if (isExpanded) {
                                setExpandedAssetStatuses(expandedAssetStatuses.filter(s => s !== statusKey));
                              } else {
                                setExpandedAssetStatuses([...expandedAssetStatuses, statusKey]);
                              }
                            }}
                            className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-3 h-3 rounded-full flex-shrink-0" 
                                style={{ backgroundColor: statusItem.color }}
                              />
                              <div className="text-left">
                                <span className="font-medium text-slate-900 dark:text-slate-100">{statusItem.name}</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                                  ({statusItem.value} {statusItem.value === 1 ? 'asset' : 'assets'})
                                </span>
                              </div>
                            </div>
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0 ml-2" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0 ml-2" />
                            )}
                          </button>
                          {isExpanded && instances.length > 0 && (
                            <div className="border-t bg-white dark:bg-slate-900 p-3">
                              <div className="space-y-2">
                                {instances.map((asset: any, assetIdx: number) => (
                                  <div key={assetIdx} className="flex flex-col gap-1 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{asset.name}</span>
                                    {/* IN USE - Show project assignment with dates */}
                                    {statusKey === 'in_use' && (
                                      <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                                        <span className="text-blue-600 dark:text-blue-400 font-medium">Project: {asset.projectName}</span>
                                        <span>Start: {asset.startDate}</span>
                                        <span>End: {asset.endDate}</span>
                                      </div>
                                    )}
                                    {/* MAINTENANCE - Show maintenance details */}
                                    {statusKey === 'maintenance' && (
                                      <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                                        <span className="text-orange-600 dark:text-orange-400 font-medium">{asset.maintenanceType}</span>
                                        <span>Date: {asset.maintenanceDate}</span>
                                        {asset.description !== '-' && <span className="italic">{asset.description}</span>}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Asset Revenue Trend - Expandable Monthly Details */}
              {selectedReportType === 'asset-revenue-trend' && generatedReportData.data && generatedReportData.data.length > 0 && (
                <div ref={detailsSectionRef} className="space-y-3 overflow-hidden scroll-mt-4">
                  <div className="flex items-center gap-2">
                    <LayoutList className="h-4 w-4 text-slate-500" />
                    <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Monthly Asset Instances (click to expand)</h4>
                  </div>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto overflow-x-hidden">
                    {generatedReportData.data.map((monthItem: any, index: number) => {
                      const isExpanded = expandedTrendMonths.includes(monthItem.month);
                      const instances = monthItem.instances || [];
                      
                      return (
                        <div key={index} className="border rounded-lg overflow-hidden">
                          <button
                            onClick={() => {
                              if (isExpanded) {
                                setExpandedTrendMonths(expandedTrendMonths.filter(m => m !== monthItem.month));
                              } else {
                                setExpandedTrendMonths([...expandedTrendMonths, monthItem.month]);
                              }
                            }}
                            className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-3 h-3 rounded-full flex-shrink-0 bg-blue-500" />
                              <div className="text-left">
                                <span className="font-medium text-slate-900 dark:text-slate-100">{monthItem.month}</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                                  ({monthItem.assignments} {monthItem.assignments === 1 ? 'assignment' : 'assignments'})
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                AED {monthItem.revenue.toFixed(2)}
                              </span>
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                              )}
                            </div>
                          </button>
                          {isExpanded && instances.length > 0 && (
                            <div className="border-t bg-white dark:bg-slate-900 p-3">
                              <div className="space-y-2">
                                {instances.map((inst: any, instIdx: number) => (
                                  <div key={instIdx} className="flex flex-col gap-1 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                                    <div className="flex justify-between items-start">
                                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{inst.assetName}</span>
                                      <span className="text-sm font-medium text-green-600 dark:text-green-400 flex-shrink-0 ml-2">
                                        AED {inst.revenue.toFixed(2)}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                                      <span className="text-blue-600 dark:text-blue-400 font-medium">Project: {inst.projectName}</span>
                                      <span>Start: {inst.startDate}</span>
                                      {inst.endDate && <span>End: {inst.endDate}</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Generic Data Cards - for other reports (not statements) */}
              {selectedReportType !== 'department-costs' && selectedReportType !== 'project-status' && selectedReportType !== 'asset-status' && selectedReportType !== 'asset-revenue-trend' && selectedReportType !== 'customer-statement' && selectedReportType !== 'supplier-statement' && generatedReportData.data && generatedReportData.data.length > 0 && (
                <div ref={detailsSectionRef} className="space-y-3 overflow-hidden scroll-mt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <LayoutList className="h-4 w-4 text-slate-500" />
                      <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {selectedReportType.startsWith('asset-') ? 'Asset Instances' : 'Details'}
                      </h4>
                    </div>
                    <span className="text-xs text-slate-500">{generatedReportData.data.length} {generatedReportData.data.length === 1 ? 'record' : 'records'}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto overflow-x-hidden">
                    {generatedReportData.data.map((row: any, index: number) => {
                      const formatValue = (key: string, value: any) => {
                        if (typeof value === "number") {
                          if (key.toLowerCase().includes("count") || key.toLowerCase().includes("days") || key.toLowerCase().includes("assignments") || key.toLowerCase().includes("entries")) {
                            return value.toString();
                          }
                          if (key.toLowerCase().includes("rate") || key.toLowerCase().includes("roi") || key.toLowerCase().includes("utilization")) {
                            return `${value.toFixed(2)}%`;
                          }
                          if (key.toLowerCase().includes("amount") || key.toLowerCase().includes("cost") || key.toLowerCase().includes("revenue") || key.toLowerCase().includes("profit") || key.toLowerCase().includes("value") || key.toLowerCase().includes("maintenance") || key.toLowerCase().includes("acquisition")) {
                            return formatCurrency(value);
                          }
                        }
                        return value?.toString() || '-';
                      };
                      
                      const entries = Object.entries(row).filter(([key]) => key !== 'color' && key !== 'status' && key !== 'employees' && key !== 'assignments' && key !== 'id' && key !== 'maintenanceRecords');
                      const nameEntry = entries.find(([key]) => key === 'name' || key === 'category' || key === 'month' || key === 'department');
                      const otherEntries = entries.filter(([key]) => key !== 'name' && key !== 'category' && key !== 'month' && key !== 'department');
                      
                      const isAssetReport = selectedReportType === 'asset-maintenance' || selectedReportType === 'asset-revenue-category';
                      const hasAssignments = isAssetReport && row.assignments && row.assignments.length > 0;
                      const hasMaintenanceRecords = selectedReportType === 'asset-maintenance' && row.maintenanceRecords && row.maintenanceRecords.length > 0;
                      const isExpandable = hasAssignments || hasMaintenanceRecords;
                      const isExpanded = expandedAssetRows.includes(index);
                      
                      const toggleExpand = () => {
                        if (isExpandable) {
                          setExpandedAssetRows(prev => 
                            prev.includes(index) 
                              ? prev.filter(i => i !== index) 
                              : [...prev, index]
                          );
                        }
                      };
                      
                      return (
                        <div key={index} className="bg-slate-50 dark:bg-slate-800 rounded-lg border overflow-hidden">
                          <div 
                            className={`p-3 ${isExpandable ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700' : ''}`}
                            onClick={toggleExpand}
                          >
                            <div className="flex items-center justify-between mb-2">
                              {nameEntry && (
                                <div className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate flex-1">
                                  {nameEntry[1]?.toString()}
                                </div>
                              )}
                              {isExpandable && (
                                <div className="flex items-center gap-2 text-xs ml-2">
                                  {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                                  {hasAssignments && (
                                    <span className="text-blue-600 dark:text-blue-400">{row.assignments.length} project{row.assignments.length !== 1 ? 's' : ''}</span>
                                  )}
                                  {hasMaintenanceRecords && (
                                    <span className="text-orange-600 dark:text-orange-400">{row.maintenanceRecords.length} maintenance</span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {otherEntries.map(([key, value]) => (
                                <div key={key} className="text-xs min-w-0">
                                  <span className="text-slate-500 dark:text-slate-400 capitalize block truncate">
                                    {key.replace(/([A-Z])/g, ' $1').trim()}
                                  </span>
                                  <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                                    {formatValue(key, value)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Expanded details - assignments and maintenance */}
                          {isExpanded && isExpandable && (
                            <div className="border-t bg-white dark:bg-slate-900 p-3 space-y-4">
                              {/* Project Assignments */}
                              {hasAssignments && (
                                <div>
                                  <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2">Project Assignments & Revenue</div>
                                  <div className="space-y-2">
                                    {row.assignments.map((assignment: any, aIndex: number) => (
                                      <div key={aIndex} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs border border-blue-100 dark:border-blue-800">
                                        <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                          {assignment.projectName}
                                        </div>
                                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-slate-600 dark:text-slate-400">
                                          <span>{assignment.startDate} - {assignment.endDate}</span>
                                          <span>{assignment.days} days</span>
                                          <span className="font-medium text-green-600 dark:text-green-400">
                                            {formatCurrency(assignment.revenue)}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Maintenance Records */}
                              {hasMaintenanceRecords && (
                                <div>
                                  <div className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-2">Maintenance Records</div>
                                  <div className="space-y-2">
                                    {row.maintenanceRecords.map((record: any, mIndex: number) => (
                                      <div key={mIndex} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 bg-orange-50 dark:bg-orange-900/20 rounded text-xs border border-orange-100 dark:border-orange-800">
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                            {record.type}
                                          </div>
                                          {record.description !== '-' && (
                                            <div className="text-slate-500 dark:text-slate-400 truncate">
                                              {record.description}
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-slate-600 dark:text-slate-400">
                                          <span>{record.date}</span>
                                          <span className={`px-1.5 py-0.5 rounded text-xs ${record.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : record.status === 'scheduled' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}>
                                            {record.status}
                                          </span>
                                          <span className="font-medium text-red-600 dark:text-red-400">
                                            {formatCurrency(record.cost)}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Statement of Accounts - Customer/Supplier */}
              {(selectedReportType === 'customer-statement' || selectedReportType === 'supplier-statement') && generatedReportData.type === 'statement' && (
                <div ref={detailsSectionRef} className="space-y-4 scroll-mt-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 sm:p-3 border border-blue-200 dark:border-blue-800">
                      <div className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-400 font-medium">Transactions</div>
                      <div className="text-sm sm:text-lg font-bold text-blue-900 dark:text-blue-100">{generatedReportData.summary.totalTransactions}</div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 sm:p-3 border border-green-200 dark:border-green-800">
                      <div className="text-[10px] sm:text-xs text-green-600 dark:text-green-400 font-medium">Total Debit</div>
                      <div className="text-sm sm:text-lg font-bold text-green-900 dark:text-green-100">{formatCurrency(generatedReportData.summary.totalDebit)}</div>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2 sm:p-3 border border-purple-200 dark:border-purple-800">
                      <div className="text-[10px] sm:text-xs text-purple-600 dark:text-purple-400 font-medium">Total Credit</div>
                      <div className="text-sm sm:text-lg font-bold text-purple-900 dark:text-purple-100">{formatCurrency(generatedReportData.summary.totalCredit)}</div>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 sm:p-3 border border-red-200 dark:border-red-800">
                      <div className="text-[10px] sm:text-xs text-red-600 dark:text-red-400 font-medium">Balance</div>
                      <div className="text-sm sm:text-lg font-bold text-red-900 dark:text-red-100">{formatCurrency(generatedReportData.summary.outstandingBalance)}</div>
                    </div>
                  </div>

                  {/* Transaction Details Table */}
                  <div className="bg-white dark:bg-slate-900 rounded-lg border overflow-hidden">
                    <div className="p-2 sm:p-3 border-b bg-slate-50 dark:bg-slate-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-slate-500" />
                          <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">Transaction Details</span>
                        </div>
                        <span className="text-[10px] sm:text-xs text-slate-500">
                          {generatedReportData.data.length} transactions
                        </span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px] sm:text-xs whitespace-nowrap">Date</TableHead>
                            <TableHead className="text-[10px] sm:text-xs">Type</TableHead>
                            <TableHead className="text-[10px] sm:text-xs">Reference</TableHead>
                            <TableHead className="text-[10px] sm:text-xs hidden sm:table-cell">Description</TableHead>
                            <TableHead className="text-[10px] sm:text-xs text-right">Debit</TableHead>
                            <TableHead className="text-[10px] sm:text-xs text-right">Credit</TableHead>
                            <TableHead className="text-[10px] sm:text-xs text-right">Balance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isStatementFetching ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-8">
                                <div className="flex items-center justify-center gap-2">
                                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                  <span className="text-xs sm:text-sm text-slate-500">Loading transactions...</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : generatedReportData.data.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-slate-500 py-8 text-xs sm:text-sm">
                                No transactions found for the selected filters
                              </TableCell>
                            </TableRow>
                          ) : (
                            generatedReportData.data.map((row: any, index: number) => (
                              <TableRow key={index} className={row.type === 'Payment' ? 'bg-green-50/50 dark:bg-green-900/10' : ''}>
                                <TableCell className="text-[10px] sm:text-xs whitespace-nowrap py-2">
                                  {formatDisplayDate(row.date)}
                                </TableCell>
                                <TableCell className="text-[10px] sm:text-xs py-2">
                                  <Badge variant={row.type === 'Invoice' ? 'default' : 'secondary'} className="text-[10px] sm:text-xs px-1 sm:px-2">
                                    {row.type}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-[10px] sm:text-xs font-medium py-2 max-w-[80px] sm:max-w-none truncate">{row.reference}</TableCell>
                                <TableCell className="text-[10px] sm:text-xs hidden sm:table-cell max-w-[120px] truncate py-2">{row.description}</TableCell>
                                <TableCell className="text-[10px] sm:text-xs text-right py-2">
                                  {row.debit > 0 ? formatCurrency(row.debit) : '-'}
                                </TableCell>
                                <TableCell className="text-[10px] sm:text-xs text-right py-2">
                                  {row.credit > 0 ? formatCurrency(row.credit) : '-'}
                                </TableCell>
                                <TableCell className="text-[10px] sm:text-xs text-right font-medium py-2">
                                  {formatCurrency(row.balance)}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    
                    {/* Pagination - Server-side */}
                    {statementPagination && statementPagination.totalPages > 1 && (
                      <div className="flex items-center justify-between p-2 sm:p-3 border-t bg-slate-50 dark:bg-slate-800">
                        <div className="text-[10px] sm:text-xs text-slate-500">
                          Showing {((statementPage - 1) * statementPageSize) + 1} - {Math.min(statementPage * statementPageSize, statementPagination.totalCount)} of {statementPagination.totalCount}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setStatementPage(1);
                              const statementType = selectedReportType === 'customer-statement' ? 'customer-statement' : 'supplier-statement';
                              fetchStatementData(statementType, 1, {
                                customer: dialogStatementCustomer,
                                supplier: dialogStatementSupplier,
                                dateFrom: dialogStatementDateFrom,
                                dateTo: dialogStatementDateTo,
                                dueMoreThan: dialogStatementDueMoreThan,
                              }).then(result => {
                                setGeneratedReportData((prev: any) => ({
                                  ...prev,
                                  data: result.data,
                                }));
                              });
                            }}
                            disabled={statementPage === 1 || isStatementFetching}
                            className="h-7 px-2 text-[10px] sm:text-xs"
                          >
                            First
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newPage = Math.max(1, statementPage - 1);
                              setStatementPage(newPage);
                              const statementType = selectedReportType === 'customer-statement' ? 'customer-statement' : 'supplier-statement';
                              fetchStatementData(statementType, newPage, {
                                customer: dialogStatementCustomer,
                                supplier: dialogStatementSupplier,
                                dateFrom: dialogStatementDateFrom,
                                dateTo: dialogStatementDateTo,
                                dueMoreThan: dialogStatementDueMoreThan,
                              }).then(result => {
                                setGeneratedReportData((prev: any) => ({
                                  ...prev,
                                  data: result.data,
                                }));
                              });
                            }}
                            disabled={statementPage === 1 || isStatementFetching}
                            className="h-7 px-2 text-[10px] sm:text-xs"
                          >
                            Prev
                          </Button>
                          <span className="px-2 text-[10px] sm:text-xs text-slate-600 dark:text-slate-400">
                            {isStatementFetching ? '...' : `${statementPage} / ${statementPagination.totalPages}`}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newPage = Math.min(statementPagination.totalPages, statementPage + 1);
                              setStatementPage(newPage);
                              const statementType = selectedReportType === 'customer-statement' ? 'customer-statement' : 'supplier-statement';
                              fetchStatementData(statementType, newPage, {
                                customer: dialogStatementCustomer,
                                supplier: dialogStatementSupplier,
                                dateFrom: dialogStatementDateFrom,
                                dateTo: dialogStatementDateTo,
                                dueMoreThan: dialogStatementDueMoreThan,
                              }).then(result => {
                                setGeneratedReportData((prev: any) => ({
                                  ...prev,
                                  data: result.data,
                                }));
                              });
                            }}
                            disabled={statementPage >= statementPagination.totalPages || isStatementFetching}
                            className="h-7 px-2 text-[10px] sm:text-xs"
                          >
                            Next
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setStatementPage(statementPagination.totalPages);
                              const statementType = selectedReportType === 'customer-statement' ? 'customer-statement' : 'supplier-statement';
                              fetchStatementData(statementType, statementPagination.totalPages, {
                                customer: dialogStatementCustomer,
                                supplier: dialogStatementSupplier,
                                dateFrom: dialogStatementDateFrom,
                                dateTo: dialogStatementDateTo,
                                dueMoreThan: dialogStatementDueMoreThan,
                              }).then(result => {
                                setGeneratedReportData((prev: any) => ({
                                  ...prev,
                                  data: result.data,
                                }));
                              });
                            }}
                            disabled={statementPage >= statementPagination.totalPages || isStatementFetching}
                            className="h-7 px-2 text-[10px] sm:text-xs"
                          >
                            Last
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}