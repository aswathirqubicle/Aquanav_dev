import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatDateForInput, formatDisplayDate } from "@/lib/utils";

interface ProfileEmployee {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  grade: number | null;
  department: string | null;
  position: string | null;
  joiningReadinessDate: string | null;
}

interface NextOfKin {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  relationship: string;
  isPrimary: boolean;
}

interface TrainingRecord {
  id: number;
  trainingName: string;
  trainingProvider: string;
  certificationNumber: string | null;
  trainingDate: string;
  expiryDate: string | null;
  status: string;
}

interface EmployeeDoc {
  id: number;
  documentType: string;
  documentNumber: string | null;
  placeOfIssue: string | null;
  dateOfIssue: string | null;
  expiryDate: string | null;
  validTill: string | null;
  status: string;
}

interface ReadinessHistoryEntry {
  id: number;
  oldDate: string | null;
  newDate: string | null;
  changedByName: string | null;
  changedAt: string;
}

interface ProfileResponse {
  employee: ProfileEmployee | null;
  nextOfKin: NextOfKin[];
  documents: EmployeeDoc[];
  trainingRecords: TrainingRecord[];
  readinessHistory: ReadinessHistoryEntry[];
}

const dash = (value: unknown) =>
  value === null || value === undefined || value === "" ? "—" : String(value);

/** document_type is stored as a slug like "ilo_medical". */
const titleise = (value: string) =>
  value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="space-y-1">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-sm font-medium">{value}</p>
  </div>
);

export default function ProfileIndex() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<ProfileResponse>({
    queryKey: ["/api/profile/me"],
    queryFn: async () => {
      const response = await apiRequest("/api/profile/me");
      return response.json();
    },
  });

  const employee = data?.employee ?? null;

  const [readinessDate, setReadinessDate] = useState("");

  // Seeded from the server rather than held as the only copy, so a save
  // elsewhere (an admin setting it) is reflected when the query refetches.
  useEffect(() => {
    setReadinessDate(
      employee?.joiningReadinessDate
        ? formatDateForInput(employee.joiningReadinessDate)
        : "",
    );
  }, [employee?.joiningReadinessDate]);

  const readinessMutation = useMutation({
    mutationFn: async (value: string) => {
      // Empty clears the date — it is optional, so this is a valid save and
      // must send null rather than an empty string.
      const response = await apiRequest("/api/profile/joining-readiness", {
        method: "PATCH",
        body: { joiningReadinessDate: value.trim() === "" ? null : value },
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/me"] });
      toast({
        title: "Saved",
        description: "Your joining readiness has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update joining readiness.",
        variant: "destructive",
      });
    },
  });

  // --- Change password (unchanged from the original page) ---
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      await apiRequest("/api/auth/change-password", {
        method: "POST",
        body: {
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        },
      });
      toast({
        title: "Success",
        description: "Your password has been changed successfully.",
      });
      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to change password.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const passwordCard = (
    <Card>
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
        <CardDescription>
          Update your password here. Please choose a strong password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              value={formData.currentPassword}
              onChange={handleChange}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              value={formData.newPassword}
              onChange={handleChange}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
            />
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Loading your profile…
          </CardContent>
        </Card>
      </div>
    );
  }

  // Plenty of accounts have no employee record — customers and service users
  // among them. That is not an error, so show what still applies.
  if (!employee) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">My Profile</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {user?.username}. This account is not linked to an
            employee record, so only your password settings are shown.
          </p>
        </div>
        {passwordCard}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">
          {employee.firstName} {employee.lastName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {employee.employeeCode}
          {employee.position ? ` · ${employee.position}` : ""}
        </p>
      </div>

      <Tabs defaultValue="basic">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="nextofkin">Next of Kin</TabsTrigger>
          <TabsTrigger value="training">Training</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="readiness">Joining Readiness</TabsTrigger>
          <TabsTrigger value="password">Change Password</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-4">
          <Card>
            <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <Field label="Employee Code" value={dash(employee.employeeCode)} />
              <Field label="First Name" value={dash(employee.firstName)} />
              <Field label="Last Name" value={dash(employee.lastName)} />
              <Field label="Email" value={dash(employee.email)} />
              <Field label="Phone" value={dash(employee.phone)} />
              <Field label="Grade" value={dash(employee.grade)} />
              <Field label="Department" value={dash(employee.department)} />
              <Field label="Position" value={dash(employee.position)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nextofkin" className="mt-4">
          <Card>
            <CardContent className="p-6">
              {(data?.nextOfKin ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No next of kin recorded.
                </p>
              ) : (
                <div className="space-y-4">
                  {(data?.nextOfKin ?? []).map((kin) => (
                    <div
                      key={kin.id}
                      className="border rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
                    >
                      <Field
                        label="Name"
                        value={
                          <span className="flex items-center gap-2">
                            {dash(kin.name)}
                            {kin.isPrimary && (
                              <Badge variant="secondary" className="text-xs">
                                Primary
                              </Badge>
                            )}
                          </span>
                        }
                      />
                      <Field
                        label="Relationship"
                        value={dash(titleise(kin.relationship))}
                      />
                      <Field label="Phone" value={dash(kin.phone)} />
                      <Field label="Email" value={dash(kin.email)} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="training" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {(data?.trainingRecords ?? []).length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  No training records.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px]">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Training</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Certificate No.</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {(data?.trainingRecords ?? []).map((record) => (
                        <tr key={record.id}>
                          <td className="px-4 py-3 text-sm font-medium">{dash(record.trainingName)}</td>
                          <td className="px-4 py-3 text-sm">{dash(record.trainingProvider)}</td>
                          <td className="px-4 py-3 text-sm">{dash(record.certificationNumber)}</td>
                          <td className="px-4 py-3 text-sm">{record.trainingDate ? formatDisplayDate(record.trainingDate) : "—"}</td>
                          <td className="px-4 py-3 text-sm">{record.expiryDate ? formatDisplayDate(record.expiryDate) : "—"}</td>
                          <td className="px-4 py-3 text-sm">
                            <Badge variant="secondary" className="text-xs">
                              {titleise(record.status)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {(data?.documents ?? []).length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  No documents uploaded.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px]">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Document</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Place of Issue</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issued</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {(data?.documents ?? []).map((doc) => (
                        <tr key={doc.id}>
                          <td className="px-4 py-3 text-sm font-medium">{dash(titleise(doc.documentType))}</td>
                          <td className="px-4 py-3 text-sm">{dash(doc.documentNumber)}</td>
                          <td className="px-4 py-3 text-sm">{dash(doc.placeOfIssue)}</td>
                          <td className="px-4 py-3 text-sm">{doc.dateOfIssue ? formatDisplayDate(doc.dateOfIssue) : "—"}</td>
                          <td className="px-4 py-3 text-sm">
                            {doc.expiryDate
                              ? formatDisplayDate(doc.expiryDate)
                              : doc.validTill
                                ? formatDisplayDate(doc.validTill)
                                : "—"}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <Badge variant="secondary" className="text-xs">
                              {titleise(doc.status)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="readiness" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Joining Readiness</CardTitle>
              <CardDescription>
                The date you expect to be available to deploy. Optional — leave
                it blank if you would rather not state one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-end gap-3 max-w-xl">
                <div className="space-y-2 flex-1">
                  <Label htmlFor="joiningReadinessDate">Readiness Date</Label>
                  <Input
                    id="joiningReadinessDate"
                    type="date"
                    value={readinessDate}
                    onChange={(e) => setReadinessDate(e.target.value)}
                    data-testid="input-joining-readiness"
                  />
                </div>
                <Button
                  onClick={() => readinessMutation.mutate(readinessDate)}
                  disabled={readinessMutation.isPending}
                  data-testid="button-save-joining-readiness"
                >
                  {readinessMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Change History</CardTitle>
              <CardDescription>
                Every change to this date is recorded, including ones made on
                your behalf.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(data?.readinessHistory ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No changes recorded yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {(data?.readinessHistory ?? []).map((entry) => (
                    <div
                      key={entry.id}
                      className="text-sm border-l-2 border-gray-200 dark:border-gray-700 pl-3"
                    >
                      <p>
                        <span className="text-muted-foreground">
                          {entry.oldDate
                            ? formatDisplayDate(entry.oldDate)
                            : "not set"}
                        </span>
                        {" → "}
                        <span className="font-medium">
                          {entry.newDate
                            ? formatDisplayDate(entry.newDate)
                            : "cleared"}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {dash(entry.changedByName)} ·{" "}
                        {formatDisplayDate(entry.changedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="password" className="mt-4">
          {passwordCard}
        </TabsContent>
      </Tabs>
    </div>
  );
}
