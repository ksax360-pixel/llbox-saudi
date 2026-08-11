import type {
  ActivityItem,
  ApiKey,
  AuditLog,
  ChartDataPoint,
  Conversation,
  ConversationMessage,
  Customer,
  DashboardKPIs,
  Delivery,
  DeliveryStatus,
  DeliveryTimelineEvent,
  Driver,
  Invoice,
  Locker,
  LockerStatus,
  Notification,
  SubscriptionPlan,
  SupportTicket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  VoiceCall,
} from "@/types";

const CITIES = ["Riyadh", "Jeddah", "Dammam", "Khobar", "Mecca"];
const VENDORS = ["Amazon SA", "Noon", "Salla", "Zid", "Jahez", "HungerStation", "Carrefour", "Extra"];
const FIRST_NAMES = ["Ahmed", "Mohammed", "Sara", "Fatima", "Omar", "Layla", "Khalid", "Noura", "Abdullah", "Maha"];
const LAST_NAMES = ["Al-Rashid", "Al-Farsi", "Hassan", "Al-Mutairi", "Al-Otaibi", "Al-Ghamdi", "Al-Harbi", "Al-Zahrani"];
const LOCATIONS = [
  "King Fahd Road Tower A",
  "Olaya District Block 3",
  "Al Malaz Community Center",
  "Granada Mall Entrance",
  "Al Nakheel Plaza",
  "Diplomatic Quarter Gate 2",
  "King Abdullah Financial District",
  "Al Yasmin Residential Complex",
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysAgo));
  d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
  return d.toISOString();
}

function generateId(prefix: string, index: number): string {
  return `${prefix}-${String(index).padStart(5, "0")}`;
}

function generateName(): string {
  return `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`;
}

function generateMobile(): string {
  return `+9665${Math.floor(10000000 + Math.random() * 90000000)}`;
}

export const mockLockers: Locker[] = Array.from({ length: 50 }, (_, i) => {
  const capacity = randomItem([12, 24, 36, 48]);
  const occupancy = Math.floor(Math.random() * capacity);
  const statuses: LockerStatus[] = ["available", "in_use", "maintenance", "deactivated"];
  let status: LockerStatus = "available";
  if (occupancy > 0 && occupancy < capacity) status = "in_use";
  else if (occupancy === capacity) status = "in_use";
  if (Math.random() < 0.08) status = "maintenance";
  if (Math.random() < 0.03) status = "deactivated";

  return {
    id: generateId("LKR", i + 1),
    boxCode: `LLB-${String(i + 1).padStart(4, "0")}`,
    location: randomItem(LOCATIONS),
    city: randomItem(CITIES),
    latitude: 24.6 + Math.random() * 0.5,
    longitude: 46.5 + Math.random() * 0.5,
    capacity,
    occupancy: status === "maintenance" || status === "deactivated" ? 0 : occupancy,
    status,
    lastMaintenance: Math.random() > 0.5 ? randomDate(60) : undefined,
    organizationId: "org-1",
  };
});

export const mockCustomers: Customer[] = Array.from({ length: 500 }, (_, i) => {
  const locker = Math.random() > 0.3 ? randomItem(mockLockers) : undefined;
  return {
    id: generateId("CUS", i + 1),
    name: generateName(),
    mobile: generateMobile(),
    email: `customer${i + 1}@email.com`,
    nationalId: `${Math.floor(1000000000 + Math.random() * 9000000000)}`,
    assignedLockerId: locker?.id,
    assignedLockerCode: locker?.boxCode,
    totalDeliveries: Math.floor(Math.random() * 50),
    lastDeliveryDate: Math.random() > 0.2 ? randomDate(30) : undefined,
    status: Math.random() > 0.05 ? "active" : randomItem(["suspended", "inactive"] as const),
    city: randomItem(CITIES),
  };
});

export const mockDrivers: Driver[] = Array.from({ length: 50 }, (_, i) => {
  const completed = Math.floor(Math.random() * 500) + 50;
  const failed = Math.floor(Math.random() * 30);
  return {
    id: generateId("DRV", i + 1),
    name: generateName(),
    mobile: generateMobile(),
    company: randomItem(["Aramex", "SMSA", "Naqel", "Fetchr", "LLBox Fleet", "Barq"]),
    completedDeliveries: completed,
    failedDeliveries: failed,
    successRate: Math.round((completed / (completed + failed)) * 1000) / 10,
    status: Math.random() > 0.1 ? "active" : "inactive",
    city: randomItem(CITIES),
  };
});

const deliveryStatuses: DeliveryStatus[] = ["pending", "matched", "completed", "expired", "cancelled"];

function buildTimeline(status: DeliveryStatus): DeliveryTimelineEvent[] {
  const events: DeliveryTimelineEvent[] = [
    { stage: "registered", timestamp: randomDate(14) },
  ];
  if (["matched", "completed"].includes(status)) {
    events.push({ stage: "matched", timestamp: randomDate(13) });
    events.push({ stage: "otp_generated", timestamp: randomDate(12) });
  }
  if (status === "completed") {
    events.push({ stage: "locker_opened", timestamp: randomDate(11) });
    events.push({ stage: "completed", timestamp: randomDate(10) });
  }
  return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export const mockDeliveries: Delivery[] = Array.from({ length: 100 }, (_, i) => {
  const customer = randomItem(mockCustomers);
  const driver = Math.random() > 0.2 ? randomItem(mockDrivers) : undefined;
  const locker = Math.random() > 0.15 ? randomItem(mockLockers) : undefined;
  const status = randomItem(deliveryStatuses);
  const otpStatuses = ["pending", "sent", "verified", "expired"] as const;

  return {
    id: generateId("DEL", i + 1),
    orderReference: `ORD-${Date.now().toString().slice(-6)}-${i + 1}`,
    customerId: customer.id,
    customerName: customer.name,
    driverId: driver?.id,
    driverName: driver?.name,
    vendor: randomItem(VENDORS),
    lockerId: locker?.id,
    lockerCode: locker?.boxCode,
    sessionId: locker ? `SES-${Math.random().toString(36).slice(2, 10).toUpperCase()}` : undefined,
    otpStatus: randomItem([...otpStatuses]),
    status,
    city: customer.city,
    createdAt: randomDate(30),
    updatedAt: randomDate(7),
    timeline: buildTimeline(status),
  };
});

function generateMessages(count: number): ConversationMessage[] {
  const senders = ["customer", "agent", "ai"] as const;
  const messages = [
    "Hello, I need help with my delivery",
    "Your OTP is 4829. Please use it at the locker.",
    "The locker seems to be offline",
    "Let me check the locker status for you",
    "Your delivery has been completed successfully",
    "I'm escalating this to a human agent",
    "Thank you for your patience",
  ];
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    sender: randomItem([...senders]),
    content: randomItem(messages),
    timestamp: randomDate(5),
  }));
}

export const mockConversations: Conversation[] = Array.from({ length: 500 }, (_, i) => {
  const customer = randomItem(mockCustomers);
  const channels = ["voice", "whatsapp", "sms", "email"] as const;
  const statuses = ["active", "resolved", "escalated", "closed"] as const;
  return {
    id: generateId("CONV", i + 1),
    channel: randomItem([...channels]),
    customerId: customer.id,
    customerName: customer.name,
    customerMobile: customer.mobile,
    subject: randomItem(["Delivery inquiry", "OTP issue", "Locker problem", "Status update", "Complaint"]),
    lastMessage: randomItem(["Thank you", "Please help", "Delivery completed", "Escalated to agent"]),
    status: randomItem([...statuses]),
    assignedAgent: Math.random() > 0.4 ? generateName() : undefined,
    tags: randomItem([["urgent"], ["delivery"], ["otp"], ["resolved"], ["vip"]]),
    deliveryId: Math.random() > 0.5 ? randomItem(mockDeliveries).id : undefined,
    createdAt: randomDate(30),
    updatedAt: randomDate(3),
    messages: generateMessages(Math.floor(Math.random() * 8) + 2),
  };
});

export const mockVoiceCalls: VoiceCall[] = Array.from({ length: 200 }, (_, i) => ({
  id: generateId("CALL", i + 1),
  driverNumber: generateMobile(),
  customerNumber: generateMobile(),
  duration: Math.floor(Math.random() * 600) + 30,
  outcome: randomItem(["resolved", "escalated", "missed", "failed"] as const),
  recordingUrl: Math.random() > 0.3 ? `/recordings/call-${i + 1}.mp3` : undefined,
  transcript: Math.random() > 0.4
    ? "Agent: Hello, how can I help?\nCustomer: I need my OTP.\nAgent: Your OTP is 4829."
    : undefined,
  createdAt: randomDate(14),
}));

const ticketCategories: TicketCategory[] = [
  "otp_failure", "locker_offline", "delivery_issue", "driver_issue", "customer_complaint",
];
const ticketPriorities: TicketPriority[] = ["low", "medium", "high", "critical"];
const ticketStatuses: TicketStatus[] = ["open", "in_progress", "pending", "resolved", "closed"];

export const mockTickets: SupportTicket[] = Array.from({ length: 100 }, (_, i) => {
  const customer = randomItem(mockCustomers);
  return {
    id: generateId("TKT", i + 1),
    customerId: customer.id,
    customerName: customer.name,
    priority: randomItem(ticketPriorities),
    category: randomItem(ticketCategories),
    assignedAgent: Math.random() > 0.3 ? generateName() : undefined,
    status: randomItem(ticketStatuses),
    subject: randomItem([
      "OTP not received",
      "Locker door stuck",
      "Delivery delayed",
      "Driver unreachable",
      "Wrong parcel delivered",
    ]),
    description: "Customer reported an issue requiring immediate attention.",
    createdAt: randomDate(21),
    updatedAt: randomDate(5),
  };
});

export const mockAuditLogs: AuditLog[] = Array.from({ length: 50 }, (_, i) => ({
  id: generateId("AUD", i + 1),
  userId: "user-super_admin",
  userName: "Ahmed Al-Rashid",
  action: randomItem(["CREATE", "UPDATE", "DELETE", "LOGIN", "EXPORT"]),
  resource: randomItem(["delivery", "locker", "user", "api_key", "settings"]),
  timestamp: randomDate(14),
  ipAddress: `185.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
  beforeValue: Math.random() > 0.5 ? '{"status":"pending"}' : undefined,
  afterValue: Math.random() > 0.5 ? '{"status":"completed"}' : undefined,
}));

export const mockApiKeys: ApiKey[] = Array.from({ length: 5 }, (_, i) => ({
  id: generateId("KEY", i + 1),
  name: randomItem(["Production API", "Staging API", "Mobile App", "Webhook Integration", "Analytics Export"]),
  key: `llbox_sk_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`,
  prefix: "llbox_sk",
  createdAt: randomDate(90),
  lastUsed: randomDate(7),
  status: i === 4 ? "revoked" : "active",
  usageCount: Math.floor(Math.random() * 50000),
}));

export const mockNotifications: Notification[] = Array.from({ length: 10 }, (_, i) => ({
  id: generateId("NOT", i + 1),
  title: randomItem(["New delivery registered", "Locker offline alert", "Ticket assigned", "AI escalation", "Payment received"]),
  message: randomItem([
    "Delivery DEL-00042 requires attention",
    "Locker LLB-0012 is offline in Riyadh",
    "Ticket TKT-00015 assigned to you",
    "AI escalated conversation CONV-00234",
  ]),
  type: randomItem(["info", "success", "warning", "error"] as const),
  read: i > 3,
  createdAt: randomDate(3),
  link: "/deliveries",
}));

export const mockSubscriptionPlans: SubscriptionPlan[] = [
  {
    id: "plan-starter",
    name: "Starter",
    price: 4999,
    billingCycle: "monthly",
    features: ["Up to 100 lockers", "5,000 deliveries/month", "Basic analytics", "Email support"],
    lockerLimit: 100,
    deliveryLimit: 5000,
  },
  {
    id: "plan-growth",
    name: "Growth",
    price: 14999,
    billingCycle: "monthly",
    features: ["Up to 1,000 lockers", "50,000 deliveries/month", "AI agents", "Priority support", "Advanced analytics"],
    lockerLimit: 1000,
    deliveryLimit: 50000,
  },
  {
    id: "plan-enterprise",
    name: "Enterprise",
    price: 49999,
    billingCycle: "monthly",
    features: ["Unlimited lockers", "Unlimited deliveries", "Full AI suite", "Dedicated support", "Custom integrations", "SLA guarantee"],
    lockerLimit: 10000,
    deliveryLimit: 1000000,
  },
];

export const mockInvoices: Invoice[] = Array.from({ length: 12 }, (_, i) => ({
  id: generateId("INV", i + 1),
  amount: randomItem([4999, 14999, 49999]),
  status: i === 0 ? "pending" : i === 1 ? "overdue" : "paid",
  dueDate: randomDate(30),
  paidDate: i > 1 ? randomDate(25) : undefined,
  period: `2026-${String(12 - i).padStart(2, "0")}`,
}));

export function getDashboardKPIs(): DashboardKPIs {
  return {
    totalDeliveries: mockDeliveries.length,
    pendingDeliveries: mockDeliveries.filter((d) => d.status === "pending").length,
    completedDeliveries: mockDeliveries.filter((d) => d.status === "completed").length,
    failedDeliveries: mockDeliveries.filter((d) => ["expired", "cancelled"].includes(d.status)).length,
    activeLockers: mockLockers.filter((l) => l.status !== "deactivated").length,
    activeCustomers: mockCustomers.filter((c) => c.status === "active").length,
    activeDrivers: mockDrivers.filter((d) => d.status === "active").length,
    voiceCallsToday: mockVoiceCalls.filter((c) => new Date(c.createdAt).toDateString() === new Date().toDateString()).length || 47,
    whatsappMessagesToday: 312,
    aiResolutionRate: 87.4,
  };
}

export function getChartData(days: number): ChartDataPoint[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return {
      date: d.toISOString().split("T")[0],
      value: Math.floor(Math.random() * 80) + 20,
    };
  });
}

export function getRecentActivity(): ActivityItem[] {
  const items: ActivityItem[] = [
    ...mockDeliveries.slice(0, 3).map((d) => ({
      id: d.id,
      type: "delivery" as const,
      title: `Delivery ${d.id}`,
      description: `${d.status} — ${d.customerName}`,
      timestamp: d.updatedAt,
    })),
    ...mockLockers.slice(0, 2).map((l) => ({
      id: l.id,
      type: "locker" as const,
      title: `Locker ${l.boxCode}`,
      description: `${l.status} at ${l.location}`,
      timestamp: randomDate(1),
    })),
    {
      id: "esc-1",
      type: "ai_escalation" as const,
      title: "AI Escalation",
      description: "Conversation CONV-00234 escalated to human agent",
      timestamp: randomDate(1),
    },
  ];
  return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
