import type { Organization, User, UserRole } from "@/types";
import { ROLE_PERMISSIONS } from "./rbac";

export const MOCK_ORGANIZATIONS: Organization[] = [
  { id: "org-1", name: "LLBox Riyadh", slug: "llbox-riyadh", city: "Riyadh", country: "Saudi Arabia" },
  { id: "org-2", name: "LLBox Jeddah", slug: "llbox-jeddah", city: "Jeddah", country: "Saudi Arabia" },
  { id: "org-3", name: "LLBox Dammam", slug: "llbox-dammam", city: "Dammam", country: "Saudi Arabia" },
];

export const DEMO_USERS: Record<UserRole, { email: string; password: string; name: string }> = {
  super_admin: { email: "admin@llbox.com", password: "admin123", name: "Ahmed Al-Rashid" },
  operations_admin: { email: "ops@llbox.com", password: "ops123", name: "Sara Al-Farsi" },
  customer_support: { email: "support@llbox.com", password: "support123", name: "Omar Hassan" },
  ai_supervisor: { email: "ai@llbox.com", password: "ai123", name: "Layla Al-Mutairi" },
  customer: { email: "customer@llbox.com", password: "customer123", name: "Khalid Al-Otaibi" },
};

export function createMockUser(role: UserRole): User {
  const demo = DEMO_USERS[role];
  return {
    id: `user-${role}`,
    email: demo.email,
    name: demo.name,
    role,
    organizationId: "org-1",
    organizationName: "LLBox Riyadh",
    permissions: ROLE_PERMISSIONS[role],
    twoFactorEnabled: role === "super_admin",
    lastLogin: new Date().toISOString(),
    status: "active",
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface AuthSession {
  user: User;
  tokens: AuthTokens;
  organization: Organization;
}

export interface Pending2FASession {
  user: User;
  organization: Organization;
  otpSessionId: string;
  maskedPhone?: string | null;
  otpSent?: boolean;
}

const SESSION_KEY = "llbox_session";
const PENDING_KEY = "llbox_pending_2fa";

export function savePending2FA(session: Pending2FASession): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(session));
  }
}

export function getPending2FA(): Pending2FASession | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Pending2FASession;
  } catch {
    return null;
  }
}

export function clearPending2FA(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(PENDING_KEY);
  }
}

export function saveSession(session: AuthSession): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

export function getSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(SESSION_KEY);
  }
}

export function savePendingSession(session: AuthSession): void {
  savePending2FA({
    user: session.user,
    organization: session.organization,
    otpSessionId: "",
    maskedPhone: null,
    otpSent: false,
  });
}

export function getPendingSession(): Pending2FASession | null {
  return getPending2FA();
}

export function clearPendingSession(): void {
  clearPending2FA();
}

export function generateTokens(): AuthTokens {
  return {
    accessToken: `llbox_at_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    refreshToken: `llbox_rt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    expiresAt: Date.now() + 3600000,
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://apillbox.x-360.ai";

function mapBackendRole(role: string): UserRole {
  if (role === "admin") return "super_admin";
  if (role === "operator") return "operations_admin";
  return "customer_support";
}

function buildUserFromBackend(raw: {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive?: boolean;
  lastLoginAt?: string;
}): User {
  const role = mapBackendRole(raw.role);
  return {
    id: String(raw.id),
    email: raw.email,
    name: raw.name,
    role,
    organizationId: "org-1",
    organizationName: "LLBox Riyadh",
    permissions: ROLE_PERMISSIONS[role],
    twoFactorEnabled: role === "super_admin",
    lastLogin: raw.lastLoginAt || new Date().toISOString(),
    status: raw.isActive === false ? "inactive" : "active",
  };
}

export async function liveLogin(
  email: string,
  password: string
): Promise<{
  success: boolean;
  session?: AuthSession;
  pending2FA?: Pending2FASession;
  error?: string;
  requires2FA?: boolean;
} | null> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = (await res.json()) as {
      success?: boolean;
      message?: string;
      data?: {
        token?: string;
        requires2FA?: boolean;
        otpSessionId?: string;
        maskedPhone?: string | null;
        otpSent?: boolean;
        user?: {
          id: string;
          name: string;
          email: string;
          role: string;
          isActive: boolean;
          lastLoginAt?: string;
        };
      };
    };

    if (!json.success || !json.data?.user) {
      return res.status === 401 ? { success: false, error: json.message || "Invalid email or password" } : null;
    }

    const user = buildUserFromBackend(json.data.user);
    const organization = MOCK_ORGANIZATIONS[0];

    if (json.data.requires2FA) {
      const pending2FA: Pending2FASession = {
        user,
        organization,
        otpSessionId: json.data.otpSessionId || "",
        maskedPhone: json.data.maskedPhone,
        otpSent: json.data.otpSent,
      };
      savePending2FA(pending2FA);
      return { success: true, requires2FA: true, pending2FA };
    }

    if (!json.data.token) {
      return null;
    }

    const session: AuthSession = {
      user,
      tokens: {
        accessToken: json.data.token,
        refreshToken: json.data.token,
        expiresAt: Date.now() + 7 * 24 * 3600000,
      },
      organization,
    };

    saveSession(session);
    return { success: true, session };
  } catch {
    return null;
  }
}

export async function verifyOtpLogin(
  otpSessionId: string,
  code: string
): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otpSessionId, code }),
    });
    const json = (await res.json()) as {
      success?: boolean;
      message?: string;
      data?: {
        token: string;
        user: {
          id: string;
          name: string;
          email: string;
          role: string;
          isActive: boolean;
          lastLoginAt?: string;
        };
      };
    };

    if (!json.success || !json.data?.token || !json.data.user) {
      return { success: false, error: json.message || "Invalid verification code" };
    }

    const session: AuthSession = {
      user: buildUserFromBackend(json.data.user),
      tokens: {
        accessToken: json.data.token,
        refreshToken: json.data.token,
        expiresAt: Date.now() + 7 * 24 * 3600000,
      },
      organization: MOCK_ORGANIZATIONS[0],
    };

    saveSession(session);
    clearPending2FA();
    return { success: true, session };
  } catch {
    return { success: false, error: "Verification failed. Please try again." };
  }
}

export async function resendOtp(otpSessionId: string): Promise<{
  success: boolean;
  maskedPhone?: string | null;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/otp/resend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otpSessionId }),
    });
    const json = (await res.json()) as {
      success?: boolean;
      message?: string;
      data?: { maskedPhone?: string | null; otpSent?: boolean };
    };

    if (!json.success) {
      return { success: false, error: json.message || "Could not resend code" };
    }

    return { success: true, maskedPhone: json.data?.maskedPhone };
  } catch {
    return { success: false, error: "Could not resend code" };
  }
}

export async function loginWithBackendOrMock(
  email: string,
  password: string
): Promise<{
  success: boolean;
  session?: AuthSession;
  pending2FA?: Pending2FASession;
  error?: string;
  requires2FA?: boolean;
}> {
  const live = await liveLogin(email, password);
  if (live) return live;
  return mockLogin(email, password);
}

export async function mockLogin(
  email: string,
  password: string
): Promise<{
  success: boolean;
  session?: AuthSession;
  pending2FA?: Pending2FASession;
  error?: string;
  requires2FA?: boolean;
}> {
  await delay(800);

  const role = (Object.keys(DEMO_USERS) as UserRole[]).find(
    (r) => DEMO_USERS[r].email === email && DEMO_USERS[r].password === password
  );

  if (!role) {
    return { success: false, error: "Invalid email or password" };
  }

  const user = createMockUser(role);
  const organization = MOCK_ORGANIZATIONS[0];

  if (user.twoFactorEnabled) {
    const pending2FA: Pending2FASession = {
      user,
      organization,
      otpSessionId: "mock",
      maskedPhone: "***2371",
      otpSent: false,
    };
    savePending2FA(pending2FA);
    return { success: true, requires2FA: true, pending2FA };
  }

  const session: AuthSession = {
    user,
    tokens: generateTokens(),
    organization,
  };

  saveSession(session);
  return { success: true, session };
}

export async function mockVerify2FA(
  code: string,
  pending: Pending2FASession
): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
  await delay(600);
  if (code === "123456") {
    const session: AuthSession = {
      user: pending.user,
      tokens: generateTokens(),
      organization: pending.organization,
    };
    saveSession(session);
    clearPendingSession();
    return { success: true, session };
  }
  return { success: false, error: "Invalid verification code" };
}

export async function mockForgotPassword(_email: string): Promise<{ success: boolean }> {
  await delay(1000);
  return { success: true };
}

export async function mockResetPassword(_token: string, _password: string): Promise<{ success: boolean }> {
  await delay(800);
  return { success: true };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
