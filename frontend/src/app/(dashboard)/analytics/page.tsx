"use client";

import { Download } from "lucide-react";
import { AnalyticsCard } from "@/components/shared/analytics-card";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { getChartData } from "@/lib/mock-data";
import { exportToCSV } from "@/lib/utils";

export default function AnalyticsPage() {
  const { toast } = useToast();

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
                  getChartData(30) as unknown as Record<string, unknown>[],
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
          <AnalyticsCard title="Deliveries Per Day" data={getChartData(30)} type="area" />
          <AnalyticsCard title="Success Rate" data={getChartData(30)} type="line" color="#10B981" valueFormatter={(v) => `${v}%`} />
          <AnalyticsCard title="Locker Utilization" data={getChartData(30)} type="bar" />
          <AnalyticsCard title="Peak Hours" data={getChartData(24)} type="bar" color="#F59E0B" />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-[#111827]">AI Analytics</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
          {[
            { label: "Voice Resolution", value: "87.4%" },
            { label: "WhatsApp Resolution", value: "91.2%" },
            { label: "Escalation Rate", value: "12.6%" },
            { label: "Cost Per Conversation", value: "2.40 SAR" },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pt-6">
                <p className="text-sm text-[#6B7280]">{stat.label}</p>
                <p className="text-2xl font-semibold text-[#111827]">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <AnalyticsCard title="Voice Resolution Rate" data={getChartData(30)} type="line" color="#8B5CF6" valueFormatter={(v) => `${v}%`} />
          <AnalyticsCard title="WhatsApp Resolution Rate" data={getChartData(30)} type="line" color="#25D366" valueFormatter={(v) => `${v}%`} />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-[#111827]">Business Analytics</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <AnalyticsCard title="Revenue" data={getChartData(12)} type="bar" color="#10B981" valueFormatter={(v) => `${v}K SAR`} />
          <AnalyticsCard title="Deliveries Per Customer" data={getChartData(30)} type="area" color="#3B82F6" />
        </div>
      </section>
    </div>
  );
}
