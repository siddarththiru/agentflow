jest.mock("@chakra-ui/react", () => {
  const React = require("react");

  const createComponent = (tag: string) =>
    React.forwardRef(({ children, ...props }: any, ref: any) => React.createElement(tag, { ref, ...props }, children));

  const mockModule: Record<string, unknown> = {
    __esModule: true,
    ChakraProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    extendTheme: (value: unknown) => value,
    useToast: () => jest.fn(),
  };

  const tagFor = (name: string) => {
    if (name === "Input") return "input";
    if (name === "Textarea") return "textarea";
    if (name === "Button" || name.endsWith("Button")) return "button";
    if (name === "Icon") return "span";
    if (name === "Progress") return "progress";
    return "div";
  };

  return new Proxy(mockModule, {
    get(target, property) {
      if (typeof property === "string" && property in target) {
        return target[property];
      }
      if (typeof property === "string") {
        return createComponent(tagFor(property));
      }
      return undefined;
    },
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ChakraProvider } from "@chakra-ui/react";

import { theme } from "../../app/theme";
import { ApprovalDetailModal } from "./ApprovalDetailModal";
import { approveSession, denySession, getApproval } from "./api";
import { resumeAgent } from "../sessions/api";

jest.mock("./api", () => ({
  getApproval: jest.fn(),
  approveSession: jest.fn(),
  denySession: jest.fn(),
}));

jest.mock("../sessions/api", () => ({
  resumeAgent: jest.fn(),
}));

var mockNavigate = jest.fn();

jest.mock("react-router-dom", () => {
  const React = require("react");

  return {
    __esModule: true,
    MemoryRouter: ({ children }: { children: any }) => React.createElement(React.Fragment, null, children),
    useNavigate: () => mockNavigate,
  };
}, { virtual: true });

describe("ApprovalDetailModal", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    (getApproval as jest.Mock).mockResolvedValue({
      id: 9,
      session_id: "session-nci-approve",
      agent_id: 42,
      tool_id: 1,
      tool_name: "Weather API",
      status: "pending",
      requested_at: "2026-05-07T10:00:00Z",
      decided_at: null,
      decided_by: null,
      decision_reason: null,
      approval_type: "Policy Approval",
      risk_level: "medium",
    });
    (approveSession as jest.Mock).mockResolvedValue({ status: "approved" });
    (denySession as jest.Mock).mockResolvedValue({ status: "denied" });
    (resumeAgent as jest.Mock).mockResolvedValue({ status: "completed" });
  });

  it("approves and resumes a paused session", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const onApprovalUpdated = jest.fn();

    render(
      <ChakraProvider theme={theme}>
        <MemoryRouter>
          <ApprovalDetailModal
            approvalId="session-nci-approve"
            isOpen={true}
            onClose={onClose}
            onApprovalUpdated={onApprovalUpdated}
          />
        </MemoryRouter>
      </ChakraProvider>
    );

    await screen.findByText(/Approval for Weather API/);
    await user.click(screen.getAllByRole("button", { name: "Approve" })[0]);

    await waitFor(() => expect(screen.getByText("Approve session")).toBeInTheDocument());
    await user.click(screen.getAllByRole("button", { name: "Approve" })[1]);

    await waitFor(() => {
      expect(approveSession).toHaveBeenCalledWith("session-nci-approve", expect.any(Object));
      expect(resumeAgent).toHaveBeenCalledWith("session-nci-approve");
      expect(onApprovalUpdated).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("denies a session", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();

    render(
      <ChakraProvider theme={theme}>
        <MemoryRouter>
          <ApprovalDetailModal
            approvalId="session-nci-approve"
            isOpen={true}
            onClose={onClose}
          />
        </MemoryRouter>
      </ChakraProvider>
    );

    await screen.findByText(/Approval for Weather API/);
    await user.click(screen.getAllByRole("button", { name: "Deny" })[0]);
    await user.click(screen.getAllByRole("button", { name: "Deny" })[1]);

    await waitFor(() => expect(denySession).toHaveBeenCalledWith("session-nci-approve", expect.any(Object)));
    expect(onClose).toHaveBeenCalled();
  });
});
