"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthSession, Pending2FASession } from "@/lib/auth";
import {
  clearPendingSession,
  clearSession,
  getPendingSession,
  getSession,
  loginWithBackendOrMock,
  mockVerify2FA,
  resendOtp,
  savePending2FA,
  saveSession,
  verifyOtpLogin,
} from "@/lib/auth";
import type { Organization } from "@/types";

interface AuthContextType {
  session: AuthSession | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; requires2FA?: boolean }>;
  verify2FA: (code: string) => Promise<{ success: boolean; error?: string }>;
  resend2FAOtp: () => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchOrganization: (org: Organization) => void;
  pendingSession: Pending2FASession | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [pendingSession, setPendingSession] = useState<Pending2FASession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setSession(getSession());
    setPendingSession(getPendingSession());
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginWithBackendOrMock(email, password);
    if (result.success && result.requires2FA && result.pending2FA) {
      savePending2FA(result.pending2FA);
      setPendingSession(result.pending2FA);
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

    if (pending.otpSessionId && pending.otpSessionId !== "mock") {
      const result = await verifyOtpLogin(pending.otpSessionId, code);
      if (result.success && result.session) {
        setSession(result.session);
        setPendingSession(null);
      }
      return result;
    }

    const result = await mockVerify2FA(code, pending);
    if (result.success && result.session) {
      setSession(result.session);
      setPendingSession(null);
    }
    return result;
  }, [pendingSession]);

  const resend2FAOtp = useCallback(async () => {
    const pending = pendingSession ?? getPendingSession();
    if (!pending?.otpSessionId || pending.otpSessionId === "mock") {
      return { success: false, error: "Resend is not available for this session." };
    }

    const result = await resendOtp(pending.otpSessionId);
    if (result.success) {
      const updated = { ...pending, otpSent: true, maskedPhone: result.maskedPhone ?? pending.maskedPhone };
      savePending2FA(updated);
      setPendingSession(updated);
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
    <AuthContext.Provider
      value={{ session, isLoading, login, verify2FA, resend2FAOtp, logout, switchOrganization, pendingSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { MOCK_ORGANIZATIONS } from "@/lib/auth";
