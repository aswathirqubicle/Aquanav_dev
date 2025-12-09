import { User } from "@shared/schema";

export interface AuthUser extends Omit<User, 'password'> {}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    return response.json();
  },

  async logout(): Promise<void> {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Logout failed');
    }
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (response.status === 401) {
        return null;
      }

      if (!response.ok) {
        throw new Error('Failed to get user info');
      }

      const data = await response.json();
      return data.user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  },
};

export const hasPermission = (userRole: string, requiredRoles: string[]): boolean => {
  return requiredRoles.includes(userRole);
};

export const roleDisplayNames: Record<string, string> = {
  admin: 'Administrator',
  project_manager: 'Project Manager',
  finance: 'Finance Manager',
  customer: 'Customer',
  employee: 'Employee',
};
