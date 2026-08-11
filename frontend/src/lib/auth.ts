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

const SESSION_KEY = "llbox_session";
const PENDING_KEY = "llbox_pending_2fa";

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
  if (typeof window !== "undefined") {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(session));
  }
}

export function getPendingSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function clearPendingSession(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(PENDING_KEY);
  }
}

export function generateTokens(): AuthTokens {
  return {
    accessToken: `llbox_at_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    refreshToken: `llbox_rt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    expiresAt: Date.now() + 3600000,
  };
}

export async function mockLogin(
  email: string,
  password: string
): Promise<{ success: boolean; session?: AuthSession; error?: string; requires2FA?: boolean }> {
  await delay(800);

  const role = (Object.keys(DEMO_USERS) as UserRole[]).find(
    (r) => DEMO_USERS[r].email === email && DEMO_USERS[r].password === password
  );

  if (!role) {
    return { success: false, error: "Invalid email or password" };
  }

  const user = createMockUser(role);
  const session: AuthSession = {
    user,
    tokens: generateTokens(),
    organization: MOCK_ORGANIZATIONS[0],
  };

  if (user.twoFactorEnabled) {
    return { success: true, requires2FA: true, session };
  }

  saveSession(session);
  return { success: true, session };
}

export async function mockVerify2FA(code: string, pendingSession: AuthSession): Promise<{ success: boolean; error?: string }> {
  await delay(600);
  if (code === "123456") {
    saveSession(pendingSession);
    clearPendingSession();
    return { success: true };
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
