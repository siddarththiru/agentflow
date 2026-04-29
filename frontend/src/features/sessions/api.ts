import { http, parseApiError } from "../../api/http";
import {
  RunAgentResponse,
  SessionDetail,
  SessionListResponse,
  SessionTimelineResponse,
} from "./types";

type ListSessionParams = {
  agentId?: string;
  status?: string;
  limit?: number;
  offset?: number;
};

const normalizeOptionalNumber = (value?: string): number | undefined => {
  if (!value || value.trim().length === 0) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
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
  // Note: Legacy session detail endpoint removed.
  // Session details should be fetched from /agents/{agentId}/sessions/{sessionId} or via logs.
  throw new Error("Session detail endpoint removed. Use agent-specific session endpoints.");
};

export const getSessionTimeline = async (sessionId: string): Promise<SessionTimelineResponse> => {
  // Note: Legacy session timeline endpoint removed.
  // Timeline events should be fetched from /logs endpoint with session_id filter.
  throw new Error("Session timeline endpoint removed. Use logs endpoint with session filter.");
};

export const resumeAgent = async (sessionId: string): Promise<RunAgentResponse> => {
  try {
    const response = await http.post<RunAgentResponse>(`/agents/resume-agent/${sessionId}`);
    return response.data;
  } catch (error) {
    throw new Error(parseApiError(error, "Unable to resume session."));
  }
};
