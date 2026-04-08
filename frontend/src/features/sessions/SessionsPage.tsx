import {
  Grid,
  GridItem,
  HStack,
  Input,
  Select,
  Text,
  Textarea,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DataTable } from "../../components/operations/DataTable";
import { DetailCard } from "../../components/operations/DetailCard";
import { ErrorPanel } from "../../components/operations/ErrorPanel";
import { FilterBar } from "../../components/operations/FilterBar";
import { LoadingPanel } from "../../components/operations/LoadingPanel";
import { SessionDetailPanel } from "../../components/operations/SessionDetailPanel";
import { SessionStatusBadge } from "../../components/operations/SessionStatusBadge";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { formatDateTime } from "../../lib/format";
import { getSessionDetail, getSessionTimeline, listSessions, resumeAgent, runAgent } from "./api";
import { SessionDetail, SessionEvent, SessionSummary } from "./types";

const PAGE_SIZE = 10;

type SessionFilters = {
  status: string;
  agentId: string;
};

export const SessionsPage = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSessionId = searchParams.get("sessionId") || "";

  const [filters, setFilters] = useState<SessionFilters>({ status: "", agentId: "" });
  const [appliedFilters, setAppliedFilters] = useState<SessionFilters>(filters);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedDetail, setSelectedDetail] = useState<SessionDetail | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<SessionEvent[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [agentId, setAgentId] = useState("");
  const [userInput, setUserInput] = useState(
    "Assess the operational status of the connected workflow and report anomalies."
  );
  const [runError, setRunError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const selectedSummary = useMemo(
    () => sessions.find((session) => session.session_id === selectedSessionId),
    [sessions, selectedSessionId]
  );

  const hasMore = sessions.length < total;

  useEffect(() => {
    const loadSessions = async () => {
      try {
        if (offset === 0) {
          setIsLoading(true);
        } else {
          setIsLoadingMore(true);
        }
        setLoadError(null);
        const response = await listSessions({
          status: appliedFilters.status,
          agentId: appliedFilters.agentId,
          limit: PAGE_SIZE,
          offset,
        });
        setTotal(response.total);
        setSessions((previous) =>
          offset === 0 ? response.sessions : [...previous, ...response.sessions]
        );
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Unable to load sessions.");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    };

    void loadSessions();
  }, [appliedFilters, offset]);

  useEffect(() => {
    if (!selectedSessionId) {
      setSelectedDetail(null);
      setSelectedEvents(null);
      setDetailError(null);
      return;
    }

    const loadSelectedSession = async () => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const [detail, timeline] = await Promise.all([
          getSessionDetail(selectedSessionId),
          getSessionTimeline(selectedSessionId),
        ]);
        setSelectedDetail(detail);
        setSelectedEvents(timeline.events);
        if (!agentId) {
          setAgentId(String(detail.agent_id));
        }
      } catch (error) {
        setDetailError(error instanceof Error ? error.message : "Unable to load session detail.");
        setSelectedDetail(null);
        setSelectedEvents(null);
      } finally {
        setDetailLoading(false);
      }
    };

    void loadSelectedSession();
  }, [selectedSessionId]);

  const applyFilters = () => {
    setSessions([]);
    setOffset(0);
    setAppliedFilters({ ...filters });
  };

  const loadMore = () => {
    setOffset((current) => current + PAGE_SIZE);
  };

  const openSession = (sessionId: string) => {
    setSearchParams({ sessionId });
  };

  const clearSelection = () => {
    setSearchParams({});
  };

  const handleRunAgent = async () => {
    const parsedAgentId = Number(agentId);
    if (!Number.isFinite(parsedAgentId) || parsedAgentId <= 0) {
      setRunError("Enter a valid agent ID.");
      return;
    }
    if (!userInput.trim()) {
      setRunError("Enter a user input prompt.");
      return;
    }

    setRunError(null);
    setIsRunning(true);
    try {
      const result = await runAgent({ agentId: parsedAgentId, userInput });
      toast({
        title: "Agent started",
        description: `Session ${result.session_id} is now ${result.status}.`,
        status: "success",
        duration: 4000,
        isClosable: true,
      });
      setSearchParams({ sessionId: result.session_id });
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Unable to run agent.");
    } finally {
      setIsRunning(false);
    }
  };

  const handleResume = async () => {
    if (!selectedSessionId) {
      return;
    }
    try {
      const result = await resumeAgent(selectedSessionId);
      toast({
        title: "Session resumed",
        description: `Session ${result.session_id} is now ${result.status}.`,
        status: "success",
        duration: 4000,
        isClosable: true,
      });
      const [detail, timeline] = await Promise.all([
        getSessionDetail(selectedSessionId),
        getSessionTimeline(selectedSessionId),
      ]);
      setSelectedDetail(detail);
      setSelectedEvents(timeline.events);
    } catch (error) {
      toast({
        title: "Resume failed",
        description: error instanceof Error ? error.message : "Unable to resume session.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    }
  };

  const sessionsTable = (
    <DataTable
      rows={sessions}
      rowKey={(item) => item.session_id}
      onRowClick={(item) => openSession(item.session_id)}
      emptyMessage={
        loadError
          ? "No sessions could be loaded."
          : "No sessions match the current filters."
      }
      columns={[
        {
          key: "session",
          header: "Session",
          render: (session) => (
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
          render: (session) => <SessionStatusBadge status={session.status} />,
        },
        {
          key: "created",
          header: "Created",
          render: (session) => <Text color="text.secondary">{formatDateTime(session.created_at)}</Text>,
        },
        {
          key: "updated",
          header: "Updated",
          render: (session) => <Text color="text.secondary">{formatDateTime(session.last_updated)}</Text>,
        },
      ]}
    />
  );

  return (
    <VStack align="stretch" spacing={7}>
      <PageHeader
        title="Sessions"
        description="Monitor active and historical sessions, inspect detail traces, and launch controlled runs when needed."
        actions={
          <Button variant="outline" onClick={applyFilters}>
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
        <Button onClick={applyFilters}>Apply filters</Button>
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
            {isLoading && sessions.length === 0 ? <LoadingPanel label="Loading sessions..." /> : null}
            {loadError ? <ErrorPanel message={loadError} actionLabel="Retry" onAction={applyFilters} /> : null}
            {!isLoading || sessions.length > 0 ? sessionsTable : null}
            {hasMore ? (
              <HStack justify="center">
                <Button onClick={loadMore} isLoading={isLoadingMore} variant="outline">
                  Load more
                </Button>
              </HStack>
            ) : null}
          </VStack>
        </GridItem>

        <GridItem>
          <VStack
            align="stretch"
            spacing={5}
            position={{ base: "static", xl: "sticky" }}
            top={{ base: "auto", xl: "92px" }}
          >
            <DetailCard title="Run agent" subtitle="Secondary control for starting a new session by agent ID">
              <VStack align="stretch" spacing={4}>
                <Input
                  value={agentId}
                  onChange={(event) => setAgentId(event.target.value)}
                  placeholder="Agent ID"
                  type="number"
                />
                <Textarea
                  value={userInput}
                  onChange={(event) => setUserInput(event.target.value)}
                  minH="140px"
                  placeholder="User input for the runtime"
                />
                {runError ? <Text color="status.danger">{runError}</Text> : null}
                <Button onClick={handleRunAgent} isLoading={isRunning} alignSelf="start">
                  Run agent
                </Button>
              </VStack>
            </DetailCard>

            <SessionDetailPanel
              detail={selectedDetail || selectedSummary || null}
              events={selectedEvents}
              isLoading={detailLoading}
              error={detailError}
              onOpenApproval={(sessionId) => navigate(`/approvals?sessionId=${sessionId}`)}
              onOpenInvestigation={(sessionId) => navigate(`/investigation?sessionId=${sessionId}`)}
              onResume={handleResume}
            />
          </VStack>
        </GridItem>
      </Grid>
    </VStack>
  );
};
