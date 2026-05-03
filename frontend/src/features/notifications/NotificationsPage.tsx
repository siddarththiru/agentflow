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
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { AlertFeed } from "../../components/operations/AlertFeed";
import { EmptyPanel } from "../../components/operations/EmptyPanel";
import { ErrorPanel } from "../../components/operations/ErrorPanel";
import { ExportMenu } from "../../components/operations/ExportMenu";
import { FilterBar } from "../../components/operations/FilterBar";
import { LoadingPanel } from "../../components/operations/LoadingPanel";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { Surface } from "../../components/ui/Surface";
import { downloadCsv, downloadJson } from "../../lib/export";
import { getNotificationCenterData } from "./api";
import { NotificationAlert } from "./types";

export const NotificationsPage = () => {
  const [alerts, setAlerts] = useState<NotificationAlert[]>([]);
  const [counts, setCounts] = useState({ total: 0, danger: 0, warning: 0, pending: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const [typeFilter, setTypeFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");

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

  useEffect(() => {
    void loadNotifications();
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

    </VStack>
  );
};

