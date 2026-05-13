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
import { approveSession, denySession, getApproval, listApprovals } from "./api";

describe("approvals api", () => {
  it("lists approvals", async () => {
    (http.get as jest.Mock).mockResolvedValueOnce({ data: [{ id: 1, session_id: "session-1" }] });

    const response = await listApprovals({ statusFilter: "pending", limit: 20, offset: 0 });

    expect(response.total).toBe(1);
  });

  it("gets approval by session", async () => {
    (http.get as jest.Mock).mockResolvedValueOnce({ data: { id: 2, session_id: "session-2" } });

    const response = await getApproval("session-2");

    expect(response.id).toBe(2);
  });

  it("approves and denies sessions", async () => {
    (http.post as jest.Mock)
      .mockResolvedValueOnce({ data: { id: 3, status: "approved" } })
      .mockResolvedValueOnce({ data: { id: 3, status: "denied" } });

    const approved = await approveSession("session-3", {
      decidedBy: "project-supervisor",
      reason: "Approved for National College of Ireland review",
    });
    const denied = await denySession("session-3", {
      decidedBy: "project-supervisor",
      reason: "Denied after policy check",
    });

    expect(approved.status).toBe("approved");
    expect(denied.status).toBe("denied");
  });
});
