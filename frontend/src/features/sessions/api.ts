import { http, parseApiError } from "../../api/http";
import {
  RunAgentResponse,
  SessionDetail as SessionDetailType,
  SessionDetail,
  SessionListResponse,
  SessionMessage,
  SessionEvent,
  SessionTimelineResponse,
} from "./types";

type ListSessionParams = {
  agentId?: string;
  status?: string;
  limit?: number;
  offset?: number;
};

export const listSessions = async (params: ListSessionParams): Promise<SessionListResponse> => {
  const response = await http.get<SessionListResponse>("/sessions", {
    params: {
      agent_id: params.agentId ? Number(params.agentId) : undefined,
      status: params.status || undefined,
      limit: params.limit ?? 25,
      offset: params.offset ?? 0,
    },
  });
  return response.data;
};

export const getSessionDetail = async (sessionId: string): Promise<SessionDetail> => {
  const response = await http.get<{
    session_id: string;
    agent_id: number;
    title?: string | null;
    status: string;
    created_at: string;
    updated_at: string;
    messages: SessionMessage[];
  }>(`/sessions/${sessionId}`);

  return {
    session_id: response.data.session_id,
    agent_id: response.data.agent_id,
    title: response.data.title ?? null,
    status: response.data.status,
    created_at: response.data.created_at,
    last_updated: response.data.updated_at,
    messages: response.data.messages || [],
  } as SessionDetailType;
};

export const getSessionTimeline = async (sessionId: string): Promise<SessionTimelineResponse> => {
  const response = await http.get<{
    session_id: string;
    logs: Array<{
      id: number;
      session_id: string;
      agent_id: number;
      event_type: string;
      event_data: Record<string, unknown>;
      timestamp: string;
    }>;
    count: number;
  }>(`/logs/sessions/${sessionId}`);

  const events: SessionEvent[] = response.data.logs.map((log) => ({
    timestamp: log.timestamp,
    event_type: log.event_type,
    metadata: log.event_data,
  }));

  return {
    session_id: response.data.session_id,
    agent_id: response.data.logs[0]?.agent_id,
    events,
    event_count: response.data.count,
  };
};

export const resumeAgent = async (sessionId: string): Promise<RunAgentResponse> => {
  try {
    const response = await http.post<RunAgentResponse>(`/agents/resume-agent/${sessionId}`);
    return response.data;
  } catch (error) {
    throw new Error(parseApiError(error, "Unable to resume session."));
  }
};
