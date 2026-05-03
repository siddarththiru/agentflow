import {
  Grid,
  GridItem,
  HStack,
  SimpleGrid,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyPanel } from "../../components/operations/EmptyPanel";
import { ErrorPanel } from "../../components/operations/ErrorPanel";
import { AlertList } from "../../components/ui/AlertList";
import { ActivityList } from "../../components/ui/ActivityList";
import { LoadingPanel } from "../../components/operations/LoadingPanel";
import { ExportMenu } from "../../components/operations/ExportMenu";
import { Button } from "../../components/ui/Button";
import { MetricCard } from "../../components/ui/MetricCard";
import { PageHeader } from "../../components/ui/PageHeader";
import { Section } from "../../components/ui/Section";
import { Surface } from "../../components/ui/Surface";
import { downloadCsv, downloadJson } from "../../lib/export";
import { formatCompactDateTime, titleCase } from "../../lib/format";
import { StatusType } from "../../types/status";
import { listAgents } from "../agents/api";
import { listApprovals } from "../approvals/api";
import { getNotificationCenterData } from "../notifications/api";
import { getLogs, getLogStats, LogRecord } from "../reporting/api";
import { quickActions } from "./mockData";

type DashboardMetric = {
  label: string;
  value: string;
  meta: string;
  status: StatusType;
  statusLabel: string;
  icon: "agents" | "approvals" | "errors" | "stability";
};

type DashboardViewModel = {
  metrics: DashboardMetric[];
  alerts: Array<{
    id: string;
    title: string;
    detail: string;
    category: string;
    status: StatusType;
  }>;
  activity: Array<{
    id: string;
    title: string;
    meta: string;
    timestamp: string;
    status: StatusType;
  }>;
  liveAlertCount: number;
  pendingApprovals: number;
  activePolicies: number;
  runtimeStability: string;
};

const toStatusFromLogType = (eventType: string): StatusType => {
  if (eventType === "runtime_error") {
    return "danger";
  }
  if (eventType === "enforcement_decision") {
    return "warning";
  }
  if (eventType === "tool_call_result") {
    return "success";
  }
  return "info";
};

const toEventTitle = (eventType: string): string => {
  const labels: Record<string, string> = {
    runtime_error: "Runtime error recorded",
    enforcement_decision: "Policy enforcement decision",
    tool_call_attempt: "Tool call attempted",
    tool_call_result: "Tool call completed",
    approval_requested: "Approval requested",
    approval_decided: "Approval decision recorded",
  };
  return labels[eventType] || titleCase(eventType);
};

const sortLogsByTimestampDesc = (logs: LogRecord[]): LogRecord[] => {
  return [...logs].sort((a, b) => {
    const left = new Date(a.timestamp).getTime();
    const right = new Date(b.timestamp).getTime();
    return right - left;
  });
};

const buildDashboardViewModel = (input: {
  agentCount: number;
  activePolicies: number;
  pendingApprovals: number;
  notificationAlerts: Awaited<ReturnType<typeof getNotificationCenterData>>;
  runtimeErrorsTotal: number;
  recentLogs: LogRecord[];
  totalLogs: number;
}): DashboardViewModel => {
  const runtimeStability =
    input.totalLogs > 0
      ? `${(((input.totalLogs - input.runtimeErrorsTotal) / input.totalLogs) * 100).toFixed(1)}%`
      : "Unavailable";

  const metrics: DashboardMetric[] = [
    {
      label: "Active agents",
      value: String(input.agentCount),
      meta:
        input.agentCount > 0
          ? "Agents configured and available for runtime execution."
          : "No agents configured yet.",
      status: input.agentCount > 0 ? "success" : "warning",
      statusLabel: input.agentCount > 0 ? "Online" : "Needs setup",
      icon: "agents",
    },
    {
      label: "Open approvals",
      value: String(input.pendingApprovals),
      meta:
        input.pendingApprovals > 0
          ? "Human decisions waiting in approval queue."
          : "No approvals waiting.",
      status:
        input.pendingApprovals > 10
          ? "danger"
          : input.pendingApprovals > 0
            ? "pending"
            : "success",
      statusLabel:
        input.pendingApprovals > 10
          ? "Urgent"
          : input.pendingApprovals > 0
            ? "Pending"
            : "Clear",
      icon: "approvals",
    },
    {
      label: "Runtime errors",
      value: String(input.runtimeErrorsTotal),
      meta:
        input.runtimeErrorsTotal > 0
          ? "Errors were observed in recent runtime logs."
          : "No runtime errors observed recently.",
      status:
        input.runtimeErrorsTotal > 3
          ? "danger"
          : input.runtimeErrorsTotal > 0
            ? "warning"
            : "success",
      statusLabel:
        input.runtimeErrorsTotal > 3
          ? "Needs review"
          : input.runtimeErrorsTotal > 0
            ? "Watch"
            : "Stable",
      icon: "errors",
    },
    {
      label: "Runtime stability",
      value: runtimeStability,
      meta:
        input.totalLogs > 0
          ? "Calculated from runtime_error ratio against total logs."
          : "Not enough log volume to calculate.",
      status:
        input.totalLogs === 0
          ? "info"
          : input.runtimeErrorsTotal > 3
            ? "warning"
            : "success",
      statusLabel: input.totalLogs === 0 ? "Unavailable" : "Derived",
      icon: "stability",
    },
  ];

  return {
    metrics,
    alerts: input.notificationAlerts.alerts.slice(0, 6).map((alert) => ({
      id: alert.id,
      title: alert.title,
      detail: alert.description,
      category: alert.type,
      status: alert.severity,
    })),
    activity: sortLogsByTimestampDesc(input.recentLogs)
      .slice(0, 8)
      .map((log) => ({
        id: `log-${log.id}`,
        title: toEventTitle(log.event_type),
        meta: `Session ${log.session_id} | Agent ${log.agent_id}`,
        timestamp: formatCompactDateTime(log.timestamp),
        status: toStatusFromLogType(log.event_type),
      })),
    liveAlertCount: input.notificationAlerts.counts.total,
    pendingApprovals: input.pendingApprovals,
    activePolicies: input.activePolicies,
    runtimeStability,
  };
};

export const DashboardPage = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<DashboardViewModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [agents, approvals, notificationCenter, runtimeErrors, recentLogs, logStats] =
        await Promise.all([
          listAgents(),
          listApprovals({ statusFilter: "pending", limit: 200, offset: 0 }),
          getNotificationCenterData(),
          getLogs({ eventType: "runtime_error", limit: 200, offset: 0 }),
          getLogs({ limit: 50, offset: 0 }),
          getLogStats(),
        ]);

      const model = buildDashboardViewModel({
        agentCount: agents.length,
        activePolicies: agents.filter((agent) => agent.policy !== null).length,
        pendingApprovals: approvals.total,
        notificationAlerts: notificationCenter,
        runtimeErrorsTotal: runtimeErrors.total,
        recentLogs: recentLogs.logs,
        totalLogs: logStats.total_logs,
      });

      setDashboardData(model);
    } catch {
      setError("Unable to load live dashboard data right now.");
      setDashboardData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const metricIconMap = useMemo(
    () => ({
      agents: <Text fontSize="sm" fontWeight="700">AG</Text>,
      approvals: <Text fontSize="sm" fontWeight="700">AP</Text>,
      errors: <Text fontSize="sm" fontWeight="700">ER</Text>,
      stability: <Text fontSize="sm" fontWeight="700">ST</Text>,
    }),
    []
  );

  const exportSnapshotJson = async () => {
    try {
      const [alerts, stats] = await Promise.all([
        getNotificationCenterData(),
        getLogStats(),
      ]);

      const payload = {
        generated_at: new Date().toISOString(),
        log_stats: stats,
        notification_counts: alerts.counts,
        top_alerts: alerts.alerts.slice(0, 10),
        metrics: dashboardData?.metrics || [],
      };
      downloadJson("agentflow-dashboard-snapshot.json", payload);
    } catch {
      toast({
        title: "Export failed",
        description: "Unable to build dashboard snapshot right now.",
        status: "error",
        duration: 3000,
      });
    }
  };

  const exportSnapshotCsv = async () => {
    try {
      const alerts = await getNotificationCenterData();
      downloadCsv(
        "agentflow-dashboard-alerts.csv",
        alerts.alerts.slice(0, 100).map((alert) => ({
          id: alert.id,
          source: alert.source,
          severity: alert.severity,
          title: alert.title,
          description: alert.description,
          timestamp: alert.timestamp,
          session_id: alert.sessionId,
          agent_id: alert.agentId,
          route: alert.route,
        }))
      );
    } catch {
      toast({
        title: "Export failed",
        description: "Unable to export snapshot CSV right now.",
        status: "error",
        duration: 3000,
      });
    }
  };

  const content = () => {
    if (isLoading) {
      return <LoadingPanel label="Loading live dashboard data..." />;
    }

    if (error || !dashboardData) {
      return (
        <ErrorPanel
          title="Dashboard unavailable"
          message={error || "Unable to prepare dashboard data."}
          actionLabel="Retry"
          onAction={() => {
            void loadDashboard();
          }}
        />
      );
    }

    return (
      <Grid templateColumns={{ base: "1fr", xl: "1.2fr 1fr" }} gap={6} alignItems="start">
        <GridItem>
          <VStack align="stretch" spacing={5}>
            <Surface
              bg="linear-gradient(145deg, rgba(255, 242, 198, 0.85) 0%, rgba(170, 196, 245, 0.2) 100%)"
              borderColor="brand.200"
            >
              <VStack align="stretch" spacing={5}>
                <VStack align="start" spacing={2}>
                  <Text
                    color="text.muted"
                    fontSize="xs"
                    textTransform="uppercase"
                    letterSpacing="0.08em"
                  >
                    Command center
                  </Text>
                  <Text fontSize={{ base: "2xl", md: "3xl" }} fontWeight="700" letterSpacing="-0.02em">
                    Focus first on approvals and runtime risk.
                  </Text>
                  <Text color="text.secondary" maxW="700px">
                    This dashboard is now fully live. No sample values are shown, and every section reflects current backend state.
                  </Text>
                </VStack>

                <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={4}>
                  <GridItem>
                    <Surface bg="rgba(255,255,255,0.82)" p={4}>
                      <VStack align="stretch" spacing={2}>
                        <Text fontSize="xs" letterSpacing="0.08em" textTransform="uppercase" color="text.muted">
                          Act now
                        </Text>
                        <HStack justify="space-between">
                          <Text color="text.secondary">Pending approvals</Text>
                          <Text fontWeight="700" color={dashboardData.pendingApprovals > 0 ? "status.warning" : "status.success"}>
                            {dashboardData.pendingApprovals}
                          </Text>
                        </HStack>
                        <HStack justify="space-between">
                          <Text color="text.secondary">Live alerts</Text>
                          <Text fontWeight="700" color={dashboardData.liveAlertCount > 0 ? "status.warning" : "status.success"}>
                            {dashboardData.liveAlertCount}
                          </Text>
                        </HStack>
                      </VStack>
                    </Surface>
                  </GridItem>

                  <GridItem>
                    <Surface bg="rgba(255,255,255,0.82)" p={4}>
                      <VStack align="stretch" spacing={2}>
                        <Text fontSize="xs" letterSpacing="0.08em" textTransform="uppercase" color="text.muted">
                          System health
                        </Text>
                        <HStack justify="space-between">
                          <Text color="text.secondary">Active policies</Text>
                          <Text fontWeight="700">{dashboardData.activePolicies}</Text>
                        </HStack>
                        <HStack justify="space-between">
                          <Text color="text.secondary">Runtime stability</Text>
                          <Text fontWeight="700">{dashboardData.runtimeStability}</Text>
                        </HStack>
                      </VStack>
                    </Surface>
                  </GridItem>
                </Grid>
              </VStack>
            </Surface>

            <Section title="Core metrics">
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                {dashboardData.metrics.map((item) => (
                  <MetricCard
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    meta={item.meta}
                    status={item.status}
                    statusLabel={item.statusLabel}
                    icon={metricIconMap[item.icon]}
                  />
                ))}
              </SimpleGrid>
            </Section>

            <Section title="Quick actions">
              <VStack align="stretch" spacing={3}>
                {quickActions.map((action) => (
                  <Surface
                    key={action.id}
                    as="button"
                    textAlign="left"
                    p={4}
                    borderLeftWidth="4px"
                    borderLeftColor="brand.400"
                    _hover={{ borderColor: "brand.500" }}
                    onClick={() => navigate(action.route)}
                  >
                    <VStack align="start" spacing={1}>
                      <Text fontWeight="700">{action.label}</Text>
                      <Text color="text.secondary" fontSize="sm">
                        {action.description}
                      </Text>
                    </VStack>
                  </Surface>
                ))}
              </VStack>
            </Section>
          </VStack>
        </GridItem>

        <GridItem>
          <VStack align="stretch" spacing={5}>
            <Section title="Act now: recent alerts">
              {dashboardData.alerts.length > 0 ? (
                <AlertList items={dashboardData.alerts} />
              ) : (
                <EmptyPanel
                  title="No live alerts"
                  description="No approvals, runtime errors, or policy blocks are currently waiting for action."
                />
              )}
            </Section>

            <Section title="Recent events">
              {dashboardData.activity.length > 0 ? (
                <ActivityList items={dashboardData.activity} />
              ) : (
                <EmptyPanel
                  title="No recent events"
                  description="No session or runtime events were found for the selected dashboard window."
                />
              )}
            </Section>
          </VStack>
        </GridItem>
      </Grid>
    );
  };

  return (
    <VStack align="stretch" spacing={8}>
      <PageHeader
        title="Dashboard"
        description="Track platform activity, monitor risk signals, and move quickly from overview to action."
        actions={
          <HStack>
            <ExportMenu
              label="Export snapshot"
              onExportJson={() => void exportSnapshotJson()}
              onExportCsv={() => void exportSnapshotCsv()}
            />
            <Button onClick={() => navigate("/builder")}>Open builder</Button>
          </HStack>
        }
      />

      {content()}
    </VStack>
  );
};
