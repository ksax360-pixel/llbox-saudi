"use client";

import { ArrowLeft, Loader2, MessageSquare, Phone, Mail, MessageCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { SearchBar } from "@/components/shared/search-bar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api } from "@/services/api";
import { formatDateTime, cn } from "@/lib/utils";
import type { Conversation, ConversationChannel, ConversationMessage } from "@/types";

const channelIcons: Record<ConversationChannel, React.ElementType> = {
  voice: Phone,
  whatsapp: MessageCircle,
  sms: MessageSquare,
  email: Mail,
};

const FILTERS = ["all", "voice", "text"] as const;
type InboxFilter = (typeof FILTERS)[number];

function normalizeFilter(value: string | null): InboxFilter {
  if (value === "voice" || value === "text" || value === "all") return value;
  if (value === "whatsapp" || value === "sms" || value === "email") return "text";
  return "all";
}

export default function ConversationsPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<InboxFilter>(() =>
    normalizeFilter(searchParams.get("filter"))
  );
  const [draft, setDraft] = useState("");

  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const items = await api.conversations.list();
      setConversations(items);
      setSelectedId((current) => {
        if (current && items.some((c) => c.id === current)) return current;
        return items[0]?.id ?? null;
      });
    } catch {
      if (!silent) {
        toast("Could not load conversations", {
          description: "Check your connection and try again.",
          variant: "error",
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadConversations();
    const timer = setInterval(() => loadConversations(true), 20000);
    return () => clearInterval(timer);
  }, [loadConversations]);

  useEffect(() => {
    setFilter(normalizeFilter(searchParams.get("filter")));
  }, [searchParams]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  const filtered = conversations.filter((c) => {
    const matchSearch =
      c.customerName.toLowerCase().includes(search.toLowerCase()) ||
      c.subject.toLowerCase().includes(search.toLowerCase()) ||
      c.customerMobile.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ||
      (filter === "voice" && c.channel === "voice") ||
      (filter === "text" && c.channel !== "voice");
    return matchSearch && matchFilter;
  });

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
    toast("Message sent", {
      description: "Agent reply noted in this conversation view.",
      variant: "info",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conversations"
        description="Live inbox for WhatsApp text and voice calls"
        actions={
          <Button variant="outline" size="sm" onClick={() => loadConversations()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Refresh
          </Button>
        }
      />

      <div className="flex h-[calc(100vh-220px)] min-h-[500px] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        <div
          className={cn(
            "w-full max-w-sm flex-col border-r border-[#E5E7EB]",
            selected ? "hidden md:flex" : "flex"
          )}
        >
          <div className="space-y-3 border-b border-[#E5E7EB] p-4">
            <SearchBar value={search} onChange={setSearch} placeholder="Search conversations..." />
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-medium capitalize transition-colors",
                    filter === f ? "bg-[#111827] text-white" : "bg-[#F8F9FA] text-[#6B7280] hover:bg-[#F3F4F6]"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && !conversations.length ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-[#9CA3AF]">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading live conversations…
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#9CA3AF]">
                No live conversations yet. WhatsApp chats and voice calls will appear here automatically.
              </div>
            ) : (
              filtered.map((conv) => {
                const Icon = channelIcons[conv.channel];
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => setSelectedId(conv.id)}
                    className={cn(
                      "flex w-full items-start gap-3 border-b border-[#E5E7EB] p-4 text-left transition-colors hover:bg-[#F8F9FA]",
                      selected?.id === conv.id && "bg-[#F8F9FA]"
                    )}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F3F4F6]">
                      <Icon className="h-4 w-4 text-[#6B7280]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-[#111827]">{conv.customerName}</p>
                        <StatusBadge status={conv.status} />
                      </div>
                      <p className="truncate text-xs text-[#6B7280]">{conv.subject}</p>
                      <p className="mt-0.5 truncate text-xs text-[#9CA3AF]">{conv.lastMessage}</p>
                    </div>
                  </button>
                );
              })
            )}
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
                    <p className="truncate text-xs text-[#6B7280]">
                      {selected.customerMobile} · {selected.channel}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      toast("Take Over", {
                        description: "This option will be available tomorrow.",
                        variant: "info",
                      })
                    }
                  >
                    Take Over
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      toast("Escalate", {
                        description: "This option will be available tomorrow.",
                        variant: "info",
                      })
                    }
                  >
                    Escalate
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      toast("Close", {
                        description: "This option will be available tomorrow.",
                        variant: "info",
                      })
                    }
                  >
                    Close
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {selected.messages.length === 0 ? (
                  <p className="text-sm text-[#9CA3AF]">No messages in this conversation yet.</p>
                ) : (
                  selected.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "max-w-[70%] rounded-xl px-4 py-2.5 text-sm",
                        msg.sender === "customer"
                          ? "bg-[#F8F9FA] text-[#111827]"
                          : msg.sender === "ai"
                          ? "ml-auto bg-blue-50 text-blue-900"
                          : "ml-auto bg-[#111827] text-white"
                      )}
                    >
                      <p>{msg.content}</p>
                      <p className="mt-1 text-[10px] opacity-60">{formatDateTime(msg.timestamp)}</p>
                    </div>
                  ))
                )}
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
                    placeholder="Type a message..."
                    className="flex-1 rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827]"
                  />
                  <Button onClick={handleSend} disabled={!draft.trim()}>
                    Send
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-[#9CA3AF]">
              {loading ? "Loading…" : "Select a conversation"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
