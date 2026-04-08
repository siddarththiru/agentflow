export type ApprovalSummary = {
  id: number;
  session_id: string;
  agent_id: number;
  tool_id?: number;
  tool_name: string;
  status: string;
  requested_at: string;
  decided_at?: string | null;
  decided_by?: string | null;
  decision_reason?: string | null;
  risk_level?: string | null;
};

export type ApprovalListResponse = {
  approvals: ApprovalSummary[];
  total: number;
  count: number;
  limit: number;
  offset: number;
};

export type ApprovalDetail = ApprovalSummary;

export type ApprovalDecisionInput = {
  decidedBy: string;
  reason: string;
};
