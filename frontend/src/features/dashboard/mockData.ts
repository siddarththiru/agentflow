import { StatusType } from "../../types/status";

export type DashboardStat = {
  label: string;
  value: string;
  meta: string;
  status: StatusType;
  statusLabel: string;
  icon: "shield" | "clock" | "branch" | "link";
};

export type AlertItem = {
  id: string;
  title: string;
  detail: string;
  category: string;
  status: StatusType;
};

export type ActivityItem = {
  id: string;
  title: string;
  meta: string;
  timestamp: string;
  status: StatusType;
};

export type QuickActionItem = {
  id: string;
  label: string;
  description: string;
  route: string;
};

export const dashboardStats: DashboardStat[] = [
  {
    label: "Active agents",
    value: "18",
    meta: "+3 since last review",
    status: "success",
    statusLabel: "Healthy",
    icon: "shield",
  },
  {
    label: "Open approvals",
    value: "07",
    meta: "2 need same-day action",
    status: "pending",
    statusLabel: "Pending",
    icon: "clock",
  },
  {
    label: "Escalated investigations",
    value: "04",
    meta: "Within expected weekly range",
    status: "warning",
    statusLabel: "Watch",
    icon: "branch",
  },
  {
    label: "Failed tool checks",
    value: "01",
    meta: "Mailer connector retried",
    status: "danger",
    statusLabel: "Needs review",
    icon: "link",
  },
];

export const recentAlerts: AlertItem[] = [
  {
    id: "a1",
    title: "Policy edge case flagged",
    detail: "Approval confidence dropped below threshold for the finance workflow.",
    category: "approval",
    status: "warning",
  },
  {
    id: "a2",
    title: "Risk classification updated",
    detail: "New model weights deployed for high-priority session scoring.",
    category: "investigation",
    status: "info",
  },
  {
    id: "a3",
    title: "Notification retry succeeded",
    detail: "Email channel reconnected and backlog delivered.",
    category: "notification",
    status: "success",
  },
];

export const recentActivity: ActivityItem[] = [
  {
    id: "ac1",
    title: "Incident triage assistant",
    meta: "Ops Team updated prompt + fallback policy",
    timestamp: "6 min ago",
    status: "pending",
  },
  {
    id: "ac2",
    title: "Vendor screening pipeline",
    meta: "Compliance approved v2 tool configuration",
    timestamp: "22 min ago",
    status: "success",
  },
  {
    id: "ac3",
    title: "MCP connector audit",
    meta: "Security opened evidence review for adapter logs",
    timestamp: "1 hr ago",
    status: "warning",
  },
];

export const quickActions: QuickActionItem[] = [
  {
    id: "qa1",
    label: "Start new builder flow",
    description: "Create a governed agent with tools and policy controls.",
    route: "/builder",
  },
  {
    id: "qa2",
    label: "Review pending approvals",
    description: "Handle urgent review tasks before SLA thresholds.",
    route: "/approvals",
  },
  {
    id: "qa3",
    label: "Open investigation queue",
    description: "Inspect incidents and route ownership quickly.",
    route: "/investigation",
  },
  {
    id: "qa4",
    label: "Check notification channels",
    description: "Validate routing and fallback channel health.",
    route: "/notifications",
  },
];
