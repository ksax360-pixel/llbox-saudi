"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthSession } from "@/lib/auth";
import {
  clearPendingSession,
  clearSession,
  getPendingSession,
  getSession,
  mockLogin,
  mockVerify2FA,
  MOCK_ORGANIZATIONS,
  savePendingSession,
  saveSession,
} from "@/lib/auth";
import type { Organization } from "@/types";

interface AuthContextType {
  session: AuthSession | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; requires2FA?: boolean }>;
  verify2FA: (code: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchOrganization: (org: Organization) => void;
  pendingSession: AuthSession | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [pendingSession, setPendingSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setSession(getSession());
    setPendingSession(getPendingSession());
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await mockLogin(email, password);
    if (result.success && result.requires2FA && result.session) {
      savePendingSession(result.session);
      setPendingSession(result.session);
      return { success: true, requires2FA: true };
    }
    if (result.success && result.session) {
      clearPendingSession();
      setPendingSession(null);
      setSession(result.session);
    }
    return { success: result.success, error: result.error, requires2FA: result.requires2FA };
  }, []);

  const verify2FA = useCallback(async (code: string) => {
    const pending = pendingSession ?? getPendingSession();
    if (!pending) return { success: false, error: "No pending session. Please sign in again." };

    const result = await mockVerify2FA(code, pending);
    if (result.success) {
      saveSession(pending);
      clearPendingSession();
      setSession(pending);
      setPendingSession(null);
    }
    return result;
  }, [pendingSession]);

  const logout = useCallback(() => {
    clearSession();
    clearPendingSession();
    setSession(null);
    setPendingSession(null);
  }, []);

  const switchOrganization = useCallback((org: Organization) => {
    setSession((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, organization: org };
      saveSession(updated);
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ session, isLoading, login, verify2FA, logout, switchOrganization, pendingSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { MOCK_ORGANIZATIONS };
