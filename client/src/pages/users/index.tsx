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
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Users, Plus, Mail, Shield, Edit, Trash2, UserCheck, UserX, Briefcase, Search } from "lucide-react";
import { Autocomplete } from "@/components/ui/autocomplete";
import { User, insertUserSchema, Employee } from "@shared/schema";
import { z } from "zod";

const createUserSchema = insertUserSchema;
type CreateUserData = z.infer<typeof createUserSchema> & { employeeId?: string };

interface UserWithoutPassword extends Omit<User, 'password'> { }

export default function UsersIndex() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithoutPassword | null>(null);

  const [formData, setFormData] = useState<CreateUserData>({
    username: "",
    email: "",
    password: "",
    role: "employee",
    isActive: true,
    employeeId: "",
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    } else if (user?.role !== "admin") {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user, setLocation]);

  const { data: users, isLoading } = useQuery<UserWithoutPassword[]>({
    queryKey: ["/api/users"],
    enabled: isAuthenticated && user?.role === "admin",
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    enabled: isAuthenticated && user?.role === "admin",
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserData) => {
      const response = await apiRequest("/api/users", {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to create user");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "User Created",
        description: "The user has been created successfully.",
      });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<CreateUserData>;
    }) => {
      const response = await apiRequest(`/api/users/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to update user");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "User Updated",
        description: "The user has been updated successfully.",
      });
      setEditingUser(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/users/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to delete user");
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User Deleted",
        description: "The user has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });


  const resetForm = () => {
    setFormData({
      username: "",
      email: "",
      password: "",
      role: "employee",
      isActive: true,
      employeeId: "",
    });
    setIsDialogOpen(false);
    setEditingUser(null);
  };

  // Find employee linked to a user
  const getLinkedEmployee = (userId: number) => {
    return employees.find(e => e.userId === userId);
  };

  // Get available employees (not linked to any user, or linked to current editing user)
  const getAvailableEmployees = () => {
    return employees.filter(e => !e.userId || (editingUser && e.userId === editingUser.id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      const updateData: Partial<CreateUserData> = { ...formData };
      if (!updateData.password) {
        const { password, ...dataWithoutPassword } = updateData;
        updateUserMutation.mutate({ id: editingUser.id, data: dataWithoutPassword });
      } else {
        updateUserMutation.mutate({ id: editingUser.id, data: updateData });
      }
    } else {
      createUserMutation.mutate(formData);
    }
  };

  const handleChange = (field: keyof CreateUserData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEdit = (userToEdit: UserWithoutPassword) => {
    setEditingUser(userToEdit);
    const linkedEmployee = getLinkedEmployee(userToEdit.id);
    setFormData({
      username: userToEdit.username,
      email: userToEdit.email,
      password: "",
      role: userToEdit.role,
      isActive: userToEdit.isActive,
      employeeId: linkedEmployee?.id?.toString() || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      deleteUserMutation.mutate(id);
    }
  };

  const toggleUserStatus = (userToUpdate: UserWithoutPassword) => {
    updateUserMutation.mutate({
      id: userToUpdate.id,
      data: { isActive: !userToUpdate.isActive }
    });
  };

  if (!isAuthenticated || user?.role !== "admin") {
    return null;
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin": return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
      case "project_manager": return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
      case "finance": return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      case "employee": return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
      // case "customer": return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
    }
  };

  const roleDisplayNames: Record<string, string> = {
    admin: "Administrator",
    project_manager: "Project Manager",
    finance: "Finance",
    employee: "Employee",
    // customer: "Customer",
  };

  return (
    <div className="p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">User Management</h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">Manage user accounts and access permissions</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingUser(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => handleChange("username", e.target.value)}
                  placeholder="e.g., johndoe"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="john@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  Password {editingUser ? "(leave blank to keep current)" : "*"}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  placeholder="Enter secure password"
                  required={!editingUser}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select value={formData.role} onValueChange={(value) => handleChange("role", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="project_manager">Project Manager</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                    {/*<SelectItem value="customer">Customer</SelectItem>*/}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="employeeId">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Link to Employee
                  </div>
                </Label>
                {editingUser && getLinkedEmployee(editingUser.id) ? (
                  <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-md text-sm">
                    <p className="font-medium">Linked to: {getLinkedEmployee(editingUser.id)?.firstName} {getLinkedEmployee(editingUser.id)?.lastName}</p>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                      Employee cannot be changed once linked
                    </p>
                  </div>
                ) : (
                  <Autocomplete
                    options={getAvailableEmployees().map((emp) => ({
                      value: emp.id.toString(),
                      label: `${emp.firstName} ${emp.lastName} (${emp.employeeCode})`,
                      searchText: `${emp.firstName} ${emp.lastName} ${emp.employeeCode}`,
                    }))}
                    value={formData.employeeId || ""}
                    onValueChange={(value) => handleChange("employeeId", value)}
                    placeholder="Search by name or code..."
                  />
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => handleChange("isActive", checked)}
                />
                <Label htmlFor="isActive">Active User</Label>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createUserMutation.isPending || updateUserMutation.isPending}
                >
                  {createUserMutation.isPending || updateUserMutation.isPending
                    ? (editingUser ? "Updating..." : "Creating...")
                    : (editingUser ? "Update User" : "Create User")
                  }
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center">
              <div className="p-1.5 sm:p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Users className="h-4 w-4 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-2 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">Total Users</p>
                <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {users?.length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center">
              <div className="p-1.5 sm:p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <UserCheck className="h-4 w-4 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-2 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">Active</p>
                <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {users?.filter(u => u.isActive).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center">
              <div className="p-1.5 sm:p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <UserX className="h-4 w-4 sm:h-6 sm:w-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="ml-2 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">Inactive</p>
                <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {users?.filter(u => !u.isActive).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center">
              <div className="p-1.5 sm:p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <Shield className="h-4 w-4 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="ml-2 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">Admins</p>
                <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {users?.filter(u => u.role === "admin").length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400">Loading users...</p>
        </div>
      ) : !users || users.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-16 w-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No users found</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              Start by creating your first user account
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First User
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-6">
          {users.map((userItem) => (
            <Card key={userItem.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-3 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                  <div className="flex items-start space-x-3 sm:space-x-4">
                    <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center flex-shrink-0 ${userItem.isActive
                      ? "bg-ocean-100 dark:bg-ocean-900/20"
                      : "bg-gray-100 dark:bg-gray-900/20"
                      }`}>
                      <Users className={`h-5 w-5 sm:h-6 sm:w-6 ${userItem.isActive
                        ? "text-ocean-600 dark:text-ocean-400"
                        : "text-gray-400"
                        }`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                        <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {userItem.username}
                        </h3>
                        <Badge className={`text-xs ${getRoleBadgeColor(userItem.role)}`}>
                          {roleDisplayNames[userItem.role] || userItem.role}
                        </Badge>
                        {!userItem.isActive && (
                          <Badge variant="outline" className="text-xs border-red-300 text-red-600">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
                        <div className="flex items-center space-x-1 min-w-0">
                          <Mail className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400 flex-shrink-0" />
                          <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 truncate">
                            {userItem.email}
                          </span>
                        </div>
                        <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                          ID: {userItem.id}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Created: {new Date(userItem.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleUserStatus(userItem)}
                      disabled={updateUserMutation.isPending}
                      className="text-xs sm:text-sm"
                    >
                      {userItem.isActive ? <UserX className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> : <UserCheck className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />}
                      <span className="hidden sm:inline">{userItem.isActive ? "Deactivate" : "Activate"}</span>
                      <span className="sm:hidden">{userItem.isActive ? "Off" : "On"}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(userItem)}
                      className="text-xs sm:text-sm"
                    >
                      <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(userItem.id)}
                      disabled={deleteUserMutation.isPending}
                      className="text-xs sm:text-sm text-red-600 hover:text-red-700 border-red-300"
                    >
                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      <span className="hidden sm:inline">Delete</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}