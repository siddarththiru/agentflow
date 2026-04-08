import { http, parseApiError } from "../../api/http";
import {
  RunAgentRequest,
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
  const response = await http.get<SessionListResponse>("/investigation/sessions", {
    params: {
      agent_id: normalizeOptionalNumber(params.agentId),
      status: params.status || undefined,
      limit: params.limit ?? 10,
      offset: params.offset ?? 0,
    },
  });
  return response.data;
};

export const getSessionDetail = async (sessionId: string): Promise<SessionDetail> => {
  const response = await http.get<SessionDetail>(`/investigation/sessions/${sessionId}`);
  return response.data;
};

export const getSessionTimeline = async (sessionId: string): Promise<SessionTimelineResponse> => {
  const response = await http.get<SessionTimelineResponse>(`/investigation/sessions/${sessionId}/events`);
  return response.data;
};

export const runAgent = async (request: RunAgentRequest): Promise<RunAgentResponse> => {
  try {
    const response = await http.post<RunAgentResponse>("/agents/run-agent", {
      agent_id: request.agentId,
      user_input: request.userInput,
    });
    return response.data;
  } catch (error) {
    throw new Error(parseApiError(error, "Unable to run agent."));
  }
};

export const resumeAgent = async (sessionId: string): Promise<RunAgentResponse> => {
  try {
    const response = await http.post<RunAgentResponse>(`/agents/resume-agent/${sessionId}`);
    return response.data;
  } catch (error) {
    throw new Error(parseApiError(error, "Unable to resume session."));
  }
};
