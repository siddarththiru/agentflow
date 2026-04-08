import { http, parseApiError } from "../../api/http";
import { ApprovalDecisionInput, ApprovalDetail, ApprovalListResponse } from "./types";

type ApprovalListQuery = {
  statusFilter?: string;
  agentId?: string;
  sessionId?: string;
  limit?: number;
  offset?: number;
};

export const listApprovals = async (
  query: ApprovalListQuery
): Promise<ApprovalListResponse> => {
  const response = await http.get<ApprovalDetail[]>("/approvals", {
    params: {
      status_filter: query.statusFilter || undefined,
      agent_id: query.agentId ? Number(query.agentId) : undefined,
      session_id: query.sessionId || undefined,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    },
  });
  return {
    approvals: response.data,
    total: response.data.length,
    count: response.data.length,
    limit: query.limit ?? 20,
    offset: query.offset ?? 0,
  };
};

export const getApproval = async (sessionId: string): Promise<ApprovalDetail> => {
  const response = await http.get<ApprovalDetail>(`/approvals/${sessionId}`);
  return response.data;
};

export const approveSession = async (
  sessionId: string,
  decision: ApprovalDecisionInput
): Promise<ApprovalDetail> => {
  try {
    const response = await http.post<ApprovalDetail>(`/approvals/${sessionId}/approve`, {
      decided_by: decision.decidedBy,
      reason: decision.reason || null,
    });
    return response.data;
  } catch (error) {
    throw new Error(parseApiError(error, "Unable to approve session."));
  }
};

export const denySession = async (
  sessionId: string,
  decision: ApprovalDecisionInput
): Promise<ApprovalDetail> => {
  try {
    const response = await http.post<ApprovalDetail>(`/approvals/${sessionId}/deny`, {
      decided_by: decision.decidedBy,
      reason: decision.reason || null,
    });
    return response.data;
  } catch (error) {
    throw new Error(parseApiError(error, "Unable to deny session."));
  }
};
