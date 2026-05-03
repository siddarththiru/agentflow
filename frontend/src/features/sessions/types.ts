export type SessionSummary = {
  session_id: string;
  agent_id: number;
  status: string;
  created_at: string;
  last_updated: string;
  title?: string | null;
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
  title?: string | null;
  status: string;
  created_at: string;
  last_updated: string;
  messages: SessionMessage[];
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

export type SessionMessage = {
  id: number;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  metadata: string | null;
  created_at: string;
};

export type SessionEvent = {
  timestamp: string;
  event_type: string;
  metadata: Record<string, unknown>;
};

export type SessionTimelineResponse = {
  session_id: string;
  agent_id?: number;
  status?: string;
  events: SessionEvent[];
  event_count: number;
};

export type RunAgentResponse = {
  session_id: string;
  status: string;
  final_output?: string | null;
  error?: string | null;
};
