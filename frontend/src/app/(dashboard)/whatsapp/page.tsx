"use client";

import { ArrowLeft, MessageCircle, TrendingUp, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { SearchBar } from "@/components/shared/search-bar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { mockConversations } from "@/lib/mock-data";
import { formatDateTime, formatNumber, formatPercent, cn } from "@/lib/utils";
import type { Conversation, ConversationMessage } from "@/types";

export default function WhatsAppAgentsPage() {
  const { toast } = useToast();
  const initial = useMemo(
    () => mockConversations.filter((c) => c.channel === "whatsapp"),
    []
  );
  const [conversations, setConversations] = useState<Conversation[]>(initial);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null);
  const [draft, setDraft] = useState("");

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  const filtered = conversations.filter(
    (c) =>
      c.customerName.toLowerCase().includes(search.toLowerCase()) ||
      c.subject.toLowerCase().includes(search.toLowerCase())
  );

  const active = conversations.filter((c) => c.status === "active").length;
  const resolved = conversations.filter((c) => c.status === "resolved").length;
  const resolutionRate = conversations.length ? (resolved / conversations.length) * 100 : 0;

  const updateSelected = (updater: (c: Conversation) => Conversation) => {
    if (!selectedId) return;
    setConversations((prev) => prev.map((c) => (c.id === selectedId ? updater(c) : c)));
  };

  const handleSend = () => {
    const content = draft.trim();
    if (!content || !selected) return;
    const message: ConversationMessage = {
      id: `msg-${Date.now()}`,
      sender: "agent",
      content,
      timestamp: new Date().toISOString(),
    };
    updateSelected((c) => ({
      ...c,
      lastMessage: content,
      updatedAt: message.timestamp,
      messages: [...c.messages, message],
    }));
    setDraft("");
    toast("Message sent");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp Agents"
        description="Monitor AI WhatsApp conversations and take over when needed"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard title="Active Conversations" value={formatNumber(active)} icon={MessageCircle} />
        <KpiCard title="Messages Today" value={formatNumber(312)} change={18.4} icon={MessageCircle} />
        <KpiCard title="Resolution Rate" value={formatPercent(resolutionRate)} change={2.3} icon={TrendingUp} />
      </div>

      <div className="flex h-[calc(100vh-280px)] min-h-[480px] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        <div
          className={cn(
            "w-full max-w-sm flex-col border-r border-[#E5E7EB]",
            selected ? "hidden md:flex" : "flex"
          )}
        >
          <div className="border-b border-[#E5E7EB] p-4">
            <SearchBar value={search} onChange={setSearch} placeholder="Search WhatsApp..." />
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.slice(0, 40).map((conv) => (
              <button
                key={conv.id}
                type="button"
                onClick={() => setSelectedId(conv.id)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-[#E5E7EB] p-4 text-left hover:bg-[#F8F9FA]",
                  selected?.id === conv.id && "bg-[#F8F9FA]"
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                  <MessageCircle className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-[#111827]">{conv.customerName}</p>
                    <StatusBadge status={conv.status} />
                  </div>
                  <p className="truncate text-xs text-[#6B7280]">{conv.lastMessage}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className={cn("flex flex-1 flex-col", selected ? "flex" : "hidden md:flex")}>
          {selected ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] px-4 py-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="md:hidden shrink-0"
                    onClick={() => setSelectedId(null)}
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[#111827]">{selected.customerName}</p>
                    <p className="truncate text-xs text-[#6B7280]">{selected.customerMobile} · WhatsApp</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      updateSelected((c) => ({ ...c, assignedAgent: "You", status: "active" }));
                      toast("Conversation taken over", {
                        description: "You are now the assigned agent.",
                      });
                    }}
                  >
                    Take Over
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      toast("Assign agent", {
                        description: "Agent assignment opened in demo mode.",
                        variant: "info",
                      })
                    }
                  >
                    <Users className="h-4 w-4" /> Assign
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      updateSelected((c) => ({ ...c, status: "escalated" }));
                      toast("Conversation escalated", { variant: "info" });
                    }}
                  >
                    Escalate
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      updateSelected((c) => ({ ...c, status: "closed" }));
                      toast("Conversation closed");
                    }}
                  >
                    Close
                  </Button>
                </div>
              </div>

              <div className="grid flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[1fr_280px]">
                <div className="overflow-y-auto space-y-3 p-6">
                  {selected.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "max-w-[75%] rounded-xl px-4 py-2.5 text-sm",
                        msg.sender === "customer"
                          ? "bg-[#F8F9FA] text-[#111827]"
                          : msg.sender === "ai"
                          ? "ml-auto bg-emerald-50 text-emerald-900"
                          : "ml-auto bg-[#111827] text-white"
                      )}
                    >
                      <p className="mb-0.5 text-[10px] uppercase opacity-60">{msg.sender}</p>
                      <p>{msg.content}</p>
                      <p className="mt-1 text-[10px] opacity-60">{formatDateTime(msg.timestamp)}</p>
                    </div>
                  ))}
                </div>

                <aside className="hidden overflow-y-auto border-l border-[#E5E7EB] p-4 xl:block">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">Context</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-[#6B7280]">Customer</p>
                      <p className="font-medium text-[#111827]">{selected.customerName}</p>
                    </div>
                    <div>
                      <p className="text-[#6B7280]">Delivery</p>
                      <p className="font-medium text-[#111827]">{selected.deliveryId ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-[#6B7280]">Agent</p>
                      <p className="font-medium text-[#111827]">{selected.assignedAgent ?? "AI Agent"}</p>
                    </div>
                    <div>
                      <p className="text-[#6B7280]">Tags</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {selected.tags.map((t) => (
                          <span key={t} className="rounded-md bg-[#F8F9FA] px-2 py-0.5 text-xs text-[#6B7280]">{t}</span>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg bg-[#F8F9FA] p-3">
                      <p className="text-xs font-medium text-[#9CA3AF]">AI Actions</p>
                      <ul className="mt-2 space-y-1 text-xs text-[#6B7280]">
                        <li>• OTP resent</li>
                        <li>• Delivery status shared</li>
                        <li>• Locker location sent</li>
                      </ul>
                    </div>
                  </div>
                </aside>
              </div>

              <div className="border-t border-[#E5E7EB] p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSend();
                    }}
                    placeholder="Type a WhatsApp reply..."
                    className="flex-1 rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827]"
                  />
                  <Button onClick={handleSend} disabled={!draft.trim()}>
                    Send
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-[#9CA3AF]">Select a conversation</div>
          )}
        </div>
      </div>
    </div>
  );
}
