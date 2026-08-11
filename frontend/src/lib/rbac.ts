import type { Permission, UserRole } from "@/types";

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin (X360)",
  operations_admin: "Operations Admin",
  customer_support: "Customer Support",
  ai_supervisor: "AI Supervisor",
  customer: "Customer",
};

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: [
    "organizations.manage",
    "companies.manage",
    "users.manage",
    "roles.manage",
    "lockers.manage",
    "deliveries.manage",
    "drivers.manage",
    "customers.manage",
    "customers.view",
    "ai_agents.manage",
    "ai_agents.view",
    "conversations.manage",
    "conversations.view",
    "support.manage",
    "support.view",
    "analytics.view",
    "billing.manage",
    "billing.view",
    "settings.manage",
    "audit.view",
    "api_keys.manage",
  ],
  operations_admin: [
    "deliveries.manage",
    "lockers.manage",
    "drivers.manage",
    "customers.manage",
    "analytics.view",
    "support.manage",
    "support.view",
    "conversations.view",
  ],
  customer_support: [
    "customers.view",
    "deliveries.manage",
    "support.manage",
    "support.view",
    "conversations.view",
    "conversations.manage",
  ],
  ai_supervisor: [
    "ai_agents.view",
    "conversations.view",
    "conversations.manage",
    "analytics.view",
  ],
  customer: ["customers.view"],
};

export function hasPermission(
  userPermissions: Permission[],
  required: Permission
): boolean {
  return userPermissions.includes(required);
}

export function hasAnyPermission(
  userPermissions: Permission[],
  required: Permission[]
): boolean {
  return required.some((p) => userPermissions.includes(p));
}

export function canAccessRoute(
  userPermissions: Permission[],
  routePermissions?: Permission[]
): boolean {
  if (!routePermissions || routePermissions.length === 0) return true;
  return hasAnyPermission(userPermissions, routePermissions);
}
