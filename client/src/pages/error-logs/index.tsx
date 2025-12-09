
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Info,
  XCircle,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Eye,
  Clock,
  User,
  Globe,
  Monitor,
} from "lucide-react";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";

type ErrorLog = {
  id: number;
  message: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  userId?: number;
  userName?: string;
  timestamp: string;
  severity: string;
  component?: string;
  resolved: boolean;
};

type ErrorLogsResponse = {
  data: ErrorLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export default function ErrorLogsIndex() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [resolvedFilter, setResolvedFilter] = useState<string>("all");
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    } else if (user?.role !== "admin") {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user, setLocation]);

  const queryKey = [
    "/api/error-logs",
    currentPage,
    severityFilter,
    resolvedFilter,
  ];

  const { data: errorLogsData, isLoading } = useQuery<ErrorLogsResponse>({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
      });
      if (severityFilter && severityFilter !== "all") params.append("severity", severityFilter);
      if (resolvedFilter && resolvedFilter !== "all") params.append("resolved", resolvedFilter);
      
      return apiRequest("GET", `/api/error-logs?${params.toString()}`);
    },
    enabled: isAuthenticated && user?.role === "admin",
  });

  const resolveErrorMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("PUT", `/api/error-logs/${id}/resolve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/error-logs"] });
      toast({
        title: "Error Resolved",
        description: "Error has been marked as resolved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resolve error",
        variant: "destructive",
      });
    },
  });

  const clearAllErrorsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/error-logs/clear");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/error-logs"] });
      toast({
        title: "All Errors Cleared",
        description: "All error logs have been cleared successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to clear error logs",
        variant: "destructive",
      });
    },
  });

  const clearResolvedErrorsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/error-logs/clear-resolved");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/error-logs"] });
      toast({
        title: "Resolved Errors Cleared",
        description: "All resolved error logs have been cleared successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to clear resolved error logs",
        variant: "destructive",
      });
    },
  });

  if (!isAuthenticated || user?.role !== "admin") {
    return null;
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "info":
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants = {
      error: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
      warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
      info: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
    };

    return (
      <Badge className={variants[severity as keyof typeof variants] || variants.error}>
        {severity.toUpperCase()}
      </Badge>
    );
  };

  const totalErrors = errorLogsData?.pagination.total || 0;
  const unresolvedErrors = errorLogsData?.data.filter(error => !error.resolved).length || 0;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Error Logs
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Monitor and manage application errors
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => clearResolvedErrorsMutation.mutate()}
            variant="outline"
            disabled={clearResolvedErrorsMutation.isPending}
          >
            {clearResolvedErrorsMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Clear Resolved
          </Button>
          <Button
            onClick={() => clearAllErrorsMutation.mutate()}
            variant="destructive"
            disabled={clearAllErrorsMutation.isPending}
          >
            {clearAllErrorsMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Clear All
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Total Errors
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {totalErrors}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Unresolved
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {unresolvedErrors}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Resolved
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {totalErrors - unresolvedErrors}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>

        <Select value={resolvedFilter} onValueChange={setResolvedFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="false">Unresolved</SelectItem>
            <SelectItem value="true">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-400" />
          <p className="text-slate-500 dark:text-slate-400">Loading error logs...</p>
        </div>
      ) : !errorLogsData?.data || errorLogsData.data.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <CheckCircle2 className="h-16 w-16 text-green-300 dark:text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              No errors found
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              Great! There are no errors matching your current filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {errorLogsData.data.map((error) => (
            <Card key={error.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="mt-1">
                      {getSeverityIcon(error.severity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        {getSeverityBadge(error.severity)}
                        {error.resolved && (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                            RESOLVED
                          </Badge>
                        )}
                        {error.component && (
                          <Badge variant="secondary">{error.component}</Badge>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                        {error.message}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-slate-500 dark:text-slate-400">
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4" />
                          <span>{formatDistanceToNow(new Date(error.timestamp), { addSuffix: true })}</span>
                        </div>
                        {error.userName && (
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4" />
                            <span>{error.userName}</span>
                          </div>
                        )}
                        {error.url && (
                          <div className="flex items-center space-x-2">
                            <Globe className="h-4 w-4" />
                            <span className="truncate">{error.url}</span>
                          </div>
                        )}
                        {error.userAgent && (
                          <div className="flex items-center space-x-2">
                            <Monitor className="h-4 w-4" />
                            <span className="truncate">{error.userAgent.slice(0, 30)}...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedError(error)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Error Details</DialogTitle>
                        </DialogHeader>
                        {selectedError && (
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-medium mb-2">Message</h4>
                              <p className="text-sm bg-slate-100 dark:bg-slate-800 p-3 rounded">
                                {selectedError.message}
                              </p>
                            </div>
                            {selectedError.stack && (
                              <div>
                                <h4 className="font-medium mb-2">Stack Trace</h4>
                                <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-3 rounded overflow-x-auto">
                                  {selectedError.stack}
                                </pre>
                              </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                              <div>
                                <h4 className="font-medium mb-1">Severity</h4>
                                <p>{selectedError.severity}</p>
                              </div>
                              <div>
                                <h4 className="font-medium mb-1">Component</h4>
                                <p>{selectedError.component || "Unknown"}</p>
                              </div>
                              <div>
                                <h4 className="font-medium mb-1">Timestamp</h4>
                                <p>{new Date(selectedError.timestamp).toLocaleString()}</p>
                              </div>
                              <div>
                                <h4 className="font-medium mb-1">User</h4>
                                <p>{selectedError.userName || "Anonymous"}</p>
                              </div>
                              {selectedError.url && (
                                <div className="sm:col-span-2">
                                  <h4 className="font-medium mb-1">URL</h4>
                                  <p className="break-all">{selectedError.url}</p>
                                </div>
                              )}
                              {selectedError.userAgent && (
                                <div className="sm:col-span-2">
                                  <h4 className="font-medium mb-1">User Agent</h4>
                                  <p className="break-all">{selectedError.userAgent}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                    {!error.resolved && (
                      <Button
                        onClick={() => resolveErrorMutation.mutate(error.id)}
                        disabled={resolveErrorMutation.isPending}
                        size="sm"
                      >
                        {resolveErrorMutation.isPending ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                        )}
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {errorLogsData.pagination.totalPages > 1 && (
            <div className="flex justify-center space-x-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="flex items-center px-4 py-2 text-sm text-slate-500">
                Page {currentPage} of {errorLogsData.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(p => Math.min(errorLogsData.pagination.totalPages, p + 1))}
                disabled={currentPage === errorLogsData.pagination.totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
