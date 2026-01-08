import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { Ship, Plus, Calendar, DollarSign } from "lucide-react";
import { Project } from "@shared/schema";
import { startTransition } from 'react';

export default function ProjectsIndex() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, setLocation]);

  const { data: projects, isLoading } = useQuery<Project[]>({
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

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(amount));
  };

  const canCreateProject = user?.role === "admin" || user?.role === "project_manager";

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Projects</h1>
          <p className="text-slate-600 dark:text-slate-400">Manage marine operations and vessel projects</p>
        </div>
        {canCreateProject && (
          <Button onClick={() => setLocation("/projects/create")}>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        )}
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
      ) : (
        <div className="grid gap-6">
          {projects.map((project) => (
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
                          ? `${new Date(project.startDate).toLocaleDateString()} - ${new Date(project.plannedEndDate).toLocaleDateString()}`
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
      )}
    </div>
  );
}