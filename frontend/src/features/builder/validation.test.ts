import { validateMetadata, validatePolicy, validateSafety, validateTools } from "./validation";
import { BuilderDraft } from "./types";

const validDraft: BuilderDraft = {
  metadata: {
    name: "NCI Final Year Assistant",
    description: "Supports National College of Ireland operations and project reviews.",
    purpose: "Support approved assistant workflows",
    model: "gemini-2.5-flash",
  },
  selectedToolIds: [1],
  policy: {
    frequencyLimit: "2",
    requireApprovalForAllToolCalls: false,
    intentGuardEnabled: true,
    intentGuardModelMode: "dedicated",
    intentGuardModel: "gemini-2.5-flash",
    intentGuardIncludeConversation: true,
    intentGuardIncludeToolArgs: false,
    intentGuardRiskTolerance: "balanced",
    intentGuardActionLow: "ignore",
    intentGuardActionMedium: "clarify",
    intentGuardActionHigh: "pause_for_approval",
    intentGuardActionCritical: "block",
  },
};

describe("builder validation", () => {
  it("flags invalid metadata and policy values", () => {
    const draft: BuilderDraft = {
      ...validDraft,
      metadata: { name: "", description: "short", purpose: "go", model: "" },
      policy: { ...validDraft.policy, frequencyLimit: "0" },
    };

    expect(validateMetadata(draft)).toMatchObject({
      name: "Name is required.",
      description: "Description must be at least 10 characters.",
      purpose: "Purpose must be at least 5 characters.",
      model: "Model is required.",
    });
    expect(validatePolicy(draft)).toMatchObject({
      frequencyLimit: "Frequency limit must be a positive number.",
    });
  });

  it("accepts valid metadata, tools, policy, and safety config", () => {
    expect(validateMetadata(validDraft)).toEqual({});
    expect(validateTools(validDraft)).toEqual({});
    expect(validatePolicy(validDraft)).toEqual({});
    expect(validateSafety(validDraft)).toEqual({});
  });

  it("rejects invalid safety ordering", () => {
    const draft: BuilderDraft = {
      ...validDraft,
      policy: {
        ...validDraft.policy,
        intentGuardActionLow: "block",
        intentGuardActionCritical: "ignore",
      },
    };

    expect(validateSafety(draft)).toEqual({
      safety: "Higher risk levels cannot be configured more leniently than lower risk levels.",
    });
  });
});
