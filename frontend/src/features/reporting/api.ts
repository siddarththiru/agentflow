import { http } from "../../api/http";

export type LogRecord = {
  id: number;
  session_id: string;
  agent_id: number;
  event_type: string;
  event_data: Record<string, unknown>;
  timestamp: string;
};

export type LogsQueryResponse = {
  logs: LogRecord[];
  total: number;
  count: number;
  limit: number;
  offset: number;
};

export const getLogs = async (query: {
  sessionId?: string;
  agentId?: string;
  eventType?: string;
  fromTime?: string;
  toTime?: string;
  limit?: number;
  offset?: number;
}): Promise<LogsQueryResponse> => {
  const response = await http.get<LogsQueryResponse>("/logs", {
    params: {
      session_id: query.sessionId || undefined,
      agent_id: query.agentId ? Number(query.agentId) : undefined,
      event_type: query.eventType || undefined,
      from_time: query.fromTime || undefined,
      to_time: query.toTime || undefined,
      limit: query.limit ?? 100,
      offset: query.offset ?? 0,
    },
  });
  return response.data;
};

export const getSessionLogs = async (sessionId: string): Promise<{ session_id: string; logs: LogRecord[]; count: number }> => {
  const response = await http.get<{ session_id: string; logs: LogRecord[]; count: number }>(
    `/logs/sessions/${sessionId}`
  );
  return response.data;
};

export const getAgentLogs = async (agentId: string): Promise<{ agent_id: number; logs: LogRecord[]; total: number; count: number }> => {
  const response = await http.get<{ agent_id: number; logs: LogRecord[]; total: number; count: number }>(
    `/logs/agents/${agentId}`,
    {
      params: { limit: 200, offset: 0 },
    }
  );
  return response.data;
};

export const getLogEventTypes = async (): Promise<string[]> => {
  const response = await http.get<{ event_types: string[] }>("/logs/event-types");
  return response.data.event_types;
};

export const getLogStats = async (sessionId?: string): Promise<{
  total_sessions: number;
  total_logs: number;
  event_type_counts: Record<string, number>;
}> => {
  const response = await http.get<{
    total_sessions: number;
    total_logs: number;
    event_type_counts: Record<string, number>;
  }>("/logs/stats", {
    params: { session_id: sessionId || undefined },
  });
  return response.data;
};
