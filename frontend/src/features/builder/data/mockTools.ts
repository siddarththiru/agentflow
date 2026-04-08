import { ToolOption } from "../types";

export const mockTools: ToolOption[] = [
  {
    id: 101,
    name: "EmailNotifier",
    description: "Send policy updates and approval outcomes through email channels.",
    usable: true,
  },
  {
    id: 102,
    name: "TicketBridge",
    description: "Create and update incident tickets with structured metadata.",
    usable: true,
  },
  {
    id: 103,
    name: "ThreatClassifier",
    description: "Classify runtime events into monitored risk classes.",
    usable: true,
  },
  {
    id: 104,
    name: "LegacyERP",
    description: "Read-only integration to legacy enterprise records.",
    usable: false,
  },
];
