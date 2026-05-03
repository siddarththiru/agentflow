export type QuickActionItem = {
  id: string;
  label: string;
  description: string;
  route: string;
};

export const quickActions: QuickActionItem[] = [
  {
    id: "qa1",
    label: "Start new builder flow",
    description: "Create a governed agent with tools and policy controls.",
    route: "/builder",
  },
  {
    id: "qa0",
    label: "Review live sessions",
    description: "Inspect paused or in-flight sessions and their trace details.",
    route: "/sessions",
  },
  {
    id: "qa2",
    label: "Review pending approvals",
    description: "Handle urgent review tasks before SLA thresholds.",
    route: "/approvals",
  },
  {
    id: "qa4",
    label: "Check notification channels",
    description: "Validate routing and fallback channel health.",
    route: "/notifications",
  },
];
