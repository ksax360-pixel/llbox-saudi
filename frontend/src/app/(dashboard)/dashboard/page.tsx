"use client";

import {
  Bot,
  MessageSquare,
  Package,
  Phone,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import { AnalyticsCard } from "@/components/shared/analytics-card";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getChartData, getDashboardKPIs, getRecentActivity } from "@/lib/mock-data";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/utils";
import { useAuth } from "@/store/auth-context";

const activityIcons = {
  delivery: Package,
  locker: Warehouse,
  ai_escalation: Bot,
};

export default function DashboardPage() {
  const { session } = useAuth();
  const kpis = getDashboardKPIs();
  const activity = getRecentActivity();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${session?.user.name}. Here's your operations overview.`}
      />

      <section aria-label="Key performance indicators">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard title="Total Deliveries" value={formatNumber(kpis.totalDeliveries)} change={12.5} changeLabel="vs last month" icon={Package} />
          <KpiCard title="Pending" value={formatNumber(kpis.pendingDeliveries)} change={-3.2} changeLabel="vs yesterday" icon={Package} />
          <KpiCard title="Completed" value={formatNumber(kpis.completedDeliveries)} change={8.1} changeLabel="vs last week" icon={Package} />
          <KpiCard title="Failed" value={formatNumber(kpis.failedDeliveries)} change={-1.4} changeLabel="vs last week" icon={Package} />
          <KpiCard title="Active Lockers" value={formatNumber(kpis.activeLockers)} change={2.0} changeLabel="vs last month" icon={Warehouse} />
          <KpiCard title="Active Customers" value={formatNumber(kpis.activeCustomers)} change={5.7} changeLabel="vs last month" icon={Users} />
          <KpiCard title="Active Drivers" value={formatNumber(kpis.activeDrivers)} icon={Truck} />
          <KpiCard title="Voice Calls Today" value={formatNumber(kpis.voiceCallsToday)} change={15.3} icon={Phone} />
          <KpiCard title="WhatsApp Messages" value={formatNumber(kpis.whatsappMessagesToday)} change={22.1} icon={MessageSquare} />
          <KpiCard title="AI Resolution Rate" value={formatPercent(kpis.aiResolutionRate)} change={1.8} icon={Bot} />
        </div>
      </section>

      <section aria-label="Analytics charts">
        <div className="grid gap-4 lg:grid-cols-2">
          <AnalyticsCard title="Deliveries Per Day" data={getChartData(14)} type="area" />
          <AnalyticsCard title="Locker Utilization" data={getChartData(14)} type="bar" color="#6B7280" />
          <AnalyticsCard title="Delivery Success Rate" data={getChartData(14)} type="line" color="#10B981" valueFormatter={(v) => `${v}%`} />
          <AnalyticsCard title="Customer Growth" data={getChartData(14)} type="area" color="#3B82F6" />
          <AnalyticsCard title="AI Resolution Rate" data={getChartData(14)} type="line" color="#8B5CF6" valueFormatter={(v) => `${v}%`} />
          <AnalyticsCard title="Revenue Growth" data={getChartData(14)} type="bar" color="#10B981" valueFormatter={(v) => `${v}K SAR`} />
        </div>
      </section>

      <section aria-label="Recent activity">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activity.map((item) => {
                const Icon = activityIcons[item.type];
                return (
                  <div key={item.id} className="flex items-start gap-3 border-b border-[#E5E7EB] pb-4 last:border-0 last:pb-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F8F9FA]">
                      <Icon className="h-4 w-4 text-[#6B7280]" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#111827]">{item.title}</p>
                      <p className="text-sm text-[#6B7280]">{item.description}</p>
                    </div>
                    <time className="shrink-0 text-xs text-[#9CA3AF]">{formatDateTime(item.timestamp)}</time>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
