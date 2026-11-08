import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { AuthUser, authService } from "@/lib/auth";
import { logApiError } from "@/lib/error-logger";
import { queryClient } from "@/lib/queryClient";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async (silent = false) => {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        if (!silent) {
          console.error('Auth check failed:', error);
          logApiError(error, "Auth Check", "/api/auth/me");
        }
        // Only clear user on initial load, not on periodic checks
        if (!silent) {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    // Initial auth check
    checkAuth(false);

    // Periodic silent auth check (won't trigger redirects)
    const interval = setInterval(() => checkAuth(true), 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await authService.login({ username, password });
      // The cache never goes stale (staleTime: Infinity) and its keys don't
      // carry the user, so anything left from an earlier login in this tab
      // would be shown to this user as their own.
      queryClient.clear();
      setUser(response.user);
    } catch (error: any) {
      logApiError(error, "Login", "/api/auth/login");
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error("Logout error:", error);
      logApiError(error, "Logout", "/api/auth/logout");
    } finally {
      setUser(null);
      // Same reason as in login: don't leave this user's data for the next one.
      queryClient.clear();
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}