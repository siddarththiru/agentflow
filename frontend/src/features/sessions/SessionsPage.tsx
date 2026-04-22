import {
  HStack,
  Input,
  Select,
  Text,
  VStack,
  useToast,
  useDisclosure,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DataTable } from "../../components/operations/DataTable";
import { ErrorPanel } from "../../components/operations/ErrorPanel";
import { FilterBar } from "../../components/operations/FilterBar";
import { LoadingPanel } from "../../components/operations/LoadingPanel";
import { SessionStatusBadge } from "../../components/operations/SessionStatusBadge";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { formatDateTime } from "../../lib/format";
import { listSessions, resumeAgent } from "./api";
import { SessionSummary } from "./types";
import { SessionDetailModal } from "./SessionDetailModal";

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
  const agentIdFromQuery = searchParams.get("agentId") || "";

  const { isOpen, onOpen, onClose } = useDisclosure();
  const [modalSessionId, setModalSessionId] = useState<string | null>(null);

  const [filters, setFilters] = useState<SessionFilters>({ status: "", agentId: agentIdFromQuery });
  const [appliedFilters, setAppliedFilters] = useState<SessionFilters>({
    status: "",
    agentId: agentIdFromQuery,
  });
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const openSession = (sessionId: string) => {
    setModalSessionId(sessionId);
    onOpen();
  };

  const closeModal = () => {
    onClose();
    setModalSessionId(null);
  };

  const clearSelection = () => {
    if (appliedFilters.agentId.trim()) {
      setSearchParams({ agentId: appliedFilters.agentId.trim() });
      return;
    }
    setSearchParams({});
  };

  useEffect(() => {
    setFilters((prev) => ({ ...prev, agentId: agentIdFromQuery }));
    setSessions([]);
    setOffset(0);
    setAppliedFilters((prev) => ({ ...prev, agentId: agentIdFromQuery }));
  }, [agentIdFromQuery]);

  const applyFilters = () => {
    setSessions([]);
    setOffset(0);
    setAppliedFilters({ ...filters });
  };

  const loadMore = () => {
    setOffset((current) => current + PAGE_SIZE);
  };

  const handleResume = async () => {
    if (!modalSessionId) {
      return;
    }
    try {
      const result = await resumeAgent(modalSessionId);
      toast({
        title: "Session resumed",
        description: `Session ${result.session_id} is now ${result.status}.`,
        status: "success",
        duration: 4000,
        isClosable: true,
      });
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
      </FilterBar>

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

      <SessionDetailModal
        sessionId={modalSessionId}
        isOpen={isOpen}
        onClose={closeModal}
        size="4xl"
        onOpenApproval={(sessionId) => {
          closeModal();
          navigate(`/approvals?sessionId=${sessionId}`);
        }}
        onOpenInvestigation={(sessionId) => {
          closeModal();
          navigate(`/investigation?sessionId=${sessionId}`);
        }}
        onResume={handleResume}
      />
    </VStack>
  );
};
