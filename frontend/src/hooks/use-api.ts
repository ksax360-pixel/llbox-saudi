"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";

export function useDashboardKPIs() {
  return useQuery({ queryKey: ["dashboard", "kpis"], queryFn: () => api.dashboard.getKPIs() });
}

export function useDashboardCharts() {
  return useQuery({ queryKey: ["dashboard", "charts"], queryFn: () => api.dashboard.getCharts() });
}

export function useDashboardActivity() {
  return useQuery({ queryKey: ["dashboard", "activity"], queryFn: () => api.dashboard.getActivity() });
}

export function useDeliveries() {
  return useQuery({ queryKey: ["deliveries"], queryFn: () => api.deliveries.list() });
}

export function useDelivery(id: string) {
  return useQuery({
    queryKey: ["deliveries", id],
    queryFn: () => api.deliveries.get(id),
    enabled: Boolean(id),
  });
}

export function useLockers() {
  return useQuery({ queryKey: ["lockers"], queryFn: () => api.lockers.list() });
}

export function useLocker(id: string) {
  return useQuery({
    queryKey: ["lockers", id],
    queryFn: () => api.lockers.get(id),
    enabled: Boolean(id),
  });
}

export function useLockerHistory(id: string) {
  return useQuery({
    queryKey: ["lockers", id, "history"],
    queryFn: () => api.lockers.history(id),
    enabled: Boolean(id),
  });
}

export function useCustomers() {
  return useQuery({ queryKey: ["customers"], queryFn: () => api.customers.list() });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: ["customers", id],
    queryFn: () => api.customers.get(id),
    enabled: Boolean(id),
  });
}

export function useDrivers() {
  return useQuery({ queryKey: ["drivers"], queryFn: () => api.drivers.list() });
}

export function useDriver(id: string) {
  return useQuery({
    queryKey: ["drivers", id],
    queryFn: () => api.drivers.get(id),
    enabled: Boolean(id),
  });
}

export function useConversations() {
  return useQuery({ queryKey: ["conversations"], queryFn: () => api.conversations.list() });
}

export function useVoiceCalls() {
  return useQuery({ queryKey: ["voiceCalls"], queryFn: () => api.voiceCalls.list() });
}

export function useVoiceCall(id: string) {
  return useQuery({
    queryKey: ["voiceCalls", id],
    queryFn: () => api.voiceCalls.get(id),
    enabled: Boolean(id),
  });
}

export function useAnalytics() {
  return useQuery({ queryKey: ["analytics"], queryFn: () => api.analytics.get() });
}

export function useAdminSummary() {
  return useQuery({ queryKey: ["admin", "summary"], queryFn: () => api.admin.summary() });
}

export function useAdminUser(id: string) {
  return useQuery({
    queryKey: ["admin", "users", id],
    queryFn: () => api.admin.getUser(id),
    enabled: Boolean(id),
  });
}
