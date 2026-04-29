import { AppNavItem } from "../types/navigation";

export const navItems: AppNavItem[] = [
  {
    label: "Dashboard",
    path: "/dashboard",
    description: "Overview of platform health",
  },
  {
    label: "Builder",
    path: "/builder",
    description: "Design and define agent behavior",
  },
  {
    label: "Agents",
    path: "/agents",
    description: "Browse and manage governed agents",
  },
  {
    label: "Sessions",
    path: "/sessions",
    description: "Track runtime sessions",
  },
  {
    label: "Approvals",
    path: "/approvals",
    description: "Review pending human-in-loop tasks",
  },
  {
    label: "Notifications",
    path: "/notifications",
    description: "Manage alert routing",
  },
  {
    label: "Tools",
    path: "/tools",
    description: "Configure connected toolchains",
  },
];

