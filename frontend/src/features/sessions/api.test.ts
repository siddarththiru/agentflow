jest.mock("../../api/http", () => {
  return {
    http: {
      get: jest.fn(),
      post: jest.fn(),
    },
    parseApiError: jest.fn((_error: unknown, fallback: string) => fallback),
  };
});

import { http } from "../../api/http";
import { getSessionDetail, getSessionTimeline, listSessions, resumeAgent } from "./api";

describe("sessions api", () => {
  it("lists sessions", async () => {
    (http.get as jest.Mock).mockResolvedValueOnce({
      data: { sessions: [{ session_id: "session-a" }], total: 1, count: 1, limit: 25, offset: 0 },
    });

    const response = await listSessions({ limit: 25, offset: 0 });

    expect(response.total).toBe(1);
  });

  it("gets session detail", async () => {
    (http.get as jest.Mock).mockResolvedValueOnce({
      data: {
        session_id: "session-a",
        agent_id: 12,
        title: "NCI runtime",
        status: "completed",
        created_at: "2026-05-07T10:00:00Z",
        updated_at: "2026-05-07T10:02:00Z",
        messages: [],
      },
    });

    const response = await getSessionDetail("session-a");

    expect(response.session_id).toBe("session-a");
    expect(response.agent_id).toBe(12);
  });

  it("maps timeline response and resumes session", async () => {
    (http.get as jest.Mock).mockResolvedValueOnce({
      data: {
        session_id: "session-a",
        logs: [
          {
            id: 20,
            session_id: "session-a",
            agent_id: 12,
            event_type: "tool_call_attempt",
            event_data: { tool_name: "Weather API" },
            timestamp: "2026-05-07T10:01:00Z",
          },
        ],
        count: 1,
      },
    });
    (http.post as jest.Mock).mockResolvedValueOnce({
      data: { session_id: "session-a", status: "completed", final_output: "Resumed" },
    });

    const timeline = await getSessionTimeline("session-a");
    const resumed = await resumeAgent("session-a");

    expect(timeline.event_count).toBe(1);
    expect(resumed.status).toBe("completed");
  });
});
