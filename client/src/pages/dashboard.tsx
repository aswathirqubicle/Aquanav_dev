import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { Ship, CheckCircle, AlertTriangle, DollarSign, Plus, Filter } from "lucide-react";
import { Project, DashboardStats } from "@shared/schema";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, setLocation]);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    enabled: isAuthenticated,
  });

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return null;
  }

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

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const getProgressPercentage = (project: Project) => {
    if (!project.startDate || !project.plannedEndDate) return 0;
    
    const start = new Date(project.startDate);
    const end = new Date(project.plannedEndDate);
    const now = new Date();
    
    const total = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    
    return Math.min(Math.max((elapsed / total) * 100, 0), 100);
  };

  return (
    <div className="p-6">
      {/* Dashboard Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {user?.role === "admin" && "Administrator Dashboard"}
          {user?.role === "project_manager" && "Project Manager Dashboard"}
          {user?.role === "finance" && "Finance Dashboard"}
          {user?.role === "customer" && "Customer Portal"}
          {user?.role === "employee" && "Employee Dashboard"}
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Monitor your marine projects and operations at a glance
        </p>
      </div>

      {/* KPI Cards */}
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
                  {statsLoading ? "..." : "vs target"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
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

      {/* Active Projects Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Active Projects</CardTitle>
            <div className="flex items-center space-x-3">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
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
          ) : !projects || projects.length === 0 ? (
            <div className="text-center py-8">
              <Ship className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400">No projects found</p>
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
                    <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Progress</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">End Date</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Budget</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
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
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <Progress value={getProgressPercentage(project)} className="w-16" />
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {Math.round(getProgressPercentage(project))}%
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-slate-900 dark:text-slate-100">
                        {project.plannedEndDate 
                          ? new Date(project.plannedEndDate).toLocaleDateString()
                          : "N/A"
                        }
                      </td>
                      <td className="py-4 px-4 text-slate-900 dark:text-slate-100">
                        {project.estimatedBudget ? formatCurrency(project.estimatedBudget) : "N/A"}
                      </td>
                      <td className="py-4 px-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLocation(`/projects/${project.id}`)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
