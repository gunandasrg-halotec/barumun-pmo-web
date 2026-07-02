import React, { createContext, useContext, useEffect, useState } from "react";
import { authService } from "../services/authService";
import { ROLES } from "../types";
import type { User } from "../types";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // Role helpers
  hasRole: (role: string) => boolean;
  isAdminSistem: () => boolean;
  isProjectManager: () => boolean;
  isDireksi: () => boolean;
  isFinance: () => boolean;
  isAdminProyek: () => boolean;
  canInputProgress: () => boolean;
  canInputCost: () => boolean;
  canApproveProgress: () => boolean;
  canApproveCost: () => boolean;
  canApproveWbd: () => boolean;
  canManageWbd: () => boolean;
  canManageFiles: () => boolean;
  canGenerateReport: () => boolean;
  canManageMasterData: () => boolean;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("auth_user");
    return stored ? JSON.parse(stored) : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      setIsLoading(false);
      return;
    }
    refreshMe().finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authService.login(email, password);
    localStorage.setItem("auth_token", res.token);
    localStorage.setItem("auth_user", JSON.stringify(res.user));
    setUser(res.user);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const refreshMe = async () => {
    return authService
      .me()
      .then((res) => {
        setUser(res);
        localStorage.setItem("auth_user", JSON.stringify(res));
      })
      .catch(() => {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        setUser(null);
      });
  };

  const hasRole = (role: string) => user?.role?.name === role;
  const isAdminSistem = () => hasRole(ROLES.ADMINISTRATOR_SISTEM);
  const isProjectManager = () => hasRole(ROLES.PROJECT_MANAGER);
  const isDireksi = () => hasRole(ROLES.DIREKSI);
  const isFinance = () => hasRole(ROLES.FINANCE);
  const isAdminProyek = () => hasRole(ROLES.ADMIN_PROYEK);

  const canInputProgress = () => isProjectManager() || isAdminProyek();
  const canInputCost = () => isFinance() || isAdminProyek();
  const canApproveProgress = () => isProjectManager();
  const canApproveCost = () => isFinance();
  const canApproveWbd = () => isDireksi();
  const canManageWbd = () => isProjectManager() || isAdminProyek();
  const canManageFiles = () => isProjectManager() || isAdminProyek();
  const canGenerateReport = () => isProjectManager() || isAdminProyek();
  const canManageMasterData = () => isAdminSistem();

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        hasRole,
        isAdminSistem,
        isProjectManager,
        isDireksi,
        isFinance,
        isAdminProyek,
        canInputProgress,
        canInputCost,
        canApproveProgress,
        canApproveCost,
        canApproveWbd,
        canManageWbd,
        canManageFiles,
        canGenerateReport,
        canManageMasterData,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
