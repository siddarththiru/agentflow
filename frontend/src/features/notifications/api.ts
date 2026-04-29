import { listApprovals } from "../approvals/api";
import { getLogs } from "../reporting/api";
import { NotificationAlert, NotificationCenterData } from "./types";

const toTimestamp = (value?: string): number => {
  if (!value) {
    return 0;
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const createCounts = (alerts: NotificationAlert[]) => ({
  total: alerts.length,
  danger: alerts.filter((alert) => alert.severity === "danger").length,
  warning: alerts.filter((alert) => alert.severity === "warning").length,
  pending: alerts.filter((alert) => alert.severity === "pending").length,
});

export const getNotificationCenterData = async (): Promise<NotificationCenterData> => {
  const [pendingApprovals, runtimeErrors, blockedDecisions] =
    await Promise.all([
      listApprovals({ statusFilter: "pending", limit: 25 }),
      getLogs({ eventType: "runtime_error", limit: 25, offset: 0 }),
      getLogs({ eventType: "enforcement_decision", limit: 50, offset: 0 }),
    ]);

  const alerts: NotificationAlert[] = [];

  pendingApprovals.approvals.forEach((approval) => {
    alerts.push({
      id: `approval-${approval.id}`,
      title: "Approval required",
      description: `${approval.tool_name} is awaiting operator decision.`,
      type: "Approval",
      severity: "pending",
      timestamp: approval.requested_at,
      sessionId: approval.session_id,
      agentId: approval.agent_id,
      route: `/approvals?sessionId=${approval.session_id}`,
      source: "approval",
    });
  });

  runtimeErrors.logs.forEach((log) => {
    alerts.push({
      id: `runtime-error-${log.id}`,
      title: "Runtime error detected",
      description: "A runtime error event was recorded for this session.",
      type: "Runtime error",
      severity: "danger",
      timestamp: log.timestamp,
      sessionId: log.session_id,
      agentId: log.agent_id,
      route: `/sessions?sessionId=${log.session_id}`,
      source: "runtime_error",
    });
  });

  blockedDecisions.logs
    .filter((log) => {
      const decision = String((log.event_data || {}).decision || "").toLowerCase();
      return decision === "block";
    })
    .forEach((log) => {
      alerts.push({
        id: `blocked-${log.id}`,
        title: "Enforcement blocked an action",
        description: "A policy enforcement decision blocked a tool call or transition.",
        type: "Policy block",
        severity: "warning",
        timestamp: log.timestamp,
        sessionId: log.session_id,
        agentId: log.agent_id,
        route: `/approvals?sessionId=${log.session_id}`,
        source: "blocked",
      });
    });

  const sortedAlerts = alerts.sort(
    (a, b) => toTimestamp(b.timestamp) - toTimestamp(a.timestamp)
  );

  return {
    alerts: sortedAlerts,
    counts: createCounts(sortedAlerts),
  };
};
