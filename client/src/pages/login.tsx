import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, isAuthenticated, loading } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  // Only redirect on initial load if already authenticated
  // useEffect(() => {
  //   if (isAuthenticated && !loading) {
  //     // Only redirect if this is the initial authentication check
  //     // This prevents redirects during periodic auth checks
  //     const currentPath = window.location.pathname;
  //     if (currentPath === "/" || currentPath === "/login") {
  //       setLocation("/dashboard");
  //     }
  //   }
  // }, [isAuthenticated, loading, setLocation]);

  useEffect(() => {
    if (isAuthenticated && !loading) {
      const currentPath = window.location.pathname;
      if (currentPath === "/" || currentPath === "/login") {
        setLocation("/dashboard");
      }
    }
  }, [isAuthenticated, loading, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(formData.username, formData.password);
      toast({
        title: "Welcome to Aquasoft ERP",
        description: "You have successfully logged in.",
      });
      setLocation("/dashboard");
    } catch (error) {
      toast({
        title: "Login Failed",
        description: error instanceof Error ? error.message : "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="flex items-center justify-center mx-auto mb-4">
            <img src="/logo.webp" alt="Aquanav Logo" className="h-12 w-auto object-contain" />
          </div>
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mx-auto mb-4">
            <img src="/logo.webp" alt="Aquanav Logo" className="h-12 w-auto object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Aquasoft</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Marine Project Management System</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access the marine operations portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Enter your username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
