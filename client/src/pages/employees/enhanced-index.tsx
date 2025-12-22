import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, FileText, Calendar, User, Heart, GraduationCap, Download, Plus, Edit, Trash2, Eye } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Employee, EmployeeNextOfKin, EmployeeTrainingRecord, EmployeeDocument, insertEmployeeSchema, insertEmployeeNextOfKinSchema, insertEmployeeTrainingRecordSchema, insertEmployeeDocumentSchema } from "@shared/schema";
import { z } from "zod";

const createEmployeeSchema = insertEmployeeSchema.extend({
  hireDate: z.string().optional(),
  dateOfBirth: z.string().optional(),
  salary: z.string().optional(),
  height: z.string().optional(),
  weight: z.string().optional(),
});

const createNextOfKinSchema = insertEmployeeNextOfKinSchema.omit({ id: true, employeeId: true });
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)");

  export const createTrainingRecordSchema =
  insertEmployeeTrainingRecordSchema
    .omit({ id: true, employeeId: true })
    .extend({
      trainingDate: isoDate,
      expiryDate: isoDate.optional().nullable(),
    });


const createDocumentSchema = insertEmployeeDocumentSchema.omit({ id: true, employeeId: true }).extend({
  dateOfIssue: z.string().optional(),
  expiryDate: z.string().optional(),
  validTill: z.string().optional(),
});

type CreateEmployeeData = z.infer<typeof createEmployeeSchema>;
type CreateNextOfKinData = z.infer<typeof createNextOfKinSchema>;
type CreateTrainingRecordData = z.infer<typeof createTrainingRecordSchema>;
type CreateDocumentData = z.infer<typeof createDocumentSchema>;

interface ExpiringDocument {
  visas: Array<Employee & { documentType: string; expiryDate: string; daysToExpiry: number }>;
  trainings: Array<EmployeeTrainingRecord & { employee: Employee; daysToExpiry: number }>;
}

export default function EmployeesIndex() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  
  // Tab states
  const [activeTab, setActiveTab] = useState("basic");
  const [detailActiveTab, setDetailActiveTab] = useState("personal");
  
  // Form states
  const [formData, setFormData] = useState<CreateEmployeeData>({
    employeeCode: "",
    firstName: "",
    lastName: "",
    email: null,
    phone: null,
    position: null,
    department: null,
    category: "permanent",
    grade: null,
    hireDate: null,
    salary: null,
    isActive: true,
    dateOfBirth: null,
    height: null,
    weight: null,
    address: null,
    bankName: null,
    bankBranch: null,
    accountNumber: null,
    accountHolderName: null,
    ifscCode: null,
    swiftCode: null,

    boilerSuitSize: null,
    safetyShoeSize: null,
  });

  const [nextOfKinData, setNextOfKinData] = useState<CreateNextOfKinData>({
    name: "",
    email: null,
    phone: null,
    relationship: "",
    isPrimary: false,
  });

  const [editingNextOfKin, setEditingNextOfKin] = useState<EmployeeNextOfKin | null>(null);


  const [trainingData, setTrainingData] = useState<CreateTrainingRecordData>({
    trainingName: "",
    trainingProvider: "Aquanav",
    certificationNumber: null,
    trainingDate: "",
    expiryDate: null,
    status: "active",
    notes: null,
    attachments: [],
  });

  const [editingTraining, setEditingTraining] = useState<EmployeeTrainingRecord | null>(null);


  const [documentData, setDocumentData] = useState<CreateDocumentData>({
    documentType: "passport",
    documentNumber: null,
    placeOfIssue: null,
    dateOfIssue: null,
    expiryDate: null,
    validTill: null,
    status: "active",
    notes: null,
    filePath: null,
  });

  // Document management states
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<EmployeeDocument | null>(null);

  const [createUserAccount, setCreateUserAccount] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    } else if (user?.role !== "admin" && user?.role !== "project_manager") {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user, setLocation]);

  // Queries
  const { data: employees, isLoading } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    enabled: isAuthenticated,
  });

  const { data: selectedEmployeeNextOfKin, isLoading: nextOfKinLoading } = useQuery<EmployeeNextOfKin[]>({
    queryKey: [`/api/employees/${selectedEmployee?.id}/next-of-kin`],
    enabled: !!selectedEmployee?.id,
  });

  const { data: selectedEmployeeTrainingRecords, isLoading: trainingRecordsLoading } = useQuery<EmployeeTrainingRecord[]>({
    queryKey: [`/api/employees/${selectedEmployee?.id}/training-records`],
    enabled: !!selectedEmployee?.id,
  });

  const { data: selectedEmployeeDocuments } = useQuery<EmployeeDocument[]>({
    queryKey: [`/api/employees/${selectedEmployee?.id}/documents`],
    enabled: !!selectedEmployee?.id,
  });

  const { data: expiringDocuments } = useQuery<ExpiringDocument>({
    queryKey: ["/api/employees/expiring-documents"],
    enabled: isAuthenticated && (user?.role === "admin" || user?.role === "project_manager"),
  });

  // Generate employee code automatically
  const generateEmployeeCode = () => {
    if (!employees) return "EMP001";
    
    const existingCodes = employees
      .map(emp => emp.employeeCode)
      .filter(code => code.startsWith("EMP"))
      .map(code => {
        const match = code.match(/EMP(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => !isNaN(num));
    
    const nextNumber = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;
    return `EMP${nextNumber.toString().padStart(3, '0')}`;
  };

  // Mutations
  const updateEmployeeMutation = useMutation({
    mutationFn: async (data: { id: number; data: CreateEmployeeData }) => {
      const processedData = {
        ...data.data,
        hireDate: data.data.hireDate ? new Date(data.data.hireDate).toISOString() : null,
        dateOfBirth: data.data.dateOfBirth ? new Date(data.data.dateOfBirth).toISOString() : null,
        salary: data.data.salary || null,
        height: data.data.height || null,
        weight: data.data.weight || null,
      };

      const response = await apiRequest(`/api/employees/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(processedData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update employee");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsEditDialogOpen(false);
      setEditingEmployee(null);
      resetForm();
      
      toast({
        title: "Employee Updated",
        description: "Employee has been updated successfully.",
      });
    },
    onError: (error) => {
      console.error("Update employee error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update employee",
        variant: "destructive",
      });
    },
  });

  const createEmployeeMutation = useMutation({
    mutationFn: async (data: CreateEmployeeData & { createUserAccount: boolean }) => {
      const processedData = {
        ...data,
        hireDate: data.hireDate ? new Date(data.hireDate).toISOString() : null,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth).toISOString() : null,

        salary: data.salary || null,
        height: data.height || null,
        weight: data.weight || null,
      };

      const response = await apiRequest("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(processedData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create employee");
      }
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsDialogOpen(false);
      resetForm();
      
      toast({
        title: "Employee Created",
        description: result.generatedCredentials 
          ? `Employee and user account created. Username: ${result.generatedCredentials.username}, Password: ${result.generatedCredentials.password}`
          : "Employee has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createNextOfKinMutation = useMutation({
    mutationFn: async (data: CreateNextOfKinData) => {
      const response = await apiRequest(`/api/employees/${selectedEmployee?.id}/next-of-kin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create next of kin record");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${selectedEmployee?.id}/next-of-kin`] });
      setNextOfKinData({ name: "", email: null, phone: null, relationship: "", isPrimary: false });
      toast({ title: "Success", description: "Next of kin record created successfully." });
    },
  });

  const updateNextOfKinMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: CreateNextOfKinData;
    }) => {
      const response = await apiRequest(
        `/api/employees/next-of-kin/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err?.message || "Failed to update next of kin");
      }

      return response.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/employees/${selectedEmployee?.id}/next-of-kin`],
      });

      setEditingNextOfKin(null);
      setNextOfKinData({
        name: "",
        email: null,
        phone: null,
        relationship: "",
        isPrimary: false,
      });

      toast({
        title: "Success",
        description: "Next of kin updated successfully.",
      });
    },

    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update next of kin",
        variant: "destructive",
      });
    },
  });


  const deleteNextOfKinMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/employees/next-of-kin/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete next of kin record");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${selectedEmployee?.id}/next-of-kin`] });
      toast({ title: "Success", description: "Next of kin record deleted successfully." });
    },
    onError: (error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete next of kin record",
        variant: "destructive",
      });
    },
  });

  const createTrainingRecordMutation = useMutation({
    mutationFn: async (data: CreateTrainingRecordData) => {
      const response = await apiRequest(`/api/employees/${selectedEmployee?.id}/training-records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create training record");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${selectedEmployee?.id}/training-records`] });
      setTrainingData({
        trainingName: "",
        trainingProvider: "Aquanav",
        certificationNumber: null,
        trainingDate: "",
        expiryDate: null,
        status: "active",
        notes: null,
        attachments: [],
      });
      toast({ title: "Success", description: "Training record created successfully." });
    },
  });

  const updateTrainingRecordMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: CreateTrainingRecordData;
    }) => {
      const response = await apiRequest(
        `/api/employees/training-records/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err?.message || "Failed to update training record");
      }

      return response.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/employees/${selectedEmployee?.id}/training-records`],
      });

      setEditingTraining(null);
      setTrainingData({
        trainingName: "",
        trainingProvider: "Aquanav",
        certificationNumber: null,
        trainingDate: "",
        expiryDate: null,
        status: "active",
        notes: null,
        attachments: [],
      });

      toast({
        title: "Success",
        description: "Training record updated successfully.",
      });
    },

    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update training record",
        variant: "destructive",
      });
    },
  });

  const deleteTrainingRecordMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(
        `/api/employees/training-records/${id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err?.message || "Failed to delete training record");
      }

      return response.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/employees/${selectedEmployee?.id}/training-records`],
      });

      // If deleting the record currently being edited → reset form
      setEditingTraining(null);
      setTrainingData({
        trainingName: "",
        trainingProvider: "Aquanav",
        certificationNumber: null,
        trainingDate: "",
        expiryDate: null,
        status: "active",
        notes: null,
        attachments: [],
      });

      toast({
        title: "Success",
        description: "Training record deleted successfully.",
      });
    },

    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete training record",
        variant: "destructive",
      });
    },
  });

  // Document Management Mutations
  const createDocumentMutation = useMutation({
    mutationFn: async (data: CreateDocumentData) => {
      const fd = new FormData();
      // append normal fields
      Object.entries(data).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          fd.append(key, String(value));
        }
      });
      // append files
      if (selectedFiles) {
        Array.from(selectedFiles).forEach(file => {
          fd.append("files", file); // MUST match multer field name
        });
      }
      const response = await apiRequest(`/api/employees/${selectedEmployee?.id}/documents`, {
        method: "POST",
        body: fd, //formdata
      });
      if (!response.ok) throw new Error("Failed to create document");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${selectedEmployee?.id}/documents`] });
      resetDocumentForm();
      setIsDocumentDialogOpen(false);
      toast({ title: "Success", description: "Document created successfully." });
    },
  });

  const updateDocumentMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<CreateDocumentData>;
    }) => {
      const fd = new FormData();

      // Append document fields
      Object.entries(data).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          fd.append(key, String(value));
        }
      });

      // Append files (if any)
      if (selectedFiles && selectedFiles.length > 0) {
        Array.from(selectedFiles).forEach((file) => {
          fd.append("files", file); // MUST match multer field name
        });
      }

      const response = await apiRequest(
        `/api/employees/documents/${id}`,
        {
          method: "PUT",
          body: fd, // ✅ FormData
          // ❌ DO NOT set Content-Type
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err?.message || "Failed to update document");
      }

      return response.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/employees/${selectedEmployee?.id}/documents`],
      });

      setSelectedFiles(null);
      resetDocumentForm();
      setEditingDocument(null);
      setIsDocumentDialogOpen(false);

      toast({
        title: "Success",
        description: "Document updated successfully.",
      });
    },

    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update document",
        variant: "destructive",
      });
    },
  });


  const deleteDocumentMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/employees/documents/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete document");
      return response.json();
    },
    onSuccess: () => {
      // queryClient.invalidateQueries({ queryKey: ["/api/employees", selectedEmployee?.id, "documents"] });
      queryClient.invalidateQueries({
        queryKey: [`/api/employees/${selectedEmployee?.id}/documents`],
      });
      toast({ title: "Success", description: "Document deleted successfully." });
    },
  });

  const resetDocumentForm = () => {
    setDocumentData({
      documentType: "passport",
      documentNumber: null,
      placeOfIssue: null,
      dateOfIssue: null,
      expiryDate: null,
      validTill: null,
      status: "active",
      notes: null,
      filePath: null,
    });
  };

  const resetForm = () => {
    setFormData({
      employeeCode: "",
      firstName: "",
      lastName: "",
      email: null,
      phone: null,
      position: null,
      department: null,
      category: "permanent",
      grade: null,
      hireDate: null,
      salary: null,
      isActive: true,
      dateOfBirth: null,
      height: null,
      weight: null,
      address: null,
      bankName: null,
      bankBranch: null,
      accountNumber: null,
      accountHolderName: null,
      ifscCode: null,
      swiftCode: null,

      boilerSuitSize: null,
      safetyShoeSize: null,
    });
  };

  const handleViewEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsDetailDialogOpen(true);
    setDetailActiveTab("personal");
  };

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone,
      position: employee.position,
      department: employee.department,
      category: employee.category,
      grade: employee.grade,
      hireDate: employee.hireDate ? new Date(employee.hireDate).toISOString().split('T')[0] : null,
      salary: employee.salary,
      isActive: employee.isActive,
      dateOfBirth: employee.dateOfBirth ? new Date(employee.dateOfBirth).toISOString().split('T')[0] : null,
      height: employee.height,
      weight: employee.weight,
      address: employee.address,
      bankName: employee.bankName,
      bankBranch: employee.bankBranch,
      accountNumber: employee.accountNumber,
      accountHolderName: employee.accountHolderName,
      ifscCode: employee.ifscCode,
      swiftCode: employee.swiftCode,
      boilerSuitSize: employee.boilerSuitSize,
      safetyShoeSize: employee.safetyShoeSize,
    });
    setIsEditDialogOpen(true);
    setActiveTab("basic");
  };

  const handleGenerateContract = async (employeeId: number) => {
    try {
      const response = await apiRequest(`/api/employees/${employeeId}/employment-contract`, {
        method: "GET",
      });
      
      if (response.ok) {
        const contractHtml = await response.text();
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(contractHtml);
          printWindow.document.close();
          printWindow.focus();
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate employment contract",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not specified";
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: "bg-green-100 text-green-800",
      expired: "bg-red-100 text-red-800",
      valid: "bg-green-100 text-green-800",
      not_applicable: "bg-gray-100 text-gray-800",
    };
    return variants[status] || "bg-gray-100 text-gray-800";
  };

  const getExpiryBadge = (daysToExpiry: number) => {
    if (daysToExpiry < 0) return "bg-red-100 text-red-800";
    if (daysToExpiry <= 7) return "bg-red-100 text-red-800";
    if (daysToExpiry <= 30) return "bg-yellow-100 text-yellow-800";
    return "bg-green-100 text-green-800";
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Employee Management</h1>
          <p className="text-gray-600">Comprehensive employee master data management</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              resetForm();
              setFormData(prev => ({ ...prev, employeeCode: generateEmployeeCode() }));
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
            </DialogHeader>
            
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="banking">Banking</TabsTrigger>
                <TabsTrigger value="other">Other Details</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="employeeCode">Employee Code *</Label>
                    <Input
                      id="employeeCode"
                      value={formData.employeeCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, employeeCode: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Category *</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value as any }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="permanent">Permanent</SelectItem>
                        <SelectItem value="consultant">Consultant</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                      required
                    />
                  </div>
                  {formData.category === "contract" && (
                    <div>
                      <Label htmlFor="grade">Grade</Label>
                      <Select value={formData.grade || ""} onValueChange={(value) => setFormData(prev => ({ ...prev, grade: value || null }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select grade" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Grade 1">Grade 1</SelectItem>
                          <SelectItem value="Grade 2">Grade 2</SelectItem>
                          <SelectItem value="Grade 3">Grade 3</SelectItem>
                          <SelectItem value="Grade 4">Grade 4</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label htmlFor="position">Position</Label>
                    <Input
                      id="position"
                      value={formData.position || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      value={formData.department || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="hireDate">Hire Date</Label>
                    <Input
                      id="hireDate"
                      type="date"
                      value={formData.hireDate || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, hireDate: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="salary">Salary</Label>
                    <Input
                      id="salary"
                      type="number"
                      step="0.01"
                      value={formData.salary || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, salary: e.target.value || null }))}
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="createUserAccount"
                    checked={createUserAccount}
                    onCheckedChange={setCreateUserAccount}
                  />
                  <Label htmlFor="createUserAccount">Create user account (requires email)</Label>
                </div>
              </TabsContent>

              <TabsContent value="personal" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value || null }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={formData.address || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="height">Height (cm)</Label>
                    <Input
                      id="height"
                      type="number"
                      step="0.01"
                      value={formData.height || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, height: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="weight">Weight (kg)</Label>
                    <Input
                      id="weight"
                      type="number"
                      step="0.01"
                      value={formData.weight || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="boilerSuitSize">Boiler Suit Size</Label>
                    <Input
                      id="boilerSuitSize"
                      value={formData.boilerSuitSize || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, boilerSuitSize: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="safetyShoeSize">Safety Shoe Size</Label>
                    <Input
                      id="safetyShoeSize"
                      value={formData.safetyShoeSize || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, safetyShoeSize: e.target.value || null }))}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="banking" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="bankName">Bank Name</Label>
                    <Input
                      id="bankName"
                      value={formData.bankName || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, bankName: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="bankBranch">Bank Branch</Label>
                    <Input
                      id="bankBranch"
                      value={formData.bankBranch || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, bankBranch: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="accountNumber">Account Number</Label>
                    <Input
                      id="accountNumber"
                      value={formData.accountNumber || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="accountHolderName">Account Holder Name</Label>
                    <Input
                      id="accountHolderName"
                      value={formData.accountHolderName || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, accountHolderName: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ifscCode">IFSC Code</Label>
                    <Input
                      id="ifscCode"
                      value={formData.ifscCode || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, ifscCode: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="swiftCode">SWIFT Code</Label>
                    <Input
                      id="swiftCode"
                      value={formData.swiftCode || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, swiftCode: e.target.value || null }))}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="other" className="space-y-4">
                <div className="text-center text-gray-500 py-8">
                  <p>Additional employee information can be managed from the detail view after creating the employee.</p>
                  <p>Use the Visas & Permits tab to manage visa information, and the Documents tab for maritime documents.</p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => createEmployeeMutation.mutate({ ...formData, createUserAccount })}
                disabled={createEmployeeMutation.isPending}
              >
                {createEmployeeMutation.isPending ? "Creating..." : "Create Employee"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Employee Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingEmployee(null);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Employee - {editingEmployee?.firstName} {editingEmployee?.lastName}</DialogTitle>
            </DialogHeader>
            
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="banking">Banking</TabsTrigger>
                <TabsTrigger value="other">Other Details</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="editEmployeeCode">Employee Code</Label>
                    <Input
                      id="editEmployeeCode"
                      value={formData.employeeCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, employeeCode: e.target.value }))}
                      disabled
                    />
                  </div>
                  <div>
                    <Label htmlFor="editCategory">Category</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value as any }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="permanent">Permanent</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="temporary">Temporary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="editFirstName">First Name</Label>
                    <Input
                      id="editFirstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="editLastName">Last Name</Label>
                    <Input
                      id="editLastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="editEmail">Email</Label>
                    <Input
                      id="editEmail"
                      type="email"
                      value={formData.email || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editPhone">Phone</Label>
                    <Input
                      id="editPhone"
                      value={formData.phone || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editPosition">Position</Label>
                    <Input
                      id="editPosition"
                      value={formData.position || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editDepartment">Department</Label>
                    <Input
                      id="editDepartment"
                      value={formData.department || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editHireDate">Hire Date</Label>
                    <Input
                      id="editHireDate"
                      type="date"
                      value={formData.hireDate || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, hireDate: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editSalary">Salary</Label>
                    <Input
                      id="editSalary"
                      type="number"
                      step="0.01"
                      value={formData.salary || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, salary: e.target.value || null }))}
                    />
                  </div>
                  {formData.category === "contract" && (
                    <div>
                      <Label htmlFor="editGrade">Grade</Label>
                      <Select value={formData.grade || ""} onValueChange={(value) => setFormData(prev => ({ ...prev, grade: value || null }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select grade" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Grade 1">Grade 1</SelectItem>
                          <SelectItem value="Grade 2">Grade 2</SelectItem>
                          <SelectItem value="Grade 3">Grade 3</SelectItem>
                          <SelectItem value="Grade 4">Grade 4</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label htmlFor="editIsActive">Status</Label>
                    <Select value={formData.isActive ? "active" : "inactive"} onValueChange={(value) => setFormData(prev => ({ ...prev, isActive: value === "active" }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="personal" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="editDateOfBirth">Date of Birth</Label>
                    <Input
                      id="editDateOfBirth"
                      type="date"
                      value={formData.dateOfBirth || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editHeight">Height (cm)</Label>
                    <Input
                      id="editHeight"
                      value={formData.height || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, height: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editWeight">Weight (kg)</Label>
                    <Input
                      id="editWeight"
                      value={formData.weight || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editBoilerSuitSize">Boiler Suit Size</Label>
                    <Input
                      id="editBoilerSuitSize"
                      value={formData.boilerSuitSize || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, boilerSuitSize: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editSafetyShoeSize">Safety Shoe Size</Label>
                    <Input
                      id="editSafetyShoeSize"
                      value={formData.safetyShoeSize || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, safetyShoeSize: e.target.value || null }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="editAddress">Address</Label>
                    <Textarea
                      id="editAddress"
                      value={formData.address || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value || null }))}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="banking" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="editBankName">Bank Name</Label>
                    <Input
                      id="editBankName"
                      value={formData.bankName || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, bankName: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editBankBranch">Bank Branch</Label>
                    <Input
                      id="editBankBranch"
                      value={formData.bankBranch || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, bankBranch: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editAccountNumber">Account Number</Label>
                    <Input
                      id="editAccountNumber"
                      value={formData.accountNumber || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editAccountHolderName">Account Holder Name</Label>
                    <Input
                      id="editAccountHolderName"
                      value={formData.accountHolderName || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, accountHolderName: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editIfscCode">IFSC Code</Label>
                    <Input
                      id="editIfscCode"
                      value={formData.ifscCode || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, ifscCode: e.target.value || null }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editSwiftCode">SWIFT Code</Label>
                    <Input
                      id="editSwiftCode"
                      value={formData.swiftCode || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, swiftCode: e.target.value || null }))}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="other" className="space-y-4">
                <div className="text-center text-gray-500 py-8">
                  <p>Additional employee information can be managed from the detail view.</p>
                  <p>Use the Visas & Permits tab to manage visa information, and the Documents tab for maritime documents.</p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => updateEmployeeMutation.mutate({ id: editingEmployee!.id, data: formData })}
                disabled={updateEmployeeMutation.isPending || !editingEmployee}
              >
                {updateEmployeeMutation.isPending ? "Updating..." : "Update Employee"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Expiring Documents Alert */}
      {expiringDocuments && (expiringDocuments.visas.length > 0 || expiringDocuments.trainings.length > 0) && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center text-orange-800">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Expiring Documents Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expiringDocuments.visas.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-orange-800 mb-2">Expiring Visas:</h4>
                <div className="space-y-1">
                  {expiringDocuments.visas.map((visa, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <span>{visa.firstName} {visa.lastName} - {visa.documentType}</span>
                      <Badge className={getExpiryBadge(visa.daysToExpiry)}>
                        {visa.daysToExpiry < 0 ? "Expired" : `${visa.daysToExpiry} days`}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {expiringDocuments.trainings.length > 0 && (
              <div>
                <h4 className="font-semibold text-orange-800 mb-2">Expiring Training Certificates:</h4>
                <div className="space-y-1">
                  {expiringDocuments.trainings.map((training, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <span>{training.employee.firstName} {training.employee.lastName} - {training.trainingName}</span>
                      <Badge className={getExpiryBadge(training.daysToExpiry)}>
                        {training.daysToExpiry < 0 ? "Expired" : `${training.daysToExpiry} days`}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Employee List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <User className="h-5 w-5 mr-2" />
            Employees ({employees?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {employees?.map((employee) => (
              <div
                key={employee.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">
                      {employee.firstName} {employee.lastName}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {employee.employeeCode} • {employee.position || "No position"} • {employee.department || "No department"}
                    </p>
                    <div className="flex space-x-2 mt-1">
                      <Badge variant="outline" className={getStatusBadge(employee.category)}>
                        {employee.category}
                      </Badge>
                      {employee.grade && (
                        <Badge variant="outline">
                          {employee.grade}
                        </Badge>
                      )}
                      <Badge variant={employee.isActive ? "default" : "secondary"}>
                        {employee.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewEmployee(employee)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditEmployee(employee)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerateContract(employee.id)}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Contract
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Employee Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedEmployee?.firstName} {selectedEmployee?.lastName} - Employee Details
            </DialogTitle>
          </DialogHeader>

          {selectedEmployee && (
            <Tabs value={detailActiveTab} onValueChange={setDetailActiveTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="personal">Personal Info</TabsTrigger>
                <TabsTrigger value="nextofkin">Next of Kin</TabsTrigger>
                <TabsTrigger value="training">Training Records</TabsTrigger>
                <TabsTrigger value="visas">Visas & Permits</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
              </TabsList>

              <TabsContent value="personal" className="space-y-6">
                <div className="grid grid-cols-3 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Basic Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Employee Code</Label>
                        <p className="font-semibold">{selectedEmployee.employeeCode}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Category</Label>
                        <p className="font-semibold">{selectedEmployee.category}</p>
                      </div>
                      {selectedEmployee.grade && (
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Grade</Label>
                          <p className="font-semibold">{selectedEmployee.grade}</p>
                        </div>
                      )}
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Position</Label>
                        <p className="font-semibold">{selectedEmployee.position || "Not specified"}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Department</Label>
                        <p className="font-semibold">{selectedEmployee.department || "Not specified"}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Hire Date</Label>
                        <p className="font-semibold">{formatDate(selectedEmployee.hireDate)}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Salary</Label>
                        <p className="font-semibold">{selectedEmployee.salary ? `$${parseFloat(selectedEmployee.salary).toLocaleString()}` : "Not specified"}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Personal Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Date of Birth</Label>
                        <p className="font-semibold">{formatDate(selectedEmployee.dateOfBirth)}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Height</Label>
                        <p className="font-semibold">{selectedEmployee.height ? `${selectedEmployee.height} cm` : "Not specified"}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Weight</Label>
                        <p className="font-semibold">{selectedEmployee.weight ? `${selectedEmployee.weight} kg` : "Not specified"}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Email</Label>
                        <p className="font-semibold">{selectedEmployee.email || "Not specified"}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Phone</Label>
                        <p className="font-semibold">{selectedEmployee.phone || "Not specified"}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Address</Label>
                        <p className="font-semibold">{selectedEmployee.address || "Not specified"}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Additional Info</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Boiler Suit Size</Label>
                        <p className="font-semibold">{selectedEmployee.boilerSuitSize || "Not specified"}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Safety Shoe Size</Label>
                        <p className="font-semibold">{selectedEmployee.safetyShoeSize || "Not specified"}</p>
                      </div>

                    </CardContent>
                  </Card>
                </div>

                {(selectedEmployee.bankName || selectedEmployee.accountNumber) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Banking Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Bank Name</Label>
                          <p className="font-semibold">{selectedEmployee.bankName || "Not specified"}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Branch</Label>
                          <p className="font-semibold">{selectedEmployee.bankBranch || "Not specified"}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Account Number</Label>
                          <p className="font-semibold">{selectedEmployee.accountNumber || "Not specified"}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Account Holder</Label>
                          <p className="font-semibold">{selectedEmployee.accountHolderName || "Not specified"}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">IFSC Code</Label>
                          <p className="font-semibold">{selectedEmployee.ifscCode || "Not specified"}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">SWIFT Code</Label>
                          <p className="font-semibold">{selectedEmployee.swiftCode || "Not specified"}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="nextofkin" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Next of Kin Records</h3>
                  <Button
                    onClick={() => {
                      setNextOfKinData({ name: "", email: null, phone: null, relationship: "", isPrimary: false });
                    }}
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Next of Kin
                  </Button>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Add New Next of Kin</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="nokName">Name *</Label>
                        <Input
                          id="nokName"
                          value={nextOfKinData.name}
                          onChange={(e) => setNextOfKinData(prev => ({ ...prev, name: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="nokRelationship">Relationship *</Label>
                        <Select value={nextOfKinData.relationship} onValueChange={(value) => setNextOfKinData(prev => ({ ...prev, relationship: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select relationship" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="spouse">Spouse</SelectItem>
                            <SelectItem value="parent">Parent</SelectItem>
                            <SelectItem value="sibling">Sibling</SelectItem>
                            <SelectItem value="child">Child</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="nokEmail">Email</Label>
                        <Input
                          id="nokEmail"
                          type="email"
                          value={nextOfKinData.email || ""}
                          onChange={(e) => setNextOfKinData(prev => ({ ...prev, email: e.target.value || null }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="nokPhone">Phone</Label>
                        <Input
                          id="nokPhone"
                          value={nextOfKinData.phone || ""}
                          onChange={(e) => setNextOfKinData(prev => ({ ...prev, phone: e.target.value || null }))}
                        />
                      </div>
                      <div className="col-span-2">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="nokPrimary"
                            checked={nextOfKinData.isPrimary}
                            onCheckedChange={(checked) => setNextOfKinData(prev => ({ ...prev, isPrimary: checked }))}
                          />
                          <Label htmlFor="nokPrimary">Primary contact</Label>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <Button
                          onClick={() => {
                            if (editingNextOfKin) {
                              updateNextOfKinMutation.mutate({
                                id: editingNextOfKin.id,
                                data: nextOfKinData,
                              });
                            } else {
                              createNextOfKinMutation.mutate(nextOfKinData);
                            }
                          }}
                          disabled={
                            !nextOfKinData.name ||
                            !nextOfKinData.relationship ||
                            createNextOfKinMutation.isPending ||
                            updateNextOfKinMutation.isPending
                          }
                        >
                          {createNextOfKinMutation.isPending ||
                          updateNextOfKinMutation.isPending
                            ? editingNextOfKin
                              ? "Updating..."
                              : "Adding..."
                            : editingNextOfKin
                            ? "Update Next of Kin"
                            : "Add Next of Kin"}
                        </Button>

                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  {nextOfKinLoading ? (
                    <Card>
                      <CardContent className="p-6 text-center">
                        <p>Loading next of kin records...</p>
                      </CardContent>
                    </Card>
                  ) : !selectedEmployeeNextOfKin || selectedEmployeeNextOfKin.length === 0 ? (
                    <Card>
                      <CardContent className="p-6 text-center">
                        <User className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Next of Kin Records</h3>
                        <p className="text-gray-500 mb-4">Add emergency contacts and next of kin information for this employee.</p>
                        <Button
                          onClick={() => {
                            setNextOfKinData({ name: "", email: null, phone: null, relationship: "", isPrimary: false });
                          }}
                          size="sm"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add First Next of Kin
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    selectedEmployeeNextOfKin?.map((nok) => (
                    <Card key={nok.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="grid grid-cols-2 gap-4 flex-1">
                            <div>
                              <Label className="text-sm font-medium text-gray-600">Name</Label>
                              <p className="font-semibold">{nok.name}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-gray-600">Relationship</Label>
                              <div className="flex items-center space-x-2">
                                <p className="font-semibold">{nok.relationship}</p>
                                {nok.isPrimary && <Badge className="bg-blue-100 text-blue-800">Primary</Badge>}
                              </div>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-gray-600">Email</Label>
                              <p className="font-semibold">{nok.email || "Not provided"}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-gray-600">Phone</Label>
                              <p className="font-semibold">{nok.phone || "Not provided"}</p>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingNextOfKin(nok);
                                setNextOfKinData({
                                  name: nok.name,
                                  email: nok.email,
                                  phone: nok.phone,
                                  relationship: nok.relationship,
                                  isPrimary: nok.isPrimary,
                                });
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>

                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => deleteNextOfKinMutation.mutate(nok.id)}
                              disabled={deleteNextOfKinMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )))}
                </div>
              </TabsContent>

              <TabsContent value="training" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Training Records</h3>
                  <Button
                    onClick={() => {
                      setEditingTraining(null),
                      setTrainingData({
                        trainingName: "",
                        trainingProvider: "Aquanav",
                        certificationNumber: null,
                        trainingDate: "",
                        expiryDate: null,
                        status: "active",
                        notes: null,
                        attachments: [],
                      });
                    }}
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Training Record
                  </Button>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Add New Training Record</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="trainingName">Training Name *</Label>
                        <Input
                          id="trainingName"
                          value={trainingData.trainingName}
                          onChange={(e) => setTrainingData(prev => ({ ...prev, trainingName: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="trainingProvider">Training Provider</Label>
                        <Input
                          id="trainingProvider"
                          value={trainingData.trainingProvider}
                          onChange={(e) => setTrainingData(prev => ({ ...prev, trainingProvider: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="certificationNumber">Certification Number</Label>
                        <Input
                          id="certificationNumber"
                          value={trainingData.certificationNumber || ""}
                          onChange={(e) => setTrainingData(prev => ({ ...prev, certificationNumber: e.target.value || null }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="trainingDate">Training Date *</Label>
                        <Input
                          id="trainingDate"
                          type="date"
                          value={trainingData.trainingDate}
                          onChange={(e) => setTrainingData(prev => ({ ...prev, trainingDate: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="expiryDate">Expiry Date</Label>
                        <Input
                          id="expiryDate"
                          type="date"
                          value={trainingData.expiryDate || ""}
                          onChange={(e) => setTrainingData(prev => ({ ...prev, expiryDate: e.target.value || null }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="trainingStatus">Status</Label>
                        <Select value={trainingData.status} onValueChange={(value) => setTrainingData(prev => ({ ...prev, status: value as any }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor="trainingNotes">Notes</Label>
                        <Textarea
                          id="trainingNotes"
                          value={trainingData.notes || ""}
                          onChange={(e) => setTrainingData(prev => ({ ...prev, notes: e.target.value || null }))}
                        />
                      </div>
                      <div className="col-span-2">
                        <Button
                          onClick={() => {
                            if (editingTraining) {
                              updateTrainingRecordMutation.mutate({
                                id: editingTraining.id,
                                data: trainingData,
                              });
                            } else {
                              createTrainingRecordMutation.mutate(trainingData);
                            }
                          }}
                          disabled={
                            !trainingData.trainingName ||
                            !trainingData.trainingDate ||
                            createTrainingRecordMutation.isPending ||
                            updateTrainingRecordMutation.isPending
                          }
                        >
                          {createTrainingRecordMutation.isPending ||
                          updateTrainingRecordMutation.isPending
                            ? editingTraining
                              ? "Updating..."
                              : "Adding..."
                            : editingTraining
                            ? "Update Training Record"
                            : "Add Training Record"}
                        </Button>

                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  {!selectedEmployeeTrainingRecords || selectedEmployeeTrainingRecords.length === 0 ? (
                    <Card>
                      <CardContent className="p-6 text-center">
                        <GraduationCap className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Training Records</h3>
                        <p className="text-gray-500 mb-4">Add training certifications and courses completed by this employee.</p>
                        <Button
                          onClick={() => {
                            setTrainingData({
                              trainingName: "",
                              trainingProvider: "Aquanav",
                              certificationNumber: null,
                              trainingDate: "",
                              expiryDate: null,
                              status: "active",
                              notes: null,
                              attachments: [],
                            });
                          }}
                          size="sm"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add First Training Record
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    selectedEmployeeTrainingRecords?.map((training) => (
                    <Card key={training.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="grid grid-cols-3 gap-4 flex-1">
                            <div>
                              <Label className="text-sm font-medium text-gray-600">Training Name</Label>
                              <p className="font-semibold">{training.trainingName}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-gray-600">Provider</Label>
                              <p className="font-semibold">{training.trainingProvider}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-gray-600">Certification #</Label>
                              <p className="font-semibold">{training.certificationNumber || "Not provided"}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-gray-600">Training Date</Label>
                              <p className="font-semibold">{formatDate(training.trainingDate)}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-gray-600">Expiry Date</Label>
                              <p className="font-semibold">{formatDate(training.expiryDate)}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-gray-600">Status</Label>
                              <Badge className={getStatusBadge(training.status)}>
                                {training.status}
                              </Badge>
                            </div>
                            {training.notes && (
                              <div className="col-span-3">
                                <Label className="text-sm font-medium text-gray-600">Notes</Label>
                                <p className="text-sm">{training.notes}</p>
                              </div>
                            )}
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingTraining(training);
                                setTrainingData({
                                  trainingName: training.trainingName,
                                  trainingProvider: training.trainingProvider,
                                  certificationNumber: training.certificationNumber,
                                  trainingDate: training.trainingDate
                                    ? new Date(training.trainingDate).toISOString().split("T")[0]
                                    : "",
                                  expiryDate: training.expiryDate
                                    ? new Date(training.expiryDate).toISOString().split("T")[0]
                                    : null,
                                  status: training.status,
                                  notes: training.notes,
                                  attachments: [],
                                });
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this training record?")) {
                                  deleteTrainingRecordMutation.mutate(training.id);
                                }
                              }}
                              disabled={deleteTrainingRecordMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>

                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="visas" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Visas & Permits</h3>
                  <Dialog
                    open={isDocumentDialogOpen}
                    onOpenChange={(open) => {
                      setIsDocumentDialogOpen(open);

                      if (!open) {
                        setEditingDocument(null);
                        setSelectedFiles(null);
                        resetDocumentForm();
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        onClick={() => {
                          setEditingDocument(null);
                          resetDocumentForm();
                          setSelectedFiles(null);
                          setIsDocumentDialogOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Visa/Permit
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>
                          {editingDocument ? "Edit Visa/Permit" : "Add New Visa/Permit"}
                        </DialogTitle>
                      </DialogHeader>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="documentType">Document Type</Label>
                          <Select 
                            value={documentData.documentType} 
                            onValueChange={(value) => setDocumentData(prev => ({ ...prev, documentType: value as any }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="us_visa">US Visa</SelectItem>
                              <SelectItem value="schengen_visa">Schengen Visa (EU)</SelectItem>
                              <SelectItem value="uk_visa">UK Visa</SelectItem>
                              <SelectItem value="canada_visa">Canada Visa</SelectItem>
                              <SelectItem value="australia_visa">Australia Visa</SelectItem>
                              <SelectItem value="uae_visa">UAE Visa</SelectItem>
                              <SelectItem value="saudi_visa">Saudi Arabia Visa</SelectItem>
                              <SelectItem value="singapore_visa">Singapore Visa</SelectItem>
                              <SelectItem value="work_permit">Work Permit</SelectItem>
                              <SelectItem value="residence_permit">Residence Permit</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="documentNumber">Document Number</Label>
                          <Input
                            id="documentNumber"
                            value={documentData.documentNumber || ""}
                            onChange={(e) => setDocumentData(prev => ({ ...prev, documentNumber: e.target.value || null }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="placeOfIssue">Place of Issue</Label>
                          <Input
                            id="placeOfIssue"
                            value={documentData.placeOfIssue || ""}
                            onChange={(e) => setDocumentData(prev => ({ ...prev, placeOfIssue: e.target.value || null }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="dateOfIssue">Date of Issue</Label>
                          <Input
                            id="dateOfIssue"
                            type="date"
                            value={documentData.dateOfIssue || ""}
                            onChange={(e) => setDocumentData(prev => ({ ...prev, dateOfIssue: e.target.value || null }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="expiryDate">Expiry Date</Label>
                          <Input
                            id="expiryDate"
                            type="date"
                            value={documentData.expiryDate || ""}
                            onChange={(e) => setDocumentData(prev => ({ ...prev, expiryDate: e.target.value || null }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="status">Status</Label>
                          <Select 
                            value={documentData.status} 
                            onValueChange={(value) => setDocumentData(prev => ({ ...prev, status: value as any }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="expired">Expired</SelectItem>
                              <SelectItem value="pending_renewal">Pending Renewal</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2">
                          <Label htmlFor="notes">Notes</Label>
                          <Textarea
                            id="notes"
                            value={documentData.notes || ""}
                            onChange={(e) => setDocumentData(prev => ({ ...prev, notes: e.target.value || null }))}
                          />
                        </div>
                        {/* Existing attachments (Edit mode only) */}
                        {editingDocument?.attachmentPaths?.length > 0 && (
                          <div className="col-span-2">
                            <Label className="mb-2 block">Existing Attachments</Label>

                            <div className="space-y-2 rounded-md border p-3 bg-gray-50">
                              {editingDocument.attachmentPaths.map((file: any, index: number) => {
                                const fileUrl = `${file.filePath}`;

                                return (
                                  <div
                                    key={index}
                                    className="flex items-center justify-between text-sm"
                                  >
                                    <span className="truncate max-w-[60%]">
                                      {file.originalName}
                                    </span>

                                    <div className="flex gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        asChild
                                      >
                                        <a
                                          href={fileUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >
                                          View
                                        </a>
                                       </Button>

                                      {/*<Button
                                        variant="outline"
                                        size="sm"
                                        asChild
                                      >
                                        <a
                                          href={fileUrl}
                                          download
                                        >
                                          Download
                                        </a>
                                      </Button> */}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <div className="col-span-2">
                          <Label>Attachments</Label>

                          <Input type="file" multiple onChange={e => setSelectedFiles(e.target.files)} />
                        </div>
                        <div className="col-span-2">
                          <Button
                            onClick={() => {
                              if (editingDocument) {
                                updateDocumentMutation.mutate({ 
                                  id: editingDocument.id, 
                                  data: documentData 
                                });
                              } else {
                                createDocumentMutation.mutate(documentData);
                              }
                            }}
                            disabled={!documentData.documentType || createDocumentMutation.isPending || updateDocumentMutation.isPending}
                          >
                            {createDocumentMutation.isPending || updateDocumentMutation.isPending 
                              ? (editingDocument ? "Updating..." : "Adding...") 
                              : (editingDocument ? "Update Visa/Permit" : "Add Visa/Permit")
                            }
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-4">
                  {(() => {
                    const visaDocuments = selectedEmployeeDocuments?.filter(doc => 
                      ['us_visa', 'schengen_visa', 'uk_visa', 'canada_visa', 'australia_visa', 'uae_visa', 'saudi_visa', 'singapore_visa', 'work_permit', 'residence_permit'].includes(doc.documentType)
                    ) || [];
                    
                    if (visaDocuments.length === 0) {
                      return (
                        <Card>
                          <CardContent className="p-6 text-center">
                            <FileText className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No Visa/Permit Records</h3>
                            <p className="text-gray-500 mb-4">Add visa and permit documentation for international travel and work authorization.</p>
                          </CardContent>
                        </Card>
                      );
                    }
                    
                    return visaDocuments.map((document) => {
                    const isExpiringSoon = document.expiryDate && 
                      new Date(document.expiryDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                    
                    return (
                      <Card key={document.id} className={isExpiringSoon ? 'border-orange-300 bg-orange-50' : ''}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="grid grid-cols-3 gap-4 flex-1">
                              <div>
                                <Label className="text-sm font-medium text-gray-600">Document Type</Label>
                                <p className="font-semibold capitalize">
                                  {document.documentType.replace(/_/g, ' ')}
                                </p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-600">Document Number</Label>
                                <p className="font-semibold">{document.documentNumber || "Not provided"}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-600">Place of Issue</Label>
                                <p className="font-semibold">{document.placeOfIssue || "Not provided"}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-600">Date of Issue</Label>
                                <p className="font-semibold">{formatDate(document.dateOfIssue)}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-600">Expiry Date</Label>
                                <p className="font-semibold">{formatDate(document.expiryDate)}</p>
                                {isExpiringSoon && (
                                  <Badge className="mt-1 bg-orange-100 text-orange-800">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Expiring Soon
                                  </Badge>
                                )}
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-600">Status</Label>
                                <Badge className={getStatusBadge(document.status)}>
                                  {document.status}
                                </Badge>
                              </div>
                              {document.notes && (
                                <div className="col-span-3">
                                  <Label className="text-sm font-medium text-gray-600">Notes</Label>
                                  <p className="text-sm">{document.notes}</p>
                                </div>
                              )}
                            </div>
                            <div className="flex space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setEditingDocument(document);
                                  setDocumentData({
                                    documentType: document.documentType,
                                    documentNumber: document.documentNumber,
                                    placeOfIssue: document.placeOfIssue,
                                    dateOfIssue: document.dateOfIssue ? new Date(document.dateOfIssue).toISOString().split('T')[0] : null,
                                    expiryDate: document.expiryDate ? new Date(document.expiryDate).toISOString().split('T')[0] : null,
                                    validTill: document.validTill ? new Date(document.validTill).toISOString().split('T')[0] : null,
                                    status: document.status,
                                    notes: document.notes,
                                    filePath: document.filePath,
                                  });
                                  setIsDocumentDialogOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => deleteDocumentMutation.mutate(document.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                    });
                  })()}
                </div>
              </TabsContent>

              <TabsContent value="documents" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Maritime Documents</h3>
                  <Dialog
                    open={isDocumentDialogOpen}
                    onOpenChange={(open) => {
                      setIsDocumentDialogOpen(open);

                      if (!open) {
                        setEditingDocument(null);
                        setSelectedFiles(null);
                        resetDocumentForm();
                      }
                    }}
                  >

                    <DialogTrigger asChild>
                      <Button
                        onClick={() => {
                          setEditingDocument(null);
                          resetDocumentForm();
                          setSelectedFiles(null);
                          setIsDocumentDialogOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Document
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>
                          {editingDocument ? "Edit Maritime Document" : "Add New Maritime Document"}
                        </DialogTitle>
                      </DialogHeader>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="documentType">Document Type</Label>
                          <Select 
                            value={documentData.documentType} 
                            onValueChange={(value) => setDocumentData(prev => ({ ...prev, documentType: value as any }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="passport">Passport</SelectItem>
                              <SelectItem value="cdc">CDC (Seaman Book)</SelectItem>
                              <SelectItem value="covid_vaccination">COVID Vaccination Certificate</SelectItem>
                              <SelectItem value="stcw_course">STCW Course Certificate</SelectItem>
                              <SelectItem value="sid">SID (Seafarer Identity Document)</SelectItem>
                              <SelectItem value="ilo_medical">ILO DG Medical Certificate</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="documentNumber">Document Number</Label>
                          <Input
                            id="documentNumber"
                            value={documentData.documentNumber || ""}
                            onChange={(e) => setDocumentData(prev => ({ ...prev, documentNumber: e.target.value || null }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="placeOfIssue">Place of Issue</Label>
                          <Input
                            id="placeOfIssue"
                            value={documentData.placeOfIssue || ""}
                            onChange={(e) => setDocumentData(prev => ({ ...prev, placeOfIssue: e.target.value || null }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="dateOfIssue">Date of Issue</Label>
                          <Input
                            id="dateOfIssue"
                            type="date"
                            value={documentData.dateOfIssue || ""}
                            onChange={(e) => setDocumentData(prev => ({ ...prev, dateOfIssue: e.target.value || null }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="expiryDate">Expiry Date</Label>
                          <Input
                            id="expiryDate"
                            type="date"
                            value={documentData.expiryDate || ""}
                            onChange={(e) => setDocumentData(prev => ({ ...prev, expiryDate: e.target.value || null }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="status">Status</Label>
                          <Select 
                            value={documentData.status} 
                            onValueChange={(value) => setDocumentData(prev => ({ ...prev, status: value as any }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="expired">Expired</SelectItem>
                              <SelectItem value="pending_renewal">Pending Renewal</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2">
                          <Label htmlFor="notes">Notes</Label>
                          <Textarea
                            id="notes"
                            value={documentData.notes || ""}
                            onChange={(e) => setDocumentData(prev => ({ ...prev, notes: e.target.value || null }))}
                          />
                        </div>
                        {/* Existing attachments (Edit mode only) */}
                        {editingDocument?.attachmentPaths?.length > 0 && (
                          <div className="col-span-2">
                            <Label className="mb-2 block">Existing Attachments</Label>

                            <div className="space-y-2 rounded-md border p-3 bg-gray-50">
                              {editingDocument.attachmentPaths.map((file: any, index: number) => {
                                const fileUrl = `${file.filePath}`;

                                return (
                                  <div
                                    key={index}
                                    className="flex items-center justify-between text-sm"
                                  >
                                    <span className="truncate max-w-[60%]">
                                      {file.originalName}
                                    </span>

                                    <div className="flex gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        asChild
                                      >
                                        <a
                                          href={fileUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >
                                          View
                                        </a>
                                       </Button>

                                      {/*<Button
                                        variant="outline"
                                        size="sm"
                                        asChild
                                      >
                                        <a
                                          href={fileUrl}
                                          download
                                        >
                                          Download
                                        </a>
                                      </Button> */}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="col-span-2">
                          <Label>Attachments</Label>

                          <Input type="file" multiple onChange={e => setSelectedFiles(e.target.files)} />
                        </div>
                        <div className="col-span-2">
                          <Button
                            onClick={() => {
                              if (editingDocument) {
                                updateDocumentMutation.mutate({ 
                                  id: editingDocument.id, 
                                  data: documentData 
                                });
                              } else {
                                createDocumentMutation.mutate(documentData);
                              }
                            }}
                            disabled={!documentData.documentType || createDocumentMutation.isPending || updateDocumentMutation.isPending}
                          >
                            {createDocumentMutation.isPending || updateDocumentMutation.isPending 
                              ? (editingDocument ? "Updating..." : "Adding...") 
                              : (editingDocument ? "Update Document" : "Add Document")
                            }
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-4">
                  {(() => {
                    const maritimeDocuments = selectedEmployeeDocuments?.filter(doc => 
                      ['passport', 'cdc', 'covid_vaccination', 'stcw_course', 'sid', 'ilo_medical'].includes(doc.documentType)
                    ) || [];
                    
                    if (maritimeDocuments.length === 0) {
                      return (
                        <Card>
                          <CardContent className="p-6 text-center">
                            <FileText className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No Maritime Documents</h3>
                            <p className="text-gray-500 mb-4">Add essential maritime documents like passport, CDC, vaccination certificates, and STCW courses.</p>
                          </CardContent>
                        </Card>
                      );
                    }
                    
                    return maritimeDocuments.map((document) => {
                    const isExpiringSoon = document.expiryDate && 
                      new Date(document.expiryDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                    
                    return (
                      <Card key={document.id} className={isExpiringSoon ? 'border-orange-300 bg-orange-50' : ''}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="grid grid-cols-3 gap-4 flex-1">
                              <div>
                                <Label className="text-sm font-medium text-gray-600">Document Type</Label>
                                <p className="font-semibold capitalize">
                                  {document.documentType.replace(/_/g, ' ')}
                                </p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-600">Document Number</Label>
                                <p className="font-semibold">{document.documentNumber || "Not provided"}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-600">Place of Issue</Label>
                                <p className="font-semibold">{document.placeOfIssue || "Not provided"}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-600">Date of Issue</Label>
                                <p className="font-semibold">{formatDate(document.dateOfIssue)}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-600">Expiry Date</Label>
                                <p className="font-semibold">{formatDate(document.expiryDate)}</p>
                                {isExpiringSoon && (
                                  <Badge className="mt-1 bg-orange-100 text-orange-800">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Expiring Soon
                                  </Badge>
                                )}
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-600">Status</Label>
                                <Badge className={getStatusBadge(document.status)}>
                                  {document.status}
                                </Badge>
                              </div>
                              {document.notes && (
                                <div className="col-span-3">
                                  <Label className="text-sm font-medium text-gray-600">Notes</Label>
                                  <p className="text-sm">{document.notes}</p>
                                </div>
                              )}
                            </div>
                            <div className="flex space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setEditingDocument(document);
                                  setDocumentData({
                                    documentType: document.documentType,
                                    documentNumber: document.documentNumber,
                                    placeOfIssue: document.placeOfIssue,
                                    dateOfIssue: document.dateOfIssue ? new Date(document.dateOfIssue).toISOString().split('T')[0] : null,
                                    expiryDate: document.expiryDate ? new Date(document.expiryDate).toISOString().split('T')[0] : null,
                                    validTill: document.validTill ? new Date(document.validTill).toISOString().split('T')[0] : null,
                                    status: document.status,
                                    notes: document.notes,
                                    filePath: document.filePath,
                                  });
                                  setIsDocumentDialogOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => deleteDocumentMutation.mutate(document.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                    });
                  })()}
                </div>

                <div className="mt-8">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center">
                        <FileText className="h-5 w-5 mr-2" />
                        Employment Contract
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 mb-4">
                        Generate a UAE-compliant employment contract with employee details.
                      </p>
                      <Button
                        onClick={() => handleGenerateContract(selectedEmployee.id)}
                        className="w-full"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Generate Employment Contract
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}