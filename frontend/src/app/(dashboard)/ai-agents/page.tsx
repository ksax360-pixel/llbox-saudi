"use client";

import { Bot, Phone, TrendingUp } from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { voiceCallColumns } from "@/features/ai-agents/columns";
import { useVoiceCalls } from "@/hooks/use-api";
import { formatNumber, formatPercent } from "@/lib/utils";

export default function AIAgentsPage() {
  const { data: calls = [] } = useVoiceCalls();
  const callsToday = calls.filter(
    (c) => new Date(c.createdAt).toDateString() === new Date().toDateString()
  ).length;
  const resolved = calls.filter((c) => c.outcome === "resolved").length;
  const escalated = calls.filter((c) => c.outcome === "escalated" || c.outcome === "failed").length;
  const resolutionRate = calls.length ? (resolved / calls.length) * 100 : 0;
  const escalationRate = calls.length ? (escalated / calls.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Voice Agents"
        description="Monitor AI voice agent performance and call logs"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Calls Today" value={formatNumber(callsToday)} change={12.3} icon={Phone} />
        <KpiCard title="Calls This Month" value={formatNumber(calls.length)} change={8.5} icon={Phone} />
        <KpiCard title="Resolution Rate" value={formatPercent(resolutionRate)} change={2.1} icon={TrendingUp} />
        <KpiCard title="Escalation Rate" value={formatPercent(escalationRate)} change={-1.3} icon={Bot} />
      </div>

      <DataTable
        columns={voiceCallColumns}
        data={calls}
        searchPlaceholder="Search call logs..."
        exportFilename="voice-calls"
      />
    </div>
  );
}
