"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";

export function useDashboardKPIs() {
  return useQuery({ queryKey: ["dashboard", "kpis"], queryFn: () => api.dashboard.getKPIs() });
}

export function useDeliveries() {
  return useQuery({ queryKey: ["deliveries"], queryFn: () => api.deliveries.list() });
}

export function useLockers() {
  return useQuery({ queryKey: ["lockers"], queryFn: () => api.lockers.list() });
}

export function useCustomers() {
  return useQuery({ queryKey: ["customers"], queryFn: () => api.customers.list() });
}

export function useDrivers() {
  return useQuery({ queryKey: ["drivers"], queryFn: () => api.drivers.list() });
}

export function useConversations() {
  return useQuery({ queryKey: ["conversations"], queryFn: () => api.conversations.list() });
}

export function useVoiceCalls() {
  return useQuery({ queryKey: ["voiceCalls"], queryFn: () => api.voiceCalls.list() });
}
