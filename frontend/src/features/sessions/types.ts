export type SessionSummary = {
  session_id: string;
  agent_id: number;
  status: string;
  created_at: string;
  last_updated: string;
};

export type SessionListResponse = {
  sessions: SessionSummary[];
  total: number;
  count: number;
  limit: number;
  offset: number;
};

export type SessionDetail = {
  session_id: string;
  agent_id: number;
  status: string;
  created_at: string;
  last_updated: string;
  latest_classification?: {
    risk_level?: string | null;
    confidence?: number | null;
    timestamp?: string | null;
  } | null;
  approval?: {
    id: number;
    status: string;
    tool_name?: string | null;
    requested_at?: string | null;
    decided_at?: string | null;
    decided_by?: string | null;
  } | null;
};

export type SessionEvent = {
  timestamp: string;
  event_type: string;
  metadata: Record<string, unknown>;
};

export type SessionTimelineResponse = {
  session_id: string;
  agent_id: number;
  status: string;
  events: SessionEvent[];
  event_count: number;
};

export type RunAgentRequest = {
  agentId: number;
  userInput: string;
};

export type RunAgentResponse = {
  session_id: string;
  status: string;
  final_output?: string | null;
  error?: string | null;
};
