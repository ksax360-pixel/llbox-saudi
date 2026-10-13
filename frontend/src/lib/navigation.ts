import type { LucideIcon } from "lucide-react";
import type { Permission } from "@/types";
import {
  BarChart3,
  Bot,
  LayoutDashboard,
  MessageSquare,
  Package,
  Shield,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  permissions?: Permission[];
  children?: NavItem[];
}

export const mainNavItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Deliveries", href: "/deliveries", icon: Package, permissions: ["deliveries.manage"] },
  { title: "Lockers", href: "/lockers", icon: Warehouse, permissions: ["lockers.manage"] },
  { title: "Drivers", href: "/drivers", icon: Truck, permissions: ["drivers.manage"] },
  { title: "Customers", href: "/customers", icon: Users, permissions: ["customers.manage", "customers.view"] },
  { title: "AI Agents", href: "/ai-agents", icon: Bot, permissions: ["ai_agents.manage", "ai_agents.view"] },
  { title: "Conversations", href: "/conversations", icon: MessageSquare, permissions: ["conversations.manage", "conversations.view"] },
  { title: "Analytics", href: "/analytics", icon: BarChart3, permissions: ["analytics.view"] },
];

export const adminNavItems: NavItem[] = [
  { title: "Administration", href: "/admin", icon: Shield, permissions: ["users.manage", "audit.view"] },
];

export const allNavItems = [...mainNavItems, ...adminNavItems];
