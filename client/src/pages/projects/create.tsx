import { useEffect, useState, startTransition } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertProjectSchema, Customer } from "@shared/schema";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const createProjectSchema = insertProjectSchema.extend({
  startDate: z.string().optional(),
  plannedEndDate: z.string().optional(),
});

type CreateProjectData = z.infer<typeof createProjectSchema>;

export default function ProjectCreate() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<CreateProjectData>({
    title: "",
    description: "",
    vesselName: "",
    vesselImage: "",
    vesselImoNumber: "",
    status: "not_started",
    customerId: undefined,
    locations: [],
    startDate: "",
    plannedEndDate: "",
    ridgingCrewNos: "",
    modeOfContract: "",
    workingHours: "",
    ppe: "",
    additionalField1Title: "",
    additionalField1Description: "",
    additionalField2Title: "",
    additionalField2Description: "",
    additionalField3Title: "",
    additionalField3Description: "",
  });

  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [newLocation, setNewLocation] = useState("");

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    } else if (user?.role !== "admin" && user?.role !== "project_manager") {
      setLocation("/projects");
    }
  }, [isAuthenticated, user, setLocation]);

  const { data: customersResponse } = useQuery<{
    data: Customer[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const response = await apiRequest("/api/customers", {
        method: "GET"
      });
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const customers = customersResponse?.data || [];

  const createProjectMutation = useMutation({
    mutationFn: async (data: CreateProjectData) => {
      // Clean and validate data before sending
      const processedData: Partial<CreateProjectData> & { locations: string[] } = {
        title: data.title.trim(),
        status: data.status || "not_started",
        locations: Array.isArray(data.locations) ? data.locations.filter((loc: string) => loc.trim()) : [], // Ensure locations is an array and filter out empty strings
      };

      // Only include fields with valid values
      if (data.description && data.description.trim()) {
        processedData.description = data.description.trim();
      }
      if (data.vesselName && data.vesselName.trim()) {
        processedData.vesselName = data.vesselName.trim();
      }
      if (data.vesselImage && data.vesselImage.trim()) {
        processedData.vesselImage = data.vesselImage.trim();
      }
      if (data.vesselImoNumber && data.vesselImoNumber.trim()) {
        processedData.vesselImoNumber = data.vesselImoNumber.trim();
      }
      if (data.startDate && data.startDate.trim()) {
        processedData.startDate = data.startDate;
      }
      if (data.plannedEndDate && data.plannedEndDate.trim()) {
        processedData.plannedEndDate = data.plannedEndDate;
      }
      if (data.customerId && !isNaN(parseInt(data.customerId.toString()))) {
        processedData.customerId = parseInt(data.customerId.toString());
      }
      if (data.ridgingCrewNos && data.ridgingCrewNos.trim()) {
        processedData.ridgingCrewNos = data.ridgingCrewNos.trim();
      }
      if (data.modeOfContract && data.modeOfContract.trim()) {
        processedData.modeOfContract = data.modeOfContract.trim();
      }
      if (data.workingHours && data.workingHours.trim()) {
        processedData.workingHours = data.workingHours.trim();
      }
      if (data.ppe && data.ppe.trim()) {
        processedData.ppe = data.ppe.trim();
      }
      if (data.additionalField1Title && data.additionalField1Title.trim()) {
        processedData.additionalField1Title = data.additionalField1Title.trim();
      }
      if (data.additionalField1Description && data.additionalField1Description.trim()) {
        processedData.additionalField1Description = data.additionalField1Description.trim();
      }
      if (data.additionalField2Title && data.additionalField2Title.trim()) {
        processedData.additionalField2Title = data.additionalField2Title.trim();
      }
      if (data.additionalField2Description && data.additionalField2Description.trim()) {
        processedData.additionalField2Description = data.additionalField2Description.trim();
      }
      if (data.additionalField3Title && data.additionalField3Title.trim()) {
        processedData.additionalField3Title = data.additionalField3Title.trim();
      }
      if (data.additionalField3Description && data.additionalField3Description.trim()) {
        processedData.additionalField3Description = data.additionalField3Description.trim();
      }

      console.log('Sending project data:', processedData);
      const response = await apiRequest("/api/projects", {
        method: "POST",
        body: JSON.stringify(processedData),
        headers: {
          "Content-Type": "application/json",
        },
      } as RequestInit);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project Created",
        description: "The project has been created successfully.",
      });
      startTransition(() => setLocation("/projects"));
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create project",
        variant: "destructive",
      });
    },
  });

  const handleChange = (field: keyof CreateProjectData, value: any) => {
    setFormData((prev: CreateProjectData) => ({ ...prev, [field]: value }));
  };

  const addLocation = () => {
    if (!newLocation.trim()) {
      toast({
        title: "Error",
        description: "Please enter a location name",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicates
    if (formData.locations?.includes(newLocation.trim())) {
      toast({
        title: "Error",
        description: "This location already exists",
        variant: "destructive",
      });
      return;
    }

    setFormData((prev: CreateProjectData) => ({
      ...prev,
      locations: [...(prev.locations || []), newLocation.trim()],
    }));
    setNewLocation("");
    setIsLocationDialogOpen(false);
  };

  const removeLocation = (index: number) => {
    setFormData((prev: CreateProjectData) => ({
      ...prev,
      locations: prev.locations?.filter((_, i) => i !== index) || [],
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Project title is required",
        variant: "destructive",
      });
      return;
    }

    createProjectMutation.mutate(formData);
  };

  if (!isAuthenticated || (user?.role !== "admin" && user?.role !== "project_manager")) {
    return null;
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Create New Project</h1>
        <p className="text-slate-600 dark:text-slate-400">Set up a new marine operations project</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="title">Project Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  placeholder="e.g., Hull Maintenance - Atlantic Explorer"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vesselName">Vessel Name</Label>
                <Input
                  id="vesselName"
                  value={formData.vesselName}
                  onChange={(e) => handleChange("vesselName", e.target.value)}
                  placeholder="e.g., MV Atlantic Explorer"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vesselImoNumber">Vessel IMO Number</Label>
              <Input
                id="vesselImoNumber"
                value={formData.vesselImoNumber}
                onChange={(e) => handleChange("vesselImoNumber", e.target.value)}
                placeholder="e.g., IMO 9123456"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <div className="border border-input rounded-md">
                <ReactQuill
                  theme="snow"
                  value={formData.description}
                  onChange={(value) => handleChange("description", value)}
                  placeholder="Detailed project description..."
                  modules={{
                    toolbar: [
                      [{ 'header': [1, 2, 3, false] }],
                      ['bold', 'italic', 'underline', 'strike'],
                      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                      [{ 'color': [] }, { 'background': [] }],
                      ['link'],
                      ['clean']
                    ],
                  }}
                  formats={[
                    'header',
                    'bold', 'italic', 'underline', 'strike',
                    'list', 'bullet',
                    'color', 'background',
                    'link'
                  ]}
                  style={{
                    minHeight: '120px'
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vesselImage">Vessel Image</Label>
              <Input
                id="vesselImage"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    // For now, we'll create a temporary URL for preview
                    // In a real implementation, you'd upload to a file storage service
                    const imageUrl = URL.createObjectURL(file);
                    handleChange("vesselImage", imageUrl);
                  }
                }}
              />
              {formData.vesselImage && (
                <div className="mt-2">
                  <img
                    src={formData.vesselImage}
                    alt="Vessel preview"
                    className="h-32 w-48 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="customerId">Customer</Label>
                <Select
                  value={formData.customerId?.toString()}
                  onValueChange={(value) => handleChange("customerId", parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id.toString()}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleChange("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleChange("startDate", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plannedEndDate">Planned End Date</Label>
                <Input
                  id="plannedEndDate"
                  type="date"
                  value={formData.plannedEndDate}
                  onChange={(e) => handleChange("plannedEndDate", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Locations</Label>
                <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" size="sm">
                      Add Location
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add New Location</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); addLocation(); }} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="newLocation">Location Name</Label>
                        <Input
                          id="newLocation"
                          value={newLocation}
                          onChange={(e) => setNewLocation(e.target.value)}
                          placeholder="Enter location name..."
                          required
                        />
                      </div>

                      <div className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={() => setIsLocationDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit">
                          Add Location
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              {formData.locations && formData.locations.length > 0 && (
                <div className="space-y-2">
                  {formData.locations.map((location, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="flex-1 p-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                        {location}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeLocation(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* New Fields Section */}
            <div className="space-y-6 pt-6 border-t border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">Additional Project Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="ridgingCrewNos">Ridging Crew Numbers</Label>
                  <Input
                    id="ridgingCrewNos"
                    value={formData.ridgingCrewNos}
                    onChange={(e) => handleChange("ridgingCrewNos", e.target.value)}
                    placeholder="Enter crew numbers..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="modeOfContract">Mode of Contract</Label>
                  <Select
                    value={formData.modeOfContract}
                    onValueChange={(value) => {
                      if (value === "custom") {
                        handleChange("modeOfContract", "");
                      } else {
                        handleChange("modeOfContract", value);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select contract mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed_price">Fixed Price</SelectItem>
                      <SelectItem value="time_and_materials">Time & Materials</SelectItem>
                      <SelectItem value="cost_plus">Cost Plus</SelectItem>
                      <SelectItem value="day_rate">Day Rate</SelectItem>
                      <SelectItem value="lump_sum">Lump Sum</SelectItem>
                      <SelectItem value="custom">Custom (Enter below)</SelectItem>
                    </SelectContent>
                  </Select>
                  {(!formData.modeOfContract || !["fixed_price", "time_and_materials", "cost_plus", "day_rate", "lump_sum"].includes(formData.modeOfContract)) && (
                    <Input
                      id="modeOfContractCustom"
                      value={formData.modeOfContract || ""}
                      onChange={(e) => handleChange("modeOfContract", e.target.value)}
                      placeholder="Enter custom contract mode..."
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workingHours">Working Hours</Label>
                  <Input
                    id="workingHours"
                    value={formData.workingHours}
                    onChange={(e) => handleChange("workingHours", e.target.value)}
                    placeholder="e.g., 8 hours/day, 5 days/week"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ppe">PPE Requirements</Label>
                  <Input
                    id="ppe"
                    value={formData.ppe}
                    onChange={(e) => handleChange("ppe", e.target.value)}
                    placeholder="Personal protective equipment requirements..."
                  />
                </div>
              </div>

              {/* Additional Custom Fields */}
              <div className="space-y-6">
                <h4 className="text-md font-medium text-slate-900 dark:text-slate-100">Custom Fields (Optional)</h4>
                
                {/* Additional Field 1 */}
                <div className="space-y-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="additionalField1Title">Field 1 Title</Label>
                    <Input
                      id="additionalField1Title"
                      value={formData.additionalField1Title}
                      onChange={(e) => handleChange("additionalField1Title", e.target.value)}
                      placeholder="Enter field title..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="additionalField1Description">Field 1 Description</Label>
                    <div className="border border-input rounded-md">
                      <ReactQuill
                        theme="snow"
                        value={formData.additionalField1Description}
                        onChange={(value) => handleChange("additionalField1Description", value)}
                        placeholder="Enter detailed description..."
                        modules={{
                          toolbar: [
                            [{ 'header': [1, 2, 3, false] }],
                            ['bold', 'italic', 'underline', 'strike'],
                            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                            [{ 'color': [] }, { 'background': [] }],
                            ['link'],
                            ['clean']
                          ],
                        }}
                        formats={[
                          'header',
                          'bold', 'italic', 'underline', 'strike',
                          'list', 'bullet',
                          'color', 'background',
                          'link'
                        ]}
                        style={{
                          minHeight: '120px'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Field 2 */}
                <div className="space-y-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="additionalField2Title">Field 2 Title</Label>
                    <Input
                      id="additionalField2Title"
                      value={formData.additionalField2Title}
                      onChange={(e) => handleChange("additionalField2Title", e.target.value)}
                      placeholder="Enter field title..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="additionalField2Description">Field 2 Description</Label>
                    <div className="border border-input rounded-md">
                      <ReactQuill
                        theme="snow"
                        value={formData.additionalField2Description}
                        onChange={(value) => handleChange("additionalField2Description", value)}
                        placeholder="Enter detailed description..."
                        modules={{
                          toolbar: [
                            [{ 'header': [1, 2, 3, false] }],
                            ['bold', 'italic', 'underline', 'strike'],
                            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                            [{ 'color': [] }, { 'background': [] }],
                            ['link'],
                            ['clean']
                          ],
                        }}
                        formats={[
                          'header',
                          'bold', 'italic', 'underline', 'strike',
                          'list', 'bullet',
                          'color', 'background',
                          'link'
                        ]}
                        style={{
                          minHeight: '120px'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Field 3 */}
                <div className="space-y-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="additionalField3Title">Field 3 Title</Label>
                    <Input
                      id="additionalField3Title"
                      value={formData.additionalField3Title}
                      onChange={(e) => handleChange("additionalField3Title", e.target.value)}
                      placeholder="Enter field title..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="additionalField3Description">Field 3 Description</Label>
                    <div className="border border-input rounded-md">
                      <ReactQuill
                        theme="snow"
                        value={formData.additionalField3Description}
                        onChange={(value) => handleChange("additionalField3Description", value)}
                        placeholder="Enter detailed description..."
                        modules={{
                          toolbar: [
                            [{ 'header': [1, 2, 3, false] }],
                            ['bold', 'italic', 'underline', 'strike'],
                            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                            [{ 'color': [] }, { 'background': [] }],
                            ['link'],
                            ['clean']
                          ],
                        }}
                        formats={[
                          'header',
                          'bold', 'italic', 'underline', 'strike',
                          'list', 'bullet',
                          'color', 'background',
                          'link'
                        ]}
                        style={{
                          minHeight: '120px'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4 pt-6">
              <Button
                type="submit"
                disabled={createProjectMutation.isPending}
              >
                {createProjectMutation.isPending ? "Creating..." : "Create Project"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/projects")}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}