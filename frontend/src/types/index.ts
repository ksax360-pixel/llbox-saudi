export type UserRole =
  | "super_admin"
  | "operations_admin"
  | "customer_support"
  | "ai_supervisor"
  | "customer";

export type Permission =
  | "organizations.manage"
  | "companies.manage"
  | "users.manage"
  | "roles.manage"
  | "lockers.manage"
  | "deliveries.manage"
  | "drivers.manage"
  | "customers.manage"
  | "customers.view"
  | "ai_agents.manage"
  | "ai_agents.view"
  | "conversations.manage"
  | "conversations.view"
  | "support.manage"
  | "support.view"
  | "analytics.view"
  | "billing.manage"
  | "billing.view"
  | "settings.manage"
  | "audit.view"
  | "api_keys.manage";

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  organizationId: string;
  organizationName: string;
  permissions: Permission[];
  twoFactorEnabled: boolean;
  lastLogin?: string;
  status: "active" | "inactive" | "suspended";
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  city: string;
  country: string;
  logo?: string;
}

export type DeliveryStatus =
  | "pending"
  | "matched"
  | "completed"
  | "expired"
  | "cancelled";

export type OTPStatus = "pending" | "sent" | "verified" | "expired";

export interface Delivery {
  id: string;
  orderReference: string;
  customerId: string;
  customerName: string;
  driverId?: string;
  driverName?: string;
  vendor: string;
  lockerId?: string;
  lockerCode?: string;
  sessionId?: string;
  otpStatus: OTPStatus;
  status: DeliveryStatus;
  city: string;
  createdAt: string;
  updatedAt: string;
  timeline: DeliveryTimelineEvent[];
}

export interface DeliveryTimelineEvent {
  stage: "registered" | "matched" | "otp_generated" | "locker_opened" | "completed";
  timestamp: string;
  note?: string;
}

export type LockerStatus = "available" | "in_use" | "maintenance" | "deactivated";

export interface Locker {
  id: string;
  boxCode: string;
  location: string;
  city: string;
  latitude: number;
  longitude: number;
  capacity: number;
  occupancy: number;
  status: LockerStatus;
  lastMaintenance?: string;
  organizationId: string;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  email: string;
  nationalId: string;
  assignedLockerId?: string;
  assignedLockerCode?: string;
  totalDeliveries: number;
  lastDeliveryDate?: string;
  status: "active" | "suspended" | "inactive";
  city: string;
}

export interface Driver {
  id: string;
  name: string;
  mobile: string;
  company: string;
  completedDeliveries: number;
  failedDeliveries: number;
  successRate: number;
  status: "active" | "inactive";
  city: string;
}

export type ConversationChannel = "voice" | "whatsapp" | "sms" | "email";

export type ConversationStatus = "active" | "resolved" | "escalated" | "closed";

export interface Conversation {
  id: string;
  channel: ConversationChannel;
  customerId: string;
  customerName: string;
  customerMobile: string;
  subject: string;
  lastMessage: string;
  status: ConversationStatus;
  assignedAgent?: string;
  tags: string[];
  deliveryId?: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
}

export interface ConversationMessage {
  id: string;
  sender: "customer" | "agent" | "ai";
  content: string;
  timestamp: string;
}

export interface VoiceCall {
  id: string;
  driverNumber: string;
  customerNumber: string;
  duration: number;
  outcome: "resolved" | "escalated" | "missed" | "failed";
  recordingUrl?: string;
  transcript?: string;
  createdAt: string;
}

export type TicketPriority = "low" | "medium" | "high" | "critical";

export type TicketCategory =
  | "otp_failure"
  | "locker_offline"
  | "delivery_issue"
  | "driver_issue"
  | "customer_complaint";

export type TicketStatus = "open" | "in_progress" | "pending" | "resolved" | "closed";

export interface SupportTicket {
  id: string;
  customerId: string;
  customerName: string;
  priority: TicketPriority;
  category: TicketCategory;
  assignedAgent?: string;
  status: TicketStatus;
  subject: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  timestamp: string;
  ipAddress: string;
  beforeValue?: string;
  afterValue?: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  prefix: string;
  createdAt: string;
  lastUsed?: string;
  status: "active" | "revoked";
  usageCount: number;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  billingCycle: "monthly" | "yearly";
  features: string[];
  lockerLimit: number;
  deliveryLimit: number;
}

export interface Invoice {
  id: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
  dueDate: string;
  paidDate?: string;
  period: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  createdAt: string;
  link?: string;
}

export interface DashboardKPIs {
  totalDeliveries: number;
  pendingDeliveries: number;
  completedDeliveries: number;
  failedDeliveries: number;
  activeLockers: number;
  activeCustomers: number;
  activeDrivers: number;
  voiceCallsToday: number;
  whatsappMessagesToday: number;
  aiResolutionRate: number;
}

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface ActivityItem {
  id: string;
  type: "delivery" | "locker" | "ai_escalation";
  title: string;
  description: string;
  timestamp: string;
}
