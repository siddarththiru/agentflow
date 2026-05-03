import {
  HStack,
  Input,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DataTable } from "../../components/operations/DataTable";
import { ErrorPanel } from "../../components/operations/ErrorPanel";
import { FilterBar } from "../../components/operations/FilterBar";
import { LoadingPanel } from "../../components/operations/LoadingPanel";
import { RiskBadge } from "../../components/operations/RiskBadge";
import { SessionStatusBadge } from "../../components/operations/SessionStatusBadge";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { formatDateTime } from "../../lib/format";
import { listApprovals } from "./api";
import { ApprovalSummary } from "./types";
import { ApprovalDetailModal } from "./ApprovalDetailModal";

const TABS = ["pending", "approved", "denied"] as const;

export const ApprovalsPage = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [searchParams, setSearchParams] = useSearchParams();
  const agentIdFromQuery = searchParams.get("agentId") || "";
  const sessionIdFromQuery = searchParams.get("sessionId") || "";

  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const activeStatus = TABS[activeTabIndex];
  const [agentId, setAgentId] = useState(agentIdFromQuery);
  const [appliedAgentId, setAppliedAgentId] = useState(agentIdFromQuery);
  const [approvals, setApprovals] = useState<ApprovalSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null);

  const loadQueue = async () => {
    setListLoading(true);
    setListError(null);
    try {
      const response = await listApprovals({
        statusFilter: activeStatus,
        agentId: appliedAgentId,
        limit: 50,
      });
      setApprovals(response.approvals);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Unable to load approvals.");
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, [activeTabIndex, appliedAgentId]);

  useEffect(() => {
    setAgentId(agentIdFromQuery);
    setAppliedAgentId(agentIdFromQuery);
  }, [agentIdFromQuery]);

  useEffect(() => {
    if (sessionIdFromQuery) {
      setSelectedApprovalId(sessionIdFromQuery);
      onOpen();
    }
  }, [sessionIdFromQuery, onOpen]);

  const openApproval = (sessionId: string) => {
    setSelectedApprovalId(sessionId);
    onOpen();
  };

  const clearFilter = () => {
    setAgentId("");
    setAppliedAgentId("");
    setSearchParams({});
  };

  const approvalColumns = [
    {
      key: "session",
      header: "Session",
      render: (approval: ApprovalSummary) => (
        <VStack align="start" spacing={1}>
          <Text fontWeight="700">{approval.session_id}</Text>
          <Text color="text.secondary" fontSize="sm">
            Agent {approval.agent_id}
          </Text>
        </VStack>
      ),
    },
    {
      key: "tool",
      header: "Type",
      render: (approval: ApprovalSummary) => (
        <VStack align="start" spacing={1}>
          <Text fontWeight="700">{approval.approval_type || "Policy Approval"}</Text>
          <Text color="text.secondary" fontSize="sm">
            {approval.tool_name}
          </Text>
        </VStack>
      ),
    },
    {
      key: "requested",
      header: "Requested",
      render: (approval: ApprovalSummary) => (
        <Text color="text.secondary">{formatDateTime(approval.requested_at)}</Text>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (approval: ApprovalSummary) => <SessionStatusBadge status={approval.status} />,
    },
    {
      key: "risk",
      header: "Risk",
      render: (approval: ApprovalSummary) => <RiskBadge risk={approval.risk_level} />,
    },
  ];

  return (
    <VStack align="stretch" spacing={7}>
      <PageHeader
        title="Approvals"
        description="Review pending decisions, resolve tool-call checkpoints, and keep the operator trail calm and auditable."
        actions={
          <Button variant="outline" onClick={() => void loadQueue()}>
            Refresh queue
          </Button>
        }
      />

      <FilterBar>
        <VStack align="start" spacing={1} minW="220px">
          <Text fontSize="sm" fontWeight="700" color="text.secondary">
            Agent ID
          </Text>
          <Input
            value={agentId}
            onChange={(event) => setAgentId(event.target.value)}
            placeholder="Filter queue by agent"
          />
        </VStack>
        <Button
          onClick={() => {
            const trimmedAgentId = agentId.trim();
            setAppliedAgentId(trimmedAgentId);
            if (trimmedAgentId) {
              setSearchParams({ agentId: trimmedAgentId });
              return;
            }
            setSearchParams({});
          }}
        >
          Apply
        </Button>
        <Button
          variant="ghost"
          onClick={clearFilter}
        >
          Clear
        </Button>
      </FilterBar>

      <Tabs index={activeTabIndex} onChange={setActiveTabIndex} colorScheme="blue" variant="soft-rounded">
        <TabList>
          <Tab>Pending</Tab>
          <Tab>Approved</Tab>
          <Tab>Denied</Tab>
        </TabList>
        <TabPanels pt={5}>
          {TABS.map((status) => (
            <TabPanel key={status} px={0}>
              <VStack align="stretch" spacing={4}>
                {listLoading ? <LoadingPanel label="Loading approvals..." /> : null}
                {listError ? (
                  <ErrorPanel message={listError} actionLabel="Retry" onAction={() => void loadQueue()} />
                ) : null}
                <DataTable
                  rows={approvals}
                  rowKey={(item) => item.session_id}
                  onRowClick={(item) => openApproval(item.session_id)}
                  emptyMessage="No approvals found for this status."
                  columns={approvalColumns}
                />
              </VStack>
            </TabPanel>
          ))}
        </TabPanels>
      </Tabs>

      <ApprovalDetailModal
        approvalId={selectedApprovalId}
        isOpen={isOpen}
        onClose={onClose}
        onApprovalUpdated={loadQueue}
      />
    </VStack>
  );
};
