import { BuilderStep } from "./types";

export const builderSteps: BuilderStep[] = [
  {
    key: "metadata",
    title: "Metadata",
    description: "Define identity and model behavior.",
  },
  {
    key: "tools",
    title: "Tools",
    description: "Choose allowed integrations.",
  },
  {
    key: "policy",
    title: "Policy",
    description: "Apply safety and frequency controls.",
  },
  {
    key: "review",
    title: "Review & Export",
    description: "Validate and publish final definition.",
  },
];

export const modelOptions = [
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];
