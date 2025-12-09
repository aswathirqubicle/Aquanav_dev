import { useEffect, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<string>("");
  const [generatedReportData, setGeneratedReportData] = useState<any>(null);

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

  const { data: inventory = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
    enabled: isAuthenticated,
  });

  const { data: assets = [] } = useQuery({
    queryKey: ["/api/assets"],
    enabled: isAuthenticated,
  });

  const { data: assetAssignments = [] } = useQuery({
    queryKey: ["/api/asset-assignments"],
    enabled: isAuthenticated,
  });

  const { data: maintenanceRecords = [] } = useQuery({
    queryKey: ["/api/maintenance-records"],
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return null;
  }

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const getMonthName = (month: number) => {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return months[month - 1];
  };

  // Generate project financial data
  const generateProjectFinancialData = () => {
    const filteredProjects = selectedProject === "all" 
      ? projects 
      : projects.filter(p => p.id.toString() === selectedProject);

    return filteredProjects.map(project => ({
      name: project.title.substring(0, 20) + (project.title.length > 20 ? "..." : ""),
      estimated: parseFloat(project.estimatedBudget || "0"),
      actual: parseFloat(project.actualCost || "0"),
      revenue: parseFloat(project.revenue || "0"),
      profit: parseFloat(project.revenue || "0") - parseFloat(project.actualCost || "0"),
      variance: parseFloat(project.estimatedBudget || "0") - parseFloat(project.actualCost || "0"),
      status: project.status,
    }));
  };

  // Generate payroll summary data
  const generatePayrollSummaryData = () => {
    const filteredPayroll = payrollEntries.filter(entry => {
      const yearMatch = entry.year === selectedYear;
      const monthMatch = selectedMonth === "all" || entry.month.toString() === selectedMonth;
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

  // Generate department cost breakdown
  const generateDepartmentCostData = () => {
    const departmentCosts = employees.reduce((acc, employee) => {
      const dept = employee.department || "Unassigned";
      if (!acc[dept]) {
        acc[dept] = { department: dept, cost: 0, count: 0 };
      }
      acc[dept].cost += parseFloat(employee.salary || "0") * 12; // Annual cost
      acc[dept].count += 1;
      return acc;
    }, {} as Record<string, any>);

    return Object.values(departmentCosts);
  };

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

  // Generate asset utilization data
  const generateAssetUtilizationData = () => {
    if (!Array.isArray(assets) || !Array.isArray(assetAssignments)) return [];

    const assetUtilization = assets.map(asset => {
      const assignments = assetAssignments.filter((assignment: any) => assignment.assetId === asset.id);
      const totalDays = assignments.reduce((sum: number, assignment: any) => {
        const start = new Date(assignment.startDate);
        const end = new Date(assignment.endDate);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return sum + days;
      }, 0);

      const totalRevenue = assignments.reduce((sum: number, assignment: any) => {
        return sum + parseFloat(assignment.totalCost || '0');
      }, 0);

      return {
        name: asset.name,
        category: asset.category || 'Uncategorized',
        totalDays,
        assignments: assignments.length,
        revenue: totalRevenue,
        utilizationRate: totalDays > 0 ? Math.min(100, (totalDays / 365) * 100) : 0,
        status: asset.status
      };
    });

    return assetUtilization.sort((a, b) => b.revenue - a.revenue);
  };

  // Generate asset revenue by category
  const generateAssetRevenueByCategoryData = () => {
    if (!Array.isArray(assets) || !Array.isArray(assetAssignments)) return [];

    const categoryRevenue = assets.reduce((acc: any, asset: any) => {
      const category = asset.category || 'Uncategorized';
      const assignments = assetAssignments.filter((assignment: any) => assignment.assetId === asset.id);
      const revenue = assignments.reduce((sum: number, assignment: any) => {
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
      acc[category].assignments += assignments.length;

      return acc;
    }, {});

    return Object.values(categoryRevenue);
  };

  // Generate asset status distribution
  const generateAssetStatusDistribution = () => {
    if (!Array.isArray(assets)) return [];

    const statusCounts = assets.reduce((acc: any, asset: any) => {
      const status = asset.status || 'unknown';
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
      color: colors[status as keyof typeof colors] || '#6b7280'
    }));
  };

  // Generate asset maintenance cost analysis
  const generateAssetMaintenanceData = () => {
    if (!Array.isArray(assets)) return [];

    return assets.map((asset: any) => {
      const acquisitionCost = parseFloat(asset.acquisitionCost || '0');
      const assignments = assetAssignments.filter((assignment: any) => assignment.assetId === asset.id);
      const totalRevenue = assignments.reduce((sum: number, assignment: any) => {
        return sum + parseFloat(assignment.totalCost || '0');
      }, 0);

      // Get actual maintenance cost from maintenance records
      const assetMaintenanceRecords = maintenanceRecords.filter((record: any) => record.assetId === asset.id);
      const actualMaintenanceCost = assetMaintenanceRecords.reduce((sum: number, record: any) => {
        return sum + parseFloat(record.maintenanceCost || '0');
      }, 0);

      // Calculate net profit and ROI
      const netProfit = totalRevenue - actualMaintenanceCost;
      let roi = 0;

      if (acquisitionCost > 0) {
        roi = (netProfit / acquisitionCost) * 100;
        // Ensure ROI is not negative - if it is, set to 0
        roi = Math.max(0, roi);
      }

      return {
        name: asset.name,
        acquisitionCost,
        totalRevenue,
        actualMaintenance: actualMaintenanceCost,
        maintenanceCount: assetMaintenanceRecords.length,
        netProfit: Math.round(netProfit * 100) / 100,
        roi: Math.round(roi * 100) / 100,
        status: asset.status
      };
    }).sort((a, b) => b.roi - a.roi);
  };

  // Generate monthly asset revenue trend
  const generateAssetRevenueTrendData = () => {
    if (!Array.isArray(assetAssignments)) return [];

    const monthlyRevenue = assetAssignments.reduce((acc: any, assignment: any) => {
      const startDate = new Date(assignment.startDate);
      const monthKey = `${startDate.getFullYear()}-${(startDate.getMonth() + 1).toString().padStart(2, '0')}`;

      if (!acc[monthKey]) {
        acc[monthKey] = {
          month: monthKey,
          revenue: 0,
          assignments: 0
        };
      }

      acc[monthKey].revenue += parseFloat(assignment.totalCost || '0');
      acc[monthKey].assignments += 1;

      return acc;
    }, {});

    return Object.values(monthlyRevenue).sort((a: any, b: any) => a.month.localeCompare(b.month));
  };

  // Generate project status distribution
  const generateProjectStatusData = () => {
    const statusCounts = projects.reduce((acc, project) => {
      const status = project.status || "Unknown";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const colors = {
      'not_started': '#ef4444',
      'in_progress': '#f59e0b',
      'completed': '#10b981',
      'on_hold': '#6b7280',
      'cancelled': '#dc2626',
    };

    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status.replace('_', ' ').toUpperCase(),
      value: count,
      color: colors[status as keyof typeof colors] || '#6b7280'
    }));
  };

  const generateReport = (reportType: string) => {
    let reportData: any = {};

    switch (reportType) {
      case "project-financial":
        reportData = {
          title: "Project Financial Summary",
          type: "chart",
          chartType: "bar",
          data: generateProjectFinancialData(),
          summary: {
            totalProjects: projects.length,
            totalBudget: projects.reduce((sum, p) => sum + parseFloat(p.estimatedBudget || "0"), 0),
            totalActual: projects.reduce((sum, p) => sum + parseFloat(p.actualCost || "0"), 0),
            totalRevenue: projects.reduce((sum, p) => sum + parseFloat(p.revenue || "0"), 0),
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
            totalAmount: payrollEntries.reduce((sum, p) => sum + parseFloat(p.totalAmount), 0),
            averagePerEmployee: payrollEntries.length > 0 ? payrollEntries.reduce((sum, p) => sum + parseFloat(p.totalAmount), 0) / employees.length : 0,
          }
        };
        break;

      case "department-costs":
        reportData = {
          title: "Department Cost Breakdown",
          type: "chart",
          chartType: "pie",
          data: generateDepartmentCostData(),
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
        reportData = {
          title: "Project Status Distribution",
          type: "chart",
          chartType: "pie",
          data: generateProjectStatusData(),
          summary: {
            totalProjects: projects.length,
            activeProjects: projects.filter(p => p.status === "in_progress").length,
            completedProjects: projects.filter(p => p.status === "completed").length,
          }
        };
        break;

      case "asset-utilization":
        reportData = {
          title: "Asset Utilization Analysis",
          type: "chart",
          chartType: "bar",
          data: generateAssetUtilizationData(),
          summary: {
            totalAssets: assets.length,
            totalRevenue: assetAssignments.reduce((sum: number, assignment: any) => sum + parseFloat(assignment.totalCost || '0'), 0),
            averageUtilization: assets.length > 0 ? generateAssetUtilizationData().reduce((sum, asset) => sum + asset.utilizationRate, 0) / assets.length : 0,
          }
        };
        break;

      case "asset-revenue-category":
        reportData = {
          title: "Asset Revenue by Category",
          type: "chart",
          chartType: "pie",
          data: generateAssetRevenueByCategoryData(),
          summary: {
            totalCategories: new Set(assets.map((asset: any) => asset.category)).size,
            totalRevenue: assetAssignments.reduce((sum: number, assignment: any) => sum + parseFloat(assignment.totalCost || '0'), 0),
            totalAssignments: assetAssignments.length,
          }
        };
        break;

      case "asset-status":
        reportData = {
          title: "Asset Status Distribution",
          type: "chart",
          chartType: "pie",
          data: generateAssetStatusDistribution(),
          summary: {
            totalAssets: assets.length,
            availableAssets: assets.filter((asset: any) => asset.status === 'available').length,
            inUseAssets: assets.filter((asset: any) => asset.status === 'in_use').length,
          }
        };
        break;

      case "asset-maintenance":
        reportData = {
          title: "Asset Maintenance & ROI Analysis",
          type: "chart",
          chartType: "bar",
          data: generateAssetMaintenanceData(),
          summary: {
            totalAssets: assets.length,
            totalAcquisitionCost: assets.reduce((sum: number, asset: any) => sum + parseFloat(asset.acquisitionCost || '0'), 0),
            totalMaintenanceCost: maintenanceRecords.reduce((sum: number, record: any) => sum + parseFloat(record.maintenanceCost || '0'), 0),
            averageROI: assets.length > 0 ? generateAssetMaintenanceData().reduce((sum, asset) => sum + asset.roi, 0) / assets.length : 0,
          }
        };
        break;

      case "asset-revenue-trend":
        reportData = {
          title: "Asset Revenue Trend",
          type: "chart",
          chartType: "line",
          data: generateAssetRevenueTrendData(),
          summary: {
            totalMonths: generateAssetRevenueTrendData().length,
            totalRevenue: assetAssignments.reduce((sum: number, assignment: any) => sum + parseFloat(assignment.totalCost || '0'), 0),
            averageMonthlyRevenue: generateAssetRevenueTrendData().length > 0 ? generateAssetRevenueTrendData().reduce((sum: number, month: any) => sum + month.revenue, 0) / generateAssetRevenueTrendData().length : 0,
          }
        };
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

      if (generatedReportData.type === "chart") {
        const headers = Object.keys(generatedReportData.data[0] || {}).join(",");
        csvContent = headers + "\n";

        generatedReportData.data.forEach((row: any) => {
          const values = Object.values(row).map(val => 
            typeof val === "string" ? `"${val}"` : val
          ).join(",");
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
      ]
    },
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
          id: "profit-loss",
          name: "Profit & Loss Report", 
          description: "Comprehensive financial performance analysis" 
        },
        { 
          id: "payables-receivables",
          name: "Payables & Receivables", 
          description: "Analysis of amounts owed and due" 
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
      value: Array.isArray(assets) ? assets.length : 0,
      icon: Wrench,
      color: "text-orange-600",
    },
  ];

  const renderChart = (data: any) => {
    if (!data || !data.data || data.data.length === 0) {
      return <div className="text-center py-8 text-slate-500">No data available</div>;
    }

    switch (data.chartType) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: any, name: string) => {
                if (name === 'revenue' || name === 'estimated' || name === 'actual' || name === 'acquisitionCost' || name === 'totalRevenue' || name === 'actualMaintenance' || name === 'estimatedMaintenance' || name === 'netProfit') {
                  return formatCurrency(value);
                }
                if (name === 'utilizationRate' || name === 'roi') {
                  return `${value}%`;
                }
                return value;
              }} />
              {data.data.length > 0 && Object.keys(data.data[0]).includes('estimated') && (
                <>
                  <Bar dataKey="estimated" fill="#3b82f6" name="Estimated" />
                  <Bar dataKey="actual" fill="#10b981" name="Actual" />
                </>
              )}
              {data.data.length > 0 && Object.keys(data.data[0]).includes('revenue') && !Object.keys(data.data[0]).includes('estimated') && (
                <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" />
              )}
              {data.data.length > 0 && Object.keys(data.data[0]).includes('utilizationRate') && (
                <Bar dataKey="utilizationRate" fill="#f59e0b" name="Utilization %" />
              )}
              {data.data.length > 0 && Object.keys(data.data[0]).includes('acquisitionCost') && (
                <>
                  <Bar dataKey="acquisitionCost" fill="#ef4444" name="Acquisition Cost" />
                  <Bar dataKey="totalRevenue" fill="#10b981" name="Total Revenue" />
                  <Bar dataKey="actualMaintenance" fill="#f59e0b" name="Actual Maintenance" />
                  <Bar dataKey="netProfit" fill="#3b82f6" name="Net Profit" />
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        );

      case "line":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: any, name: string) => {
                if (name === 'amount' || name === 'revenue') {
                  return formatCurrency(value);
                }
                return value;
              }} />
              {data.data.length > 0 && Object.keys(data.data[0]).includes('amount') && (
                <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} name="Amount" />
              )}
              {data.data.length > 0 && Object.keys(data.data[0]).includes('revenue') && (
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue" />
              )}
            </LineChart>
          </ResponsiveContainer>
        );

      case "pie":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {data.data.map((entry: any, index: number) => (
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
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Reports & Analytics
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Generate comprehensive reports and analyze business data
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {quickStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className={`p-2 rounded-lg bg-slate-100 dark:bg-slate-800`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      {stat.title}
                    </p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {stat.value}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="generator" className="space-y-6">
        <TabsList>
          <TabsTrigger value="generator">Report Generator</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="generator">
          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center text-base sm:text-lg">
                <Filter className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                Report Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="year" className="text-sm font-medium">Year</Label>
                  <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, i) => {
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

                <div className="space-y-2">
                  <Label htmlFor="month" className="text-sm font-medium">Month</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Months</SelectItem>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {getMonthName(i + 1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project" className="text-sm font-medium">Project</Label>
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Projects</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          <span className="truncate">{project.title}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button variant="outline" className="w-full h-10">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Apply Filters</span>
                    <span className="sm:hidden">Apply</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Report Categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {reportCategories.map((category) => {
              const Icon = category.icon;
              return (
                <Card key={category.title} className="h-fit">
                  <CardHeader className="pb-3 sm:pb-4">
                    <CardTitle className="flex items-center text-base sm:text-lg">
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5 mr-2 flex-shrink-0" />
                      <span className="truncate">{category.title}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-6 pt-0">
                    <div className="space-y-3">
                      {category.reports.map((report) => (
                        <div key={report.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-slate-900 dark:text-slate-100 text-sm sm:text-base truncate">
                              {report.name}
                            </h4>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                              {report.description}
                            </p>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="w-full sm:w-auto flex-shrink-0"
                            onClick={() => {
                              if (report.id === "profit-loss") {
                                setLocation("/reports/profit-loss");
                                return;
                              }
                              if (report.id === "payables-receivables") {
                                setLocation("/reports/payables-receivables");
                                return;
                              }
                              setSelectedReportType(report.id);
                              generateReport(report.id);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            <span className="hidden sm:inline">Generate</span>
                            <span className="sm:hidden">Generate Report</span>
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="scheduled">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Reports</CardTitle>
              <CardDescription>
                Set up automated report generation and delivery
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Calendar className="h-16 w-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                  Scheduled Reports Coming Soon
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4">
                  Set up automated report generation and email delivery schedules
                </p>
                <Button variant="outline">
                  <Calendar className="h-4 w-4 mr-2" />
                  Configure Schedule
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Report Preview Dialog */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <DialogTitle className="text-lg sm:text-xl truncate pr-4">
                {generatedReportData?.title}
              </DialogTitle>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full sm:w-auto"
                  onClick={() => exportReport("csv")}
                >
                  <Download className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Export CSV</span>
                  <span className="sm:hidden">Export</span>
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full sm:w-auto"
                  onClick={() => window.print()}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Print
                </Button>
              </div>
            </div>
          </DialogHeader>

          {generatedReportData && (
            <div className="space-y-6">
              {/* Summary Stats */}
              {generatedReportData.summary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  {Object.entries(generatedReportData.summary).map(([key, value]) => (
                    <div key={key} className="text-center sm:text-left lg:text-center">
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 capitalize truncate">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </p>
                      <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                        {typeof value === "number" && key.toLowerCase().includes("amount") || key.toLowerCase().includes("cost") || key.toLowerCase().includes("budget") || key.toLowerCase().includes("value")
                          ? formatCurrency(value as number)
                          : value?.toString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Chart */}
              <div className="bg-white dark:bg-slate-900 p-2 sm:p-4 rounded-lg border overflow-hidden">
                <div className="w-full min-h-[250px] sm:min-h-[300px]">
                  {renderChart(generatedReportData)}
                </div>
              </div>

              {/* Data Table */}
              {generatedReportData.data && generatedReportData.data.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(generatedReportData.data[0]).map((key) => (
                            <TableHead key={key} className="capitalize whitespace-nowrap text-xs sm:text-sm">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {generatedReportData.data.slice(0, 10).map((row: any, index: number) => (
                          <TableRow key={index}>
                            {Object.entries(row).map(([key, value], cellIndex) => (
                              <TableCell key={cellIndex} className="whitespace-nowrap text-xs sm:text-sm">
                                <div className="max-w-[120px] sm:max-w-none truncate">
                                  {typeof value === "number" && (key.toLowerCase().includes("amount") || key.toLowerCase().includes("cost") || key.toLowerCase().includes("estimated") || key.toLowerCase().includes("actual") || key.toLowerCase().includes("value") || key.toLowerCase().includes("revenue") || key.toLowerCase().includes("profit") || key.toLowerCase().includes("maintenance"))
                                    ? key.toLowerCase().includes("count") 
                                      ? value.toString() 
                                      : formatCurrency(value)
                                    : typeof value === "number" && key.toLowerCase().includes("roi")
                                    ? `${value}%`
                                    : value?.toString()}
                                </div>
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {generatedReportData.data.length > 10 && (
                    <div className="p-3 sm:p-4 text-center text-xs sm:text-sm text-slate-500 border-t">
                      Showing first 10 of {generatedReportData.data.length} records
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}