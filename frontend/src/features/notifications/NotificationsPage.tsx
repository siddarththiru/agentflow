import {
  Grid,
  HStack,
  Input,
  Select,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertFeed } from "../../components/operations/AlertFeed";
import { DetailCard } from "../../components/operations/DetailCard";
import { EmptyPanel } from "../../components/operations/EmptyPanel";
import { ErrorPanel } from "../../components/operations/ErrorPanel";
import { ExportMenu } from "../../components/operations/ExportMenu";
import { FilterBar } from "../../components/operations/FilterBar";
import { LoadingPanel } from "../../components/operations/LoadingPanel";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { Surface } from "../../components/ui/Surface";
import { downloadCsv, downloadJson } from "../../lib/export";
import {
  getAgentLogs,
  getLogEventTypes,
  getLogs,
  getLogStats,
  getSessionLogs,
} from "../reporting/api";
import { getNotificationCenterData } from "./api";
import { NotificationAlert } from "./types";

export const NotificationsPage = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [alerts, setAlerts] = useState<NotificationAlert[]>([]);
  const [counts, setCounts] = useState({ total: 0, danger: 0, warning: 0, pending: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const [typeFilter, setTypeFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");

  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [reportFilter, setReportFilter] = useState({
    sessionId: "",
    agentId: "",
    eventType: "",
  });

  const loadNotifications = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getNotificationCenterData();
      setAlerts(response.alerts);
      setCounts(response.counts);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load notifications.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadReportingContext = async () => {
    try {
      const [types] = await Promise.all([getLogEventTypes(), getLogStats()]);
      setEventTypes(types);
    } catch {
      setEventTypes([]);
    }
  };

  useEffect(() => {
    void loadNotifications();
    void loadReportingContext();
  }, []);

  const filteredAlerts = useMemo(
    () =>
      alerts.filter((alert) => {
        const typeOk = typeFilter ? alert.source === typeFilter : true;
        const severityOk = severityFilter ? alert.severity === severityFilter : true;
        return typeOk && severityOk;
      }),
    [alerts, typeFilter, severityFilter]
  );

  const dismissAlert = (id: string) => {
    setDismissed((prev) => [...prev, id]);
  };

  const exportCurrentAlertFeed = () => {
    downloadJson("agentflow-alert-feed.json", {
      generated_at: new Date().toISOString(),
      counts,
      alerts: filteredAlerts.filter((alert) => !dismissed.includes(alert.id)),
    });
  };

  const exportLogsJson = async () => {
    const response = await getLogs({
      sessionId: reportFilter.sessionId || undefined,
      agentId: reportFilter.agentId || undefined,
      eventType: reportFilter.eventType || undefined,
      limit: 300,
      offset: 0,
    });
    downloadJson("agentflow-logs.json", response);
  };

  const exportLogsCsv = async () => {
    const response = await getLogs({
      sessionId: reportFilter.sessionId || undefined,
      agentId: reportFilter.agentId || undefined,
      eventType: reportFilter.eventType || undefined,
      limit: 300,
      offset: 0,
    });
    downloadCsv(
      "agentflow-logs.csv",
      response.logs.map((row) => ({
        id: row.id,
        session_id: row.session_id,
        agent_id: row.agent_id,
        event_type: row.event_type,
        timestamp: row.timestamp,
        event_data: JSON.stringify(row.event_data),
      }))
    );
  };

  const exportSessionTimeline = async () => {
    if (!reportFilter.sessionId.trim()) {
      toast({
        title: "Session ID required",
        description: "Enter a session ID to export timeline logs.",
        status: "warning",
        duration: 3000,
      });
      return;
    }
    const response = await getSessionLogs(reportFilter.sessionId.trim());
    downloadJson(`agentflow-session-${reportFilter.sessionId.trim()}-timeline.json`, response);
  };

  const exportAgentLogs = async () => {
    if (!reportFilter.agentId.trim()) {
      toast({
        title: "Agent ID required",
        description: "Enter an agent ID to export agent logs.",
        status: "warning",
        duration: 3000,
      });
      return;
    }
    const response = await getAgentLogs(reportFilter.agentId.trim());
    downloadJson(`agentflow-agent-${reportFilter.agentId.trim()}-logs.json`, response);
  };





  return (
    <VStack align="stretch" spacing={7}>
      <PageHeader
        title="Notifications"
        description="Derived alert center built from approvals, classifications, enforcement, runtime errors, and session outcomes."
        actions={
          <HStack>
            <ExportMenu
              label="Export alert feed"
              onExportJson={exportCurrentAlertFeed}
              onExportCsv={() =>
                downloadCsv(
                  "agentflow-alert-feed.csv",
                  filteredAlerts
                    .filter((alert) => !dismissed.includes(alert.id))
                    .map((alert) => ({
                      id: alert.id,
                      type: alert.type,
                      source: alert.source,
                      severity: alert.severity,
                      title: alert.title,
                      description: alert.description,
                      timestamp: alert.timestamp,
                      session_id: alert.sessionId,
                      agent_id: alert.agentId,
                    }))
                )
              }
            />
            <Button variant="outline" onClick={() => void loadNotifications()}>
              Refresh
            </Button>
          </HStack>
        }
      />

      <Grid templateColumns={{ base: "1fr", md: "repeat(4, 1fr)" }} gap={4}>
        <Surface p={4}>
          <Stat>
            <StatLabel>Total alerts</StatLabel>
            <StatNumber>{counts.total}</StatNumber>
          </Stat>
        </Surface>
        <Surface p={4}>
          <Stat>
            <StatLabel>Danger</StatLabel>
            <StatNumber>{counts.danger}</StatNumber>
          </Stat>
        </Surface>
        <Surface p={4}>
          <Stat>
            <StatLabel>Warning</StatLabel>
            <StatNumber>{counts.warning}</StatNumber>
          </Stat>
        </Surface>
        <Surface p={4}>
          <Stat>
            <StatLabel>Pending</StatLabel>
            <StatNumber>{counts.pending}</StatNumber>
          </Stat>
        </Surface>
      </Grid>

      <FilterBar>
        <VStack align="start" spacing={1} minW="180px">
          <Text fontSize="sm" fontWeight="700" color="text.secondary">
            Alert type
          </Text>
          <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="">All</option>
            <option value="approval">Approval</option>
            <option value="classification">Classification</option>
            <option value="runtime_error">Runtime error</option>
            <option value="blocked">Policy block</option>
            <option value="session_status">Session status</option>
          </Select>
        </VStack>
        <VStack align="start" spacing={1} minW="180px">
          <Text fontSize="sm" fontWeight="700" color="text.secondary">
            Severity
          </Text>
          <Select
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value)}
          >
            <option value="">All</option>
            <option value="danger">Danger</option>
            <option value="warning">Warning</option>
            <option value="pending">Pending</option>
            <option value="info">Info</option>
          </Select>
        </VStack>
        <Button
          variant="ghost"
          onClick={() => {
            setTypeFilter("");
            setSeverityFilter("");
          }}
        >
          Clear filters
        </Button>
      </FilterBar>

      {isLoading ? <LoadingPanel label="Loading notifications..." /> : null}
      {error ? (
        <ErrorPanel
          message={error}
          actionLabel="Retry"
          onAction={() => void loadNotifications()}
        />
      ) : null}
      {!isLoading && !error ? (
        filteredAlerts.length > 0 ? (
          <AlertFeed
            items={filteredAlerts}
            dismissedIds={dismissed}
            onDismiss={dismissAlert}
          />
        ) : (
          <EmptyPanel
            title="No alerts for current filters"
            description="Try a different severity/type filter, or refresh to pull new backend signals."
          />
        )
      ) : null}

      <DetailCard
        title="Reporting and export"
        subtitle="Client-side exports built on existing backend data"
      >
        <VStack align="stretch" spacing={4}>
          <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={3}>
            <VStack align="start" spacing={1}>
              <Text fontSize="sm" fontWeight="700" color="text.secondary">
                Session ID
              </Text>
              <Input
                value={reportFilter.sessionId}
                onChange={(event) =>
                  setReportFilter((prev) => ({ ...prev, sessionId: event.target.value }))
                }
                placeholder="Optional"
              />
            </VStack>
            <VStack align="start" spacing={1}>
              <Text fontSize="sm" fontWeight="700" color="text.secondary">
                Agent ID
              </Text>
              <Input
                value={reportFilter.agentId}
                onChange={(event) =>
                  setReportFilter((prev) => ({ ...prev, agentId: event.target.value }))
                }
                placeholder="Optional"
              />
            </VStack>
            <VStack align="start" spacing={1}>
              <Text fontSize="sm" fontWeight="700" color="text.secondary">
                Event type
              </Text>
              <Select
                value={reportFilter.eventType}
                onChange={(event) =>
                  setReportFilter((prev) => ({ ...prev, eventType: event.target.value }))
                }
              >
                <option value="">All event types</option>
                {eventTypes.map((eventType) => (
                  <option value={eventType} key={eventType}>
                    {eventType}
                  </option>
                ))}
              </Select>
            </VStack>
          </Grid>

          <HStack flexWrap="wrap" spacing={3}>
            <Button size="sm" variant="outline" onClick={() => void exportLogsJson()}>
              Export filtered logs JSON
            </Button>
            <Button size="sm" variant="outline" onClick={() => void exportLogsCsv()}>
              Export filtered logs CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => void exportSessionTimeline()}>
              Export session timeline
            </Button>
            <Button size="sm" variant="outline" onClick={() => void exportAgentLogs()}>
              Export agent logs
            </Button>
          </HStack>
        </VStack>
      </DetailCard>
    </VStack>
  );
};

