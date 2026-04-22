import { http, parseApiError } from "../../api/http";
import { ToolRecord } from "../tools/types";
import {
  AgentMutableMetadata,
  AgentMutablePolicy,
  AgentProfile,
  AgentSummary,
} from "./types";

export const listAgents = async (): Promise<AgentSummary[]> => {
  const response = await http.get<AgentSummary[]>("/agents");
  return response.data;
};

export const getAgentProfile = async (agentId: number): Promise<AgentProfile> => {
  const response = await http.get<AgentProfile>(`/agents/${agentId}/profile`);
  return response.data;
};

export const updateAgentMetadata = async (
  agentId: number,
  metadata: AgentMutableMetadata
): Promise<void> => {
  try {
    await http.patch(`/agents/${agentId}`, {
      name: metadata.name,
      description: metadata.description,
      purpose: metadata.purpose,
      model: metadata.model,
    });
  } catch (error) {
    throw new Error(parseApiError(error, "Unable to update agent metadata."));
  }
};

export const updateAgentPolicy = async (
  agentId: number,
  policy: AgentMutablePolicy
): Promise<void> => {
  try {
    await http.post(`/agents/${agentId}/policy`, {
      frequency_limit:
        policy.frequencyLimit.trim().length > 0 ? Number(policy.frequencyLimit) : null,
      require_approval_for_all_tool_calls: policy.requireApprovalForAllToolCalls,
    });
  } catch (error) {
    throw new Error(parseApiError(error, "Unable to update policy."));
  }
};

export const updateAgentTools = async (agentId: number, toolIds: number[]): Promise<void> => {
  try {
    await http.post(`/agents/${agentId}/tools`, {
      tool_ids: toolIds,
    });
  } catch (error) {
    throw new Error(parseApiError(error, "Unable to update tool assignments."));
  }
};

export const listAvailableTools = async (): Promise<ToolRecord[]> => {
  const response = await http.get<ToolRecord[]>("/tools");
  return response.data;
};
