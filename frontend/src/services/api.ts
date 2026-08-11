import type {
  Conversation,
  Customer,
  Delivery,
  Driver,
  Locker,
  VoiceCall,
} from "@/types";
import {
  getChartData,
  getDashboardKPIs,
  getRecentActivity,
  mockApiKeys,
  mockAuditLogs,
  mockConversations,
  mockCustomers,
  mockDeliveries,
  mockDrivers,
  mockInvoices,
  mockLockers,
  mockNotifications,
  mockSubscriptionPlans,
  mockVoiceCalls,
} from "@/lib/mock-data";

function delay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const api = {
  dashboard: {
    async getKPIs() {
      await delay();
      return getDashboardKPIs();
    },
    async getCharts(days = 14) {
      await delay();
      return {
        deliveries: getChartData(days),
        utilization: getChartData(days),
        successRate: getChartData(days),
        customers: getChartData(days),
        aiResolution: getChartData(days),
        revenue: getChartData(days),
      };
    },
    async getActivity() {
      await delay();
      return getRecentActivity();
    },
  },
  deliveries: {
    async list(): Promise<Delivery[]> {
      await delay();
      return mockDeliveries;
    },
    async get(id: string): Promise<Delivery | undefined> {
      await delay();
      return mockDeliveries.find((d) => d.id === id);
    },
  },
  lockers: {
    async list(): Promise<Locker[]> {
      await delay();
      return mockLockers;
    },
    async get(id: string): Promise<Locker | undefined> {
      await delay();
      return mockLockers.find((l) => l.id === id);
    },
  },
  customers: {
    async list(): Promise<Customer[]> {
      await delay();
      return mockCustomers;
    },
  },
  drivers: {
    async list(): Promise<Driver[]> {
      await delay();
      return mockDrivers;
    },
  },
  conversations: {
    async list(): Promise<Conversation[]> {
      await delay();
      return mockConversations;
    },
  },
  voiceCalls: {
    async list(): Promise<VoiceCall[]> {
      await delay();
      return mockVoiceCalls;
    },
  },
  admin: {
    async auditLogs() {
      await delay();
      return mockAuditLogs;
    },
    async apiKeys() {
      await delay();
      return mockApiKeys;
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
