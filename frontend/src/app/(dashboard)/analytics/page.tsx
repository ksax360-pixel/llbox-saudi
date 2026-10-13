"use client";

import { Download } from "lucide-react";
import { AnalyticsCard } from "@/components/shared/analytics-card";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { useAnalytics } from "@/hooks/use-api";
import { exportToCSV } from "@/lib/utils";

export default function AnalyticsPage() {
  const { toast } = useToast();
  const { data } = useAnalytics();
  const charts = data?.charts || {};
  const stats = [
    { label: "Voice Resolution", value: data?.stats?.voiceResolution || "0%" },
    { label: "WhatsApp Resolution", value: data?.stats?.whatsappResolution || "0%" },
    { label: "Escalation Rate", value: data?.stats?.escalationRate || "0%" },
    { label: "Cost Per Conversation", value: data?.stats?.costPerConversation || "0.00 SAR" },
  ];
  const empty: { date: string; value: number }[] = [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        description="Operations, AI, and business intelligence"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                exportToCSV(
                  (charts.deliveries || empty) as unknown as Record<string, unknown>[],
                  "analytics-export"
                );
                toast("CSV exported", { description: "Analytics data downloaded." });
              }}
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                toast("PDF export queued", {
                  description: "Your report will be ready shortly.",
                  variant: "info",
                })
              }
            >
              <Download className="h-4 w-4" /> Export PDF
            </Button>
          </>
        }
      />

      <section>
        <h2 className="mb-4 text-lg font-semibold text-[#111827]">Operations Analytics</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <AnalyticsCard title="Deliveries Per Day" data={charts.deliveries || empty} type="area" />
          <AnalyticsCard title="Success Rate" data={charts.successRate || empty} type="line" color="#10B981" valueFormatter={(v) => `${v}%`} />
          <AnalyticsCard title="Locker Utilization" data={charts.utilization || empty} type="bar" />
          <AnalyticsCard title="Peak Hours" data={charts.peakHours || empty} type="bar" color="#F59E0B" />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-[#111827]">AI Analytics</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pt-6">
                <p className="text-sm text-[#6B7280]">{stat.label}</p>
                <p className="text-2xl font-semibold text-[#111827]">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <AnalyticsCard title="Voice Resolution Rate" data={charts.voiceResolution || empty} type="line" color="#8B5CF6" valueFormatter={(v) => `${v}%`} />
          <AnalyticsCard title="WhatsApp Resolution Rate" data={charts.whatsappResolution || empty} type="line" color="#25D366" valueFormatter={(v) => `${v}%`} />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-[#111827]">Business Analytics</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <AnalyticsCard title="Revenue" data={charts.revenue || empty} type="bar" color="#10B981" valueFormatter={(v) => `${v}K SAR`} />
          <AnalyticsCard title="Deliveries Per Customer" data={charts.deliveriesPerCustomer || empty} type="area" color="#3B82F6" />
        </div>
      </section>
    </div>
  );
}
