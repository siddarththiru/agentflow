import {
  Grid,
  GridItem,
  HStack,
  Input,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApprovalDecisionDialog, ApprovalDecisionIntent } from "../../components/operations/ApprovalDecisionDialog";
import { DataTable } from "../../components/operations/DataTable";
import { DetailCard } from "../../components/operations/DetailCard";
import { ErrorPanel } from "../../components/operations/ErrorPanel";
import { FilterBar } from "../../components/operations/FilterBar";
import { LoadingPanel } from "../../components/operations/LoadingPanel";
import { MetadataList } from "../../components/operations/MetadataList";
import { RiskBadge } from "../../components/operations/RiskBadge";
import { SessionStatusBadge } from "../../components/operations/SessionStatusBadge";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { formatDateTime } from "../../lib/format";
import { resumeAgent } from "../sessions/api";
import { approveSession, denySession, getApproval, listApprovals } from "./api";
import { ApprovalDetail, ApprovalSummary } from "./types";

const TABS = ["pending", "approved", "denied"] as const;

export const ApprovalsPage = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSessionId = searchParams.get("sessionId") || "";
  const agentIdFromQuery = searchParams.get("agentId") || "";

  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const activeStatus = TABS[activeTabIndex];
  const [agentId, setAgentId] = useState(agentIdFromQuery);
  const [appliedAgentId, setAppliedAgentId] = useState(agentIdFromQuery);
  const [approvals, setApprovals] = useState<ApprovalSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedDetail, setSelectedDetail] = useState<ApprovalDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [dialogIntent, setDialogIntent] = useState<ApprovalDecisionIntent | null>(null);
  const [dialogSubmitting, setDialogSubmitting] = useState(false);
  const [dialogSessionId, setDialogSessionId] = useState<string | undefined>();

  const selectedSummary = useMemo(
    () => approvals.find((approval) => approval.session_id === selectedSessionId),
    [approvals, selectedSessionId]
  );

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

  const loadDetail = async (sessionId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await getApproval(sessionId);
      setSelectedDetail(detail);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Unable to load approval detail.");
      setSelectedDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, [activeTabIndex, appliedAgentId]);

  useEffect(() => {
    if (!selectedSessionId) {
      setSelectedDetail(null);
      setDetailError(null);
      return;
    }
    void loadDetail(selectedSessionId);
  }, [selectedSessionId]);

  useEffect(() => {
    setAgentId(agentIdFromQuery);
    setAppliedAgentId(agentIdFromQuery);
  }, [agentIdFromQuery]);

  const openApproval = (sessionId: string) => {
    const next = new URLSearchParams();
    next.set("sessionId", sessionId);
    if (appliedAgentId.trim()) {
      next.set("agentId", appliedAgentId.trim());
    }
    setSearchParams(next);
  };

  const clearSelection = () => {
    if (appliedAgentId.trim()) {
      setSearchParams({ agentId: appliedAgentId.trim() });
      return;
    }
    setSearchParams({});
  };

  const openDecisionDialog = (intent: ApprovalDecisionIntent) => {
    if (!selectedSessionId) {
      return;
    }
    setDialogIntent(intent);
    setDialogSessionId(selectedSessionId);
  };

  const submitDecision = async (payload: {
    decidedBy: string;
    reason: string;
    resumeAfterApproval: boolean;
  }) => {
    if (!dialogSessionId || !dialogIntent) {
      return;
    }

    setDialogSubmitting(true);
    try {
      if (dialogIntent === "approve") {
        await approveSession(dialogSessionId, {
          decidedBy: payload.decidedBy,
          reason: payload.reason,
        });
        if (payload.resumeAfterApproval) {
          await resumeAgent(dialogSessionId);
        }
        toast({
          title: "Approval recorded",
          description: payload.resumeAfterApproval
            ? `Session ${dialogSessionId} was approved and resumed.`
            : `Session ${dialogSessionId} was approved.`,
          status: "success",
          duration: 4000,
          isClosable: true,
        });
      } else {
        await denySession(dialogSessionId, {
          decidedBy: payload.decidedBy,
          reason: payload.reason,
        });
        toast({
          title: "Approval denied",
          description: `Session ${dialogSessionId} was denied.`,
          status: "warning",
          duration: 4000,
          isClosable: true,
        });
      }

      await loadQueue();
      await loadDetail(dialogSessionId);
    } catch (error) {
      toast({
        title: "Decision failed",
        description: error instanceof Error ? error.message : "Unable to process approval.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setDialogSubmitting(false);
      setDialogIntent(null);
      setDialogSessionId(undefined);
    }
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
      header: "Tool",
      render: (approval: ApprovalSummary) => <Text>{approval.tool_name}</Text>,
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
            if (selectedSessionId) {
              const next = new URLSearchParams();
              next.set("sessionId", selectedSessionId);
              if (trimmedAgentId) {
                next.set("agentId", trimmedAgentId);
              }
              setSearchParams(next);
              return;
            }
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
          onClick={() => {
            setAgentId("");
            setAppliedAgentId("");
            if (selectedSessionId) {
              setSearchParams({ sessionId: selectedSessionId });
              return;
            }
            setSearchParams({});
          }}
        >
          Clear
        </Button>
        {selectedSessionId ? (
          <Button variant="ghost" onClick={clearSelection}>
            Clear selection
          </Button>
        ) : null}
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
              <Grid templateColumns={{ base: "1fr", xl: "1.25fr 0.85fr" }} gap={5} alignItems="start">
                <GridItem>
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
                </GridItem>

                <GridItem>
                  <VStack
                    align="stretch"
                    spacing={4}
                    position={{ base: "static", xl: "sticky" }}
                    top={{ base: "auto", xl: "92px" }}
                  >
                    <DetailCard
                      title="Approval details"
                      subtitle="Decision context and audit trail"
                      actions={selectedDetail ? <SessionStatusBadge status={selectedDetail.status} /> : null}
                    >
                      {detailLoading ? (
                        <LoadingPanel label="Loading approval detail..." />
                      ) : detailError ? (
                        <ErrorPanel message={detailError} />
                      ) : selectedDetail ? (
                        <VStack align="stretch" spacing={4}>
                          <MetadataList
                            items={[
                              { label: "Session ID", value: selectedDetail.session_id },
                              { label: "Agent ID", value: String(selectedDetail.agent_id) },
                              { label: "Tool", value: selectedDetail.tool_name },
                              { label: "Requested", value: formatDateTime(selectedDetail.requested_at) },
                              { label: "Decided at", value: formatDateTime(selectedDetail.decided_at || null) },
                              { label: "Decided by", value: selectedDetail.decided_by || "-" },
                              { label: "Reason", value: selectedDetail.decision_reason || "-" },
                            ]}
                          />
                          <RiskBadge risk={selectedDetail.risk_level} />
                          <HStack spacing={3} flexWrap="wrap">
                            <Button
                              onClick={() => openDecisionDialog("approve")}
                              isDisabled={selectedDetail.status !== "pending"}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => openDecisionDialog("deny")}
                              isDisabled={selectedDetail.status !== "pending"}
                            >
                              Deny
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => navigate(`/sessions?sessionId=${selectedDetail.session_id}`)}
                            >
                              Open session
                            </Button>
                          </HStack>
                        </VStack>
                      ) : (
                        <Text color="text.secondary">Select an approval from the queue to inspect it.</Text>
                      )}
                    </DetailCard>
                    {selectedSummary && !selectedDetail ? (
                      <Text color="text.secondary">Selected session {selectedSummary.session_id} is available in the current list.</Text>
                    ) : null}
                  </VStack>
                </GridItem>
              </Grid>
            </TabPanel>
          ))}
        </TabPanels>
      </Tabs>

      <ApprovalDecisionDialog
        isOpen={Boolean(dialogIntent)}
        intent={dialogIntent || "approve"}
        sessionId={dialogSessionId}
        isSubmitting={dialogSubmitting}
        onClose={() => {
          setDialogIntent(null);
          setDialogSessionId(undefined);
        }}
        onConfirm={submitDecision}
      />
    </VStack>
  );
};
