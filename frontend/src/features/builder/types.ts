export type BuilderStepKey = "metadata" | "tools" | "policy" | "review";

export type BuilderStep = {
  key: BuilderStepKey;
  title: string;
  description: string;
};

export type AgentMetadataDraft = {
  name: string;
  description: string;
  purpose: string;
  model: string;
};

export type PolicyDraft = {
  frequencyLimit: string;
  requireApprovalForAllToolCalls: boolean;
};

export type BuilderDraft = {
  metadata: AgentMetadataDraft;
  selectedToolIds: number[];
  policy: PolicyDraft;
};

export type BuilderValidationErrors = Partial<Record<keyof AgentMetadataDraft | "tools" | "frequencyLimit", string>>;

export type ToolOption = {
  id: number;
  name: string;
  description: string;
  usable: boolean;
};

export type CreatedAgentResult = {
  agentId: number;
  agentName: string;
};
