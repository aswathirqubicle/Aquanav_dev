import { formatDisplayDate } from "@/lib/utils";
import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { Ship, Plus, Calendar, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Project } from "@shared/schema";
import { startTransition } from 'react';

const ITEMS_PER_PAGE = 10;

export default function ProjectsIndex() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [location] = useLocation();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCustomerId(
      new URLSearchParams(window.location.search).get("customer")
    );
  }, [location]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, setLocation]);

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects", customerId],
    queryFn: async () => {
      const url = customerId
        ? `/api/projects?customer=${customerId}`
        : "/api/projects";
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Failed to fetch projects");
      }
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    return projects.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        p.title.toLowerCase().includes(q) ||
        (p.vesselName && p.vesselName.toLowerCase().includes(q));
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / ITEMS_PER_PAGE));
  const paginatedProjects = filteredProjects.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  if (!isAuthenticated) {
    return null;
  }

  const getStatusBadge = (status: string) => {
    const statusClasses: Record<string, string> = {
      in_progress: "status-in-progress",
      completed: "status-completed",
      on_hold: "status-on-hold",
      not_started: "status-not-started",
    };

    const statusLabels: Record<string, string> = {
      in_progress: "In Progress",
      completed: "Completed",
      on_hold: "On Hold",
      not_started: "Not Started",
    };

    return (
      <Badge className={`status-badge ${statusClasses[status] || 'status-not-started'}`}>
        {statusLabels[status] || status}
      </Badge>
    );
  };

  const isCustomerFiltered = Boolean(customerId);
  const canCreateProject = !isCustomerFiltered &&
    (user?.role === "admin" || user?.role === "project_manager");

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Projects</h1>
          <p className="text-slate-600 dark:text-slate-400">Manage marine operations and vessel projects</p>

          {customerId && (
            <Button
              variant="ghost"
              size="sm"
              className="mb-4"
              onClick={() => {
                setCustomerId(null);
                setLocation("/projects");
              }}
            >
              ← Back to all projects
            </Button>
          )}
        </div>
        {canCreateProject && (
          <Button onClick={() => setLocation("/projects/create")}>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by project name or vessel name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="not_started">Not Started</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400">Loading projects...</p>
        </div>
      ) : !projects || projects.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Ship className="h-16 w-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No projects found</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              Get started by creating your first marine project
            </p>
            {canCreateProject && (
              <Button onClick={() => setLocation("/projects/create")}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Project
              </Button>
            )}
          </CardContent>
        </Card>
      ) : filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Search className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No matching projects</h3>
            <p className="text-slate-500 dark:text-slate-400">
              Try adjusting your search or filter criteria
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredProjects.length)} of {filteredProjects.length} project(s)
          </p>
          <div className="grid gap-6">
            {paginatedProjects.map((project) => (
              <Card key={project.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-4">
                      {project.vesselImage && (
                        <img
                          src={project.vesselImage}
                          alt={project.vesselName || 'Vessel'}
                          className="h-16 w-16 rounded-lg object-cover"
                        />
                      )}
                      <div>
                        <CardTitle className="text-xl mb-1">{project.title}</CardTitle>
                        <p className="text-slate-600 dark:text-slate-400">{project.vesselName}</p>
                        <div className="flex items-center space-x-4 mt-2">
                          {getStatusBadge(project.status)}
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            Project #{project.id}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startTransition(() => setLocation(`/projects/${project.id}`))}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Timeline</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {project.startDate && project.plannedEndDate
                            ? `${formatDisplayDate(project.startDate)} - ${formatDisplayDate(project.plannedEndDate)}`
                            : "Not set"
                          }
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Ship className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Locations</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {project.locations && project.locations.length > 0
                            ? `${project.locations.length} location${project.locations.length > 1 ? 's' : ''}`
                            : "No locations"
                          }
                        </p>
                      </div>
                    </div>
                  </div>

                  {project.description && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                      <div
                        className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: project.description }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((page) => {
                    if (totalPages <= 7) return true;
                    if (page === 1 || page === totalPages) return true;
                    if (Math.abs(page - currentPage) <= 1) return true;
                    return false;
                  })
                  .map((page, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev !== undefined && page - prev > 1;
                    return (
                      <span key={page} className="flex items-center">
                        {showEllipsis && <span className="px-1 text-muted-foreground">...</span>}
                        <Button
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          className="w-9 h-9 p-0"
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      </span>
                    );
                  })}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
