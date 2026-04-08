import {
  Grid,
  GridItem,
  HStack,
  Input,
  Select,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DataTable } from "../../components/operations/DataTable";
import { DetailCard } from "../../components/operations/DetailCard";
import { EmptyPanel } from "../../components/operations/EmptyPanel";
import { ErrorPanel } from "../../components/operations/ErrorPanel";
import { FilterBar } from "../../components/operations/FilterBar";
import { LoadingPanel } from "../../components/operations/LoadingPanel";
import { MetadataList } from "../../components/operations/MetadataList";
import { RiskBadge } from "../../components/operations/RiskBadge";
import { SessionDetailPanel } from "../../components/operations/SessionDetailPanel";
import { SessionStatusBadge } from "../../components/operations/SessionStatusBadge";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { formatDateTime } from "../../lib/format";
import {
  getAgentActivity,
  getInvestigationSession,
  getInvestigationTimeline,
  listInvestigationApprovals,
  listInvestigationClassifications,
  listInvestigationSessions,
} from "./api";
import {
  AgentActivity,
  InvestigationApproval,
  InvestigationClassification,
  InvestigationSessionDetail,
  InvestigationSessionSummary,
  InvestigationTimelineResponse,
} from "./types";

const PAGE_SIZE = 10;

export const InvestigationPage = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSessionId = searchParams.get("sessionId") || "";

  const [filters, setFilters] = useState({ status: "", agentId: "" });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [sessions, setSessions] = useState<InvestigationSessionSummary[]>([]);
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const [sessionOffset, setSessionOffset] = useState(0);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsMoreLoading, setSessionsMoreLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const [detail, setDetail] = useState<InvestigationSessionDetail | null>(null);
  const [timeline, setTimeline] = useState<InvestigationTimelineResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [classifications, setClassifications] = useState<InvestigationClassification[]>([]);
  const [classificationsLoading, setClassificationsLoading] = useState(true);
  const [classificationsError, setClassificationsError] = useState<string | null>(null);

  const [approvalsHistory, setApprovalsHistory] = useState<InvestigationApproval[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(true);
  const [approvalsError, setApprovalsError] = useState<string | null>(null);

  const [activityAgentId, setActivityAgentId] = useState("");
  const [activity, setActivity] = useState<AgentActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  const selectedSummary = useMemo(
    () => sessions.find((session) => session.session_id === selectedSessionId),
    [sessions, selectedSessionId]
  );

  const sessionsHaveMore = sessions.length < sessionsTotal;

  const loadSessions = async () => {
    try {
      if (sessionOffset === 0) {
        setSessionsLoading(true);
      } else {
        setSessionsMoreLoading(true);
      }
      setSessionsError(null);
      const response = await listInvestigationSessions({
        status: appliedFilters.status,
        agentId: appliedFilters.agentId,
        limit: PAGE_SIZE,
        offset: sessionOffset,
      });
      setSessionsTotal(response.total);
      setSessions((previous) =>
        sessionOffset === 0 ? response.sessions : [...previous, ...response.sessions]
      );
    } catch (error) {
      setSessionsError(error instanceof Error ? error.message : "Unable to load sessions.");
    } finally {
      setSessionsLoading(false);
      setSessionsMoreLoading(false);
    }
  };

  const loadClassifications = async () => {
    setClassificationsLoading(true);
    setClassificationsError(null);
    try {
      const response = await listInvestigationClassifications({ limit: 12, offset: 0 });
      setClassifications(response.classifications);
    } catch (error) {
      setClassificationsError(error instanceof Error ? error.message : "Unable to load classifications.");
    } finally {
      setClassificationsLoading(false);
    }
  };

  const loadApprovalsHistory = async () => {
    setApprovalsLoading(true);
    setApprovalsError(null);
    try {
      const response = await listInvestigationApprovals({ limit: 12, offset: 0 });
      setApprovalsHistory(response.approvals);
    } catch (error) {
      setApprovalsError(error instanceof Error ? error.message : "Unable to load approval history.");
    } finally {
      setApprovalsLoading(false);
    }
  };

  const loadSelectedSession = async (sessionId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const [sessionDetail, sessionTimeline] = await Promise.all([
        getInvestigationSession(sessionId),
        getInvestigationTimeline(sessionId),
      ]);
      setDetail(sessionDetail);
      setTimeline(sessionTimeline);
      if (!activityAgentId) {
        setActivityAgentId(String(sessionDetail.agent_id));
      }
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Unable to load session detail.");
      setDetail(null);
      setTimeline(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, [appliedFilters, sessionOffset]);

  useEffect(() => {
    void loadClassifications();
    void loadApprovalsHistory();
  }, []);

  useEffect(() => {
    if (!selectedSessionId) {
      setDetail(null);
      setTimeline(null);
      setDetailError(null);
      return;
    }
    void loadSelectedSession(selectedSessionId);
  }, [selectedSessionId]);

  const applySessionFilters = () => {
    setSessions([]);
    setSessionOffset(0);
    setAppliedFilters({ ...filters });
  };

  const openSession = (sessionId: string) => {
    setSearchParams({ sessionId });
  };

  const clearSelection = () => {
    setSearchParams({});
  };

  const loadMoreSessions = () => {
    setSessionOffset((current) => current + PAGE_SIZE);
  };

  const refreshOverview = () => {
    setSessions([]);
    setSessionOffset(0);
    setAppliedFilters({ ...filters });
    void loadClassifications();
    void loadApprovalsHistory();
  };

  const runAgentActivity = async () => {
    if (!activityAgentId.trim()) {
      setActivityError("Enter an agent ID to inspect activity.");
      return;
    }

    setActivityLoading(true);
    setActivityError(null);
    try {
      const response = await getAgentActivity(activityAgentId.trim());
      setActivity(response);
    } catch (error) {
      setActivityError(error instanceof Error ? error.message : "Unable to load agent activity.");
      setActivity(null);
    } finally {
      setActivityLoading(false);
    }
  };

  const sessionColumns = [
    {
      key: "session",
      header: "Session",
      render: (session: InvestigationSessionSummary) => (
        <VStack align="start" spacing={1}>
          <Text fontWeight="700">{session.session_id}</Text>
          <Text color="text.secondary" fontSize="sm">
            Agent {session.agent_id}
          </Text>
        </VStack>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (session: InvestigationSessionSummary) => <SessionStatusBadge status={session.status} />,
    },
    {
      key: "created",
      header: "Created",
      render: (session: InvestigationSessionSummary) => <Text color="text.secondary">{formatDateTime(session.created_at)}</Text>,
    },
    {
      key: "updated",
      header: "Updated",
      render: (session: InvestigationSessionSummary) => <Text color="text.secondary">{formatDateTime(session.last_updated)}</Text>,
    },
  ];

  const classificationColumns = [
    {
      key: "session",
      header: "Session",
      render: (item: InvestigationClassification) => <Text>{item.session_id}</Text>,
    },
    {
      key: "risk",
      header: "Risk",
      render: (item: InvestigationClassification) => <RiskBadge risk={item.risk_level} />,
    },
    {
      key: "confidence",
      header: "Confidence",
      render: (item: InvestigationClassification) => (
        <Text color="text.secondary">{item.confidence ?? "-"}</Text>
      ),
    },
    {
      key: "timestamp",
      header: "Timestamp",
      render: (item: InvestigationClassification) => (
        <Text color="text.secondary">{formatDateTime(item.timestamp)}</Text>
      ),
    },
  ];

  const approvalColumns = [
    {
      key: "session",
      header: "Session",
      render: (item: InvestigationApproval) => <Text fontWeight="600">{item.session_id}</Text>,
    },
    {
      key: "tool",
      header: "Tool",
      render: (item: InvestigationApproval) => <Text>{item.tool_name}</Text>,
    },
    {
      key: "status",
      header: "Status",
      render: (item: InvestigationApproval) => <SessionStatusBadge status={item.status} />,
    },
    {
      key: "decided",
      header: "Decided",
      render: (item: InvestigationApproval) => <Text color="text.secondary">{formatDateTime(item.decided_at || null)}</Text>,
    },
  ];

  return (
    <VStack align="stretch" spacing={7}>
      <PageHeader
        title="Investigation"
        description="Audit session traces, classification outcomes, approval history, and agent activity in one coordinated view."
        actions={
          <Button variant="outline" onClick={refreshOverview}>
            Refresh
          </Button>
        }
      />

      <FilterBar>
        <VStack align="start" spacing={1} minW="180px">
          <Text fontSize="sm" fontWeight="700" color="text.secondary">
            Status
          </Text>
          <Select
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option value="">All statuses</option>
            <option value="paused">Paused</option>
            <option value="running">Running</option>
            <option value="terminated">Terminated</option>
            <option value="completed">Completed</option>
          </Select>
        </VStack>
        <VStack align="start" spacing={1} minW="180px">
          <Text fontSize="sm" fontWeight="700" color="text.secondary">
            Agent ID
          </Text>
          <Input
            value={filters.agentId}
            onChange={(event) => setFilters((prev) => ({ ...prev, agentId: event.target.value }))}
            placeholder="Filter by agent"
          />
        </VStack>
        <Button onClick={applySessionFilters}>Apply filters</Button>
        <Button variant="ghost" onClick={() => setFilters({ status: "", agentId: "" })}>
          Clear
        </Button>
        {selectedSessionId ? (
          <Button variant="ghost" onClick={clearSelection}>
            Clear selection
          </Button>
        ) : null}
      </FilterBar>

      <Grid templateColumns={{ base: "1fr", xl: "1.25fr 0.85fr" }} gap={5} alignItems="start">
        <GridItem>
          <VStack align="stretch" spacing={4}>
            {sessionsLoading && sessions.length === 0 ? <LoadingPanel label="Loading sessions..." /> : null}
            {sessionsError ? (
              <ErrorPanel message={sessionsError} actionLabel="Retry" onAction={refreshOverview} />
            ) : null}
            <DataTable
              rows={sessions}
              rowKey={(item) => item.session_id}
              onRowClick={(item) => openSession(item.session_id)}
              emptyMessage="No sessions match the current filters."
              columns={sessionColumns}
            />
            {sessionsHaveMore ? (
              <HStack justify="center">
                <Button onClick={loadMoreSessions} isLoading={sessionsMoreLoading} variant="outline">
                  Load more
                </Button>
              </HStack>
            ) : null}
          </VStack>
        </GridItem>

        <GridItem>
          <VStack
            align="stretch"
            spacing={4}
            position={{ base: "static", xl: "sticky" }}
            top={{ base: "auto", xl: "92px" }}
          >
            <SessionDetailPanel
              detail={detail || selectedSummary || null}
              events={timeline?.events || null}
              isLoading={detailLoading}
              error={detailError}
              onOpenApproval={(sessionId) => navigate(`/approvals?sessionId=${sessionId}`)}
              onOpenInvestigation={(sessionId) => navigate(`/investigation?sessionId=${sessionId}`)}
            />

            <DetailCard title="Agent activity" subtitle="Inspect recent usage and high-risk signals by agent ID">
              <VStack align="stretch" spacing={4}>
                <Input
                  value={activityAgentId}
                  onChange={(event) => setActivityAgentId(event.target.value)}
                  placeholder="Agent ID"
                />
                <Button onClick={() => void runAgentActivity()} isLoading={activityLoading} alignSelf="start">
                  Load activity
                </Button>
                {activityError ? <Text color="status.danger">{activityError}</Text> : null}
                {activity ? (
                  <VStack align="stretch" spacing={3}>
                    <MetadataList
                      items={[
                        { label: "Agent", value: `${activity.agent_name} (${activity.agent_id})` },
                        { label: "Total sessions", value: String(activity.total_sessions) },
                        { label: "Blocks", value: String(activity.block_count) },
                        { label: "Approvals", value: String(activity.approval_count) },
                      ]}
                    />
                    <DetailCard title="Tool usage" subtitle="Most called tools">
                      {Object.keys(activity.tool_usage_counts).length > 0 ? (
                        <VStack align="stretch" spacing={2}>
                          {Object.entries(activity.tool_usage_counts).map(([tool, count]) => (
                            <HStack key={tool} justify="space-between">
                              <Text>{tool}</Text>
                              <Text fontWeight="700">{count}</Text>
                            </HStack>
                          ))}
                        </VStack>
                      ) : (
                        <EmptyPanel
                          title="No tool usage captured"
                          description="This agent has not recorded any tool calls in the current window."
                        />
                      )}
                    </DetailCard>
                    <DetailCard title="Recent high-risk classifications" subtitle="Only high and critical findings">
                      {activity.risk_classifications.length > 0 ? (
                        <VStack align="stretch" spacing={2}>
                          {activity.risk_classifications.map((item) => (
                            <HStack key={`${item.session_id}-${item.timestamp}`} justify="space-between">
                              <Text>{item.session_id}</Text>
                              <RiskBadge risk={item.risk_level} />
                            </HStack>
                          ))}
                        </VStack>
                      ) : (
                        <EmptyPanel
                          title="No high-risk classifications"
                          description="This agent does not currently show elevated-risk classifications."
                        />
                      )}
                    </DetailCard>
                  </VStack>
                ) : null}
              </VStack>
            </DetailCard>
          </VStack>
        </GridItem>
      </Grid>

      <Grid templateColumns={{ base: "1fr", xl: "1fr 1fr" }} gap={5}>
        <GridItem>
          <DetailCard title="Classifications" subtitle="Sanitized threat and risk outputs">
            {classificationsLoading ? <LoadingPanel label="Loading classifications..." /> : null}
            {classificationsError ? (
              <ErrorPanel message={classificationsError} actionLabel="Retry" onAction={() => void loadClassifications()} />
            ) : null}
            <DataTable
              rows={classifications}
              rowKey={(item) => `${item.session_id}-${item.timestamp}`}
              emptyMessage="No classifications found."
              columns={classificationColumns}
            />
          </DetailCard>
        </GridItem>

        <GridItem>
          <DetailCard title="Approval history" subtitle="Read-only historical approval records">
            {approvalsLoading ? <LoadingPanel label="Loading approvals..." /> : null}
            {approvalsError ? (
              <ErrorPanel message={approvalsError} actionLabel="Retry" onAction={() => void loadApprovalsHistory()} />
            ) : null}
            <DataTable
              rows={approvalsHistory}
              rowKey={(item) => `${item.session_id}-${item.id}`}
              onRowClick={(item) => navigate(`/approvals?sessionId=${item.session_id}`)}
              emptyMessage="No historical approvals found."
              columns={approvalColumns}
            />
          </DetailCard>
        </GridItem>
      </Grid>
    </VStack>
  );
};
