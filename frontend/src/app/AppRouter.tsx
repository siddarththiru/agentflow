import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { BuilderPage } from "../features/builder/BuilderPage";
import { AgentsPage } from "../features/agents/AgentsPage";
import { AgentChatPage } from "../features/agent-chat/AgentChatPage";
import { SessionsPage } from "../features/sessions/SessionsPage";
import { ApprovalsPage } from "../features/approvals/ApprovalsPage";
import { NotificationsPage } from "../features/notifications/NotificationsPage";
import { ToolsPage } from "../features/tools/ToolsPage";

export const AppRouter = () => {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="builder" element={<BuilderPage />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="agents/:agentId/chat" element={<AgentChatPage />} />
        <Route path="sessions" element={<SessionsPage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="tools" element={<ToolsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
};
