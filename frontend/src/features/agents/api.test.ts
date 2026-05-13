jest.mock("../../api/http", () => {
  return {
    http: {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    },
    parseApiError: jest.fn((_error: unknown, fallback: string) => fallback),
  };
});

import { http } from "../../api/http";
import { listAgents, updateAgentMetadata, updateAgentPolicy, updateAgentTools } from "./api";

describe("agents api", () => {
  it("lists agents", async () => {
    (http.get as jest.Mock).mockResolvedValueOnce({ data: [{ id: 7, name: "NCI Agent" }] });

    const result = await listAgents();

    expect(result[0].id).toBe(7);
  });

  it("updates metadata", async () => {
    (http.patch as jest.Mock).mockResolvedValueOnce({ data: {} });

    await updateAgentMetadata(7, {
      name: "NCI Runtime Agent",
      description: "Updated metadata for National College of Ireland assistant",
      purpose: "Support final project runtime operations",
      model: "gemini-2.5-flash",
    });

    expect(http.patch).toHaveBeenCalled();
  });

  it("updates policy and tool assignments", async () => {
    (http.post as jest.Mock).mockResolvedValue({ data: {} });

    await updateAgentPolicy(7, {
      frequencyLimit: "2",
      requireApprovalForAllToolCalls: true,
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
    });

    await updateAgentTools(7, [1, 2]);

    expect((http.post as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
