import type {
  ActivityItem,
  ChartDataPoint,
  Conversation,
  ConversationChannel,
  ConversationStatus,
  Customer,
  DashboardKPIs,
  Delivery,
  Driver,
  Locker,
  User,
  UserRole,
  VoiceCall,
  AuditLog,
} from "@/types";
import { apiRequest } from "@/lib/api-client";
import { ROLE_PERMISSIONS } from "@/lib/rbac";
import {
  getChartData,
  getDashboardKPIs,
  getRecentActivity,
  mockApiKeys,
  mockInvoices,
  mockNotifications,
  mockSubscriptionPlans,
} from "@/lib/mock-data";

function delay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapConvStatus(status?: string): ConversationStatus {
  if (status === "completed" || status === "resolved") return "resolved";
  if (status === "failed") return "escalated";
  if (status === "abandoned" || status === "closed") return "closed";
  return "active";
}

function mapChannel(raw?: string, intent?: string): ConversationChannel {
  const value = `${raw || ""} ${intent || ""}`.toLowerCase();
  if (value.includes("whatsapp")) return "whatsapp";
  if (value.includes("sms")) return "sms";
  if (value.includes("email")) return "email";
  return "voice";
}

function mapConversation(item: Record<string, unknown>): Conversation {
  const meta = (item.metadata as Record<string, unknown> | undefined) || {};
  const id = String(item._id || item.id);
  const createdAt = String(item.timestamp || item.createdAt || new Date().toISOString());
  const transcript = String(item.transcript || "");
  const response = String(item.response || "");
  const caller = String(item.callerNumber || meta.phone || "");
  const name = String(meta.customerName || meta.name || caller || "Caller");
  const intent = String(item.intent || meta.lastIntent || "Conversation");

  const messages = [
    transcript
      ? {
          id: `${id}-in`,
          sender: "customer" as const,
          content: transcript,
          timestamp: createdAt,
        }
      : null,
    response
      ? {
          id: `${id}-out`,
          sender: "ai" as const,
          content: response,
          timestamp: String(item.updatedAt || createdAt),
        }
      : null,
  ].filter(Boolean) as Conversation["messages"];

  return {
    id,
    channel: mapChannel(String(meta.channel || ""), intent),
    customerId: caller || id,
    customerName: name,
    customerMobile: caller,
    subject: intent.replace(/_/g, " ") || "Conversation",
    lastMessage: response || transcript || "—",
    status: mapConvStatus(String(item.status || "")),
    tags: intent ? [intent] : [],
    createdAt,
    updatedAt: String(item.updatedAt || createdAt),
    messages,
  };
}

function mapWhatsAppContact(contact: Record<string, unknown>): Conversation {
  const id = String(contact._id || contact.id);
  const phone = String(contact.phone || "");
  const name = String(contact.name || phone || "WhatsApp contact");
  const text = String(contact.lastInboundText || "");
  const intent = String(contact.lastIntent || "WhatsApp");
  const updatedAt = String(contact.updatedAt || contact.createdAt || new Date().toISOString());

  return {
    id: `wa-${id}`,
    channel: "whatsapp",
    customerId: phone || id,
    customerName: name,
    customerMobile: phone,
    subject: intent.replace(/_/g, " ") || "WhatsApp",
    lastMessage: text || "—",
    status: "active",
    tags: ["whatsapp"],
    createdAt: String(contact.createdAt || updatedAt),
    updatedAt,
    messages: text
      ? [
          {
            id: `${id}-msg`,
            sender: "customer",
            content: text,
            timestamp: updatedAt,
          },
        ]
      : [],
  };
}

function mapBackendRole(role: string): UserRole {
  if (role === "admin") return "super_admin";
  if (role === "operator") return "operations_admin";
  return "customer_support";
}

function mapUser(item: Record<string, unknown>): User {
  const role = mapBackendRole(String(item.role || "viewer"));
  return {
    id: String(item.id || item._id),
    email: String(item.email || ""),
    name: String(item.name || ""),
    role,
    organizationId: "org-1",
    organizationName: "LLBox Riyadh",
    permissions: ROLE_PERMISSIONS[role],
    twoFactorEnabled: role === "super_admin",
    lastLogin: item.lastLoginAt ? String(item.lastLoginAt) : undefined,
    status: item.isActive === false ? "inactive" : "active",
  };
}

function mapVoiceCall(item: Record<string, unknown>): Conversation {
  const id = String(item.id || item._id);
  const driver = String(item.driverNumber || "");
  const customer = String(item.customerNumber || "");
  const phone = driver || customer || "Unknown";
  const createdAt = String(item.createdAt || item.startedAt || new Date().toISOString());
  const outcome = String(item.outcome || item.status || "active");
  const duration = Number(item.duration || 0);

  return {
    id: `voice-${id}`,
    channel: "voice",
    customerId: phone,
    customerName: phone,
    customerMobile: phone,
    subject: "Voice call",
    lastMessage: duration ? `Call · ${duration}s · ${outcome}` : `Call · ${outcome}`,
    status: mapConvStatus(outcome === "resolved" ? "completed" : outcome),
    tags: ["voice"],
    createdAt,
    updatedAt: createdAt,
    messages: [
      {
        id: `${id}-voice`,
        sender: "ai",
        content: duration
          ? `Voice call completed (${duration}s). Outcome: ${outcome}.`
          : `Voice call. Outcome: ${outcome}.`,
        timestamp: createdAt,
      },
    ],
  };
}

async function safeLive<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export const api = {
  dashboard: {
    async getKPIs(): Promise<DashboardKPIs> {
      return safeLive(async () => {
        const data = await apiRequest<{ kpis: DashboardKPIs }>("/api/dashboard");
        return data.kpis;
      }, getDashboardKPIs());
    },
    async getCharts(days = 14): Promise<Record<string, ChartDataPoint[]>> {
      return safeLive(async () => {
        const data = await apiRequest<{ charts: Record<string, ChartDataPoint[]> }>("/api/dashboard");
        return data.charts;
      }, {
        deliveries: getChartData(days),
        utilization: getChartData(days),
        successRate: getChartData(days),
        customers: getChartData(days),
        aiResolution: getChartData(days),
        revenue: getChartData(days),
      });
    },
    async getActivity(): Promise<ActivityItem[]> {
      return safeLive(async () => {
        const data = await apiRequest<{ activity: ActivityItem[] }>("/api/dashboard");
        return data.activity || [];
      }, getRecentActivity());
    },
  },
  deliveries: {
    async list(): Promise<Delivery[]> {
      return safeLive(async () => {
        const data = await apiRequest<{ deliveries: Delivery[] }>("/api/deliveries");
        return data.deliveries || [];
      }, []);
    },
    async get(id: string): Promise<Delivery | undefined> {
      return safeLive(async () => {
        const data = await apiRequest<{ delivery: Delivery }>(`/api/deliveries/${id}`);
        return data.delivery;
      }, undefined);
    },
  },
  lockers: {
    async list(): Promise<Locker[]> {
      return safeLive(async () => {
        const data = await apiRequest<{ lockers: Locker[] }>("/api/lockers");
        return data.lockers || [];
      }, []);
    },
    async get(id: string): Promise<Locker | undefined> {
      return safeLive(async () => {
        const data = await apiRequest<{ locker: Locker }>(`/api/lockers/${id}`);
        return data.locker;
      }, undefined);
    },
    async history(id: string): Promise<Delivery[]> {
      return safeLive(async () => {
        const data = await apiRequest<{ deliveries: Delivery[] }>(`/api/lockers/${id}`);
        return data.deliveries || [];
      }, []);
    },
  },
  customers: {
    async list(): Promise<Customer[]> {
      return safeLive(async () => {
        const data = await apiRequest<{ customers: Customer[] }>("/api/customers");
        return data.customers || [];
      }, []);
    },
    async get(id: string) {
      return safeLive(async () => {
        return apiRequest<{
          customer: Customer;
          deliveries: Delivery[];
          conversations: { id: string; channel: string; status: string; subject: string; updatedAt: string }[];
        }>(`/api/customers/${id}`);
      }, undefined);
    },
  },
  drivers: {
    async list(): Promise<Driver[]> {
      return safeLive(async () => {
        const data = await apiRequest<{ drivers: Driver[] }>("/api/drivers");
        return data.drivers || [];
      }, []);
    },
    async get(id: string) {
      return safeLive(async () => {
        return apiRequest<{ driver: Driver; deliveries: Delivery[]; chart: ChartDataPoint[] }>(
          `/api/drivers/${id}`
        );
      }, undefined);
    },
  },
  conversations: {
    async list(): Promise<Conversation[]> {
      return safeLive(async () => {
        const [convData, waData, voiceData] = await Promise.all([
          apiRequest<{ items?: Record<string, unknown>[] }>("/api/conversations?limit=100"),
          apiRequest<{ contacts?: Record<string, unknown>[] }>("/api/whatsapp/contacts").catch(
            () => ({ contacts: [] })
          ),
          apiRequest<{ calls?: Record<string, unknown>[] }>("/api/voice-calls?limit=100").catch(
            () => ({ calls: [] })
          ),
        ]);
        const fromConv = (convData.items || []).map(mapConversation);
        const fromWa = (waData.contacts || []).map(mapWhatsAppContact);
        const fromVoice = (voiceData.calls || []).map(mapVoiceCall);
        const merged = [...fromWa, ...fromConv, ...fromVoice];
        merged.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        return merged;
      }, []);
    },
  },
  voiceCalls: {
    async list(): Promise<VoiceCall[]> {
      return safeLive(async () => {
        const data = await apiRequest<{ calls: VoiceCall[] }>("/api/voice-calls");
        return data.calls || [];
      }, []);
    },
    async get(id: string): Promise<VoiceCall | undefined> {
      return safeLive(async () => {
        const data = await apiRequest<{ call: VoiceCall }>(`/api/voice-calls/${id}`);
        return data.call;
      }, undefined);
    },
  },
  admin: {
    async auditLogs() {
      return safeLive(async () => {
        const data = await apiRequest<{ logs: AuditLog[] }>("/api/admin/audit-logs");
        return data.logs || [];
      }, []);
    },
    async summary() {
      return safeLive(async () => {
        return apiRequest<{
          roleCounts: Record<string, number>;
          logs: AuditLog[];
        }>("/api/admin/summary");
      }, { roleCounts: {}, logs: [] });
    },
    async apiKeys() {
      await delay();
      return mockApiKeys;
    },
    async users(): Promise<User[]> {
      return safeLive(async () => {
        const data = await apiRequest<{ items?: Record<string, unknown>[] }>("/api/users?limit=100");
        const live = (data.items || []).map(mapUser);
        return live.length ? live : [];
      }, []);
    },
    async getUser(id: string): Promise<User | undefined> {
      return safeLive(async () => {
        const data = await apiRequest<{ user: Record<string, unknown> }>(`/api/users/${id}`);
        return data.user ? mapUser(data.user) : undefined;
      }, undefined);
    },
  },
  analytics: {
    async get() {
      return safeLive(async () => {
        return apiRequest<{
          stats: Record<string, string>;
          charts: Record<string, ChartDataPoint[]>;
        }>("/api/analytics");
      }, { stats: {}, charts: {} });
    },
  },
  billing: {
    async plans() {
      await delay();
      return mockSubscriptionPlans;
    },
    async invoices() {
      await delay();
      return mockInvoices;
    },
  },
  notifications: {
    async list() {
      await delay();
      return mockNotifications;
    },
  },
};
