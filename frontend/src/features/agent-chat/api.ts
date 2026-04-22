import { http, parseApiError } from "../../api/http";
import { ChatMessage, SessionDetail, SessionSummary } from "./types";

export async function listAgentSessions(agentId: number): Promise<SessionSummary[]> {
  const response = await http.get(`/agents/${agentId}/sessions`);
  return response.data;
}

export async function createAgentSession(agentId: number): Promise<SessionSummary> {
  const response = await http.post(`/agents/${agentId}/sessions`);
  return response.data;
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetail> {
  const response = await http.get(`/sessions/${sessionId}`);
  return response.data;
}

export async function getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  const response = await http.get(`/sessions/${sessionId}/messages`);
  return response.data;
}

export async function sendMessage(sessionId: string, content: string, metadata?: string): Promise<ChatMessage> {
  try {
    const response = await http.post(`/sessions/${sessionId}/messages`, {
      content,
      metadata,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.detail || "Failed to send message");
  }
}

export async function updateSessionTitle(sessionId: string, title: string | null): Promise<{ session_id: string; title: string | null }> {
  try {
    const response = await http.patch(`/sessions/${sessionId}`, {
      title,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.detail || "Failed to update session title");
  }
}
