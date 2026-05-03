import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  VStack,
  HStack,
  Button,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DetailCard } from "../../components/operations/DetailCard";
import { EmptyPanel } from "../../components/operations/EmptyPanel";
import { ErrorPanel } from "../../components/operations/ErrorPanel";
import { LoadingPanel } from "../../components/operations/LoadingPanel";
import { MetadataList } from "../../components/operations/MetadataList";
import { RiskBadge } from "../../components/operations/RiskBadge";
import { SessionStatusBadge } from "../../components/operations/SessionStatusBadge";
import { ApprovalDecisionDialog, ApprovalDecisionIntent } from "../../components/operations/ApprovalDecisionDialog";
import { formatDateTime } from "../../lib/format";
import { getApproval, approveSession, denySession } from "./api";
import { resumeAgent } from "../sessions/api";
import { ApprovalDetail } from "./types";

interface ApprovalDetailModalProps {
  approvalId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onApprovalUpdated?: () => void;
}

export const ApprovalDetailModal = ({
  approvalId,
  isOpen,
  onClose,
  onApprovalUpdated,
}: ApprovalDetailModalProps) => {
  const navigate = useNavigate();
  const toast = useToast();
  const [detail, setDetail] = useState<ApprovalDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogIntent, setDialogIntent] = useState<ApprovalDecisionIntent | null>(null);
  const [dialogSubmitting, setDialogSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !approvalId) {
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getApproval(approvalId);
        setDetail(data);
      } catch (err) {
        setDetail(null);
        setError(
          err instanceof Error ? err.message : "Unable to load approval details."
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [isOpen, approvalId]);

  const handleOpenSession = () => {
    if (!detail) {
      return;
    }
    navigate(`/sessions?sessionId=${detail.session_id}`);
    onClose();
  };

  const submitDecision = async (payload: {
    decidedBy: string;
    reason: string;
    resumeAfterApproval: boolean;
  }) => {
    if (!detail || !dialogIntent) {
      return;
    }

    setDialogSubmitting(true);
    try {
      if (dialogIntent === "approve") {
        await approveSession(detail.session_id, {
          decidedBy: payload.decidedBy,
          reason: payload.reason,
        });
        if (payload.resumeAfterApproval) {
          await resumeAgent(detail.session_id);
        }
        toast({
          title: "Approval recorded",
          description: payload.resumeAfterApproval
            ? `Session ${detail.session_id} was approved and resumed.`
            : `Session ${detail.session_id} was approved.`,
          status: "success",
          duration: 4000,
          isClosable: true,
        });
      } else {
        await denySession(detail.session_id, {
          decidedBy: payload.decidedBy,
          reason: payload.reason,
        });
        toast({
          title: "Approval denied",
          description: `Session ${detail.session_id} was denied.`,
          status: "warning",
          duration: 4000,
          isClosable: true,
        });
      }

      if (onApprovalUpdated) {
        await onApprovalUpdated();
      }
      setDialogIntent(null);
      onClose();
    } catch (err) {
      toast({
        title: "Decision failed",
        description: err instanceof Error ? err.message : "Unable to process approval.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setDialogSubmitting(false);
    }
  };

  const showInitialLoading = isLoading && !detail;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent bg="bg.surface" border="1px" borderColor="border.soft" boxShadow="floating" maxW="60vw">
          {showInitialLoading ? (
            <>
              <ModalHeader>Loading approval</ModalHeader>
              <ModalBody>
                <LoadingPanel label="Loading approval details..." />
              </ModalBody>
            </>
          ) : error ? (
            <>
              <ModalHeader>Error</ModalHeader>
              <ModalCloseButton />
              <ModalBody>
                <ErrorPanel 
                  title="Unable to load approval" 
                  message={error} 
                  actionLabel="Retry" 
                  onAction={() => {
                    if (approvalId) {
                      void (async () => {
                        setIsLoading(true);
                        setError(null);
                        try {
                          const data = await getApproval(approvalId);
                          setDetail(data);
                        } catch (err) {
                          setDetail(null);
                          setError(
                            err instanceof Error ? err.message : "Unable to load approval details."
                          );
                        } finally {
                          setIsLoading(false);
                        }
                      })();
                    }
                  }}
                />
              </ModalBody>
            </>
          ) : detail ? (
            <>
              <ModalHeader fontSize="lg" fontWeight="700">
                Approval for {detail.tool_name}
              </ModalHeader>
              <ModalCloseButton />
              <ModalBody pb={6}>
                <VStack align="stretch" spacing={4}>
                  <DetailCard
                    title={detail.approval_type || "Policy Approval"}
                    subtitle={`Session ${detail.session_id}`}
                    actions={
                      <HStack>
                        <SessionStatusBadge status={detail.status} />
                        <RiskBadge risk={detail.risk_level} />
                      </HStack>
                    }
                  >
                    <MetadataList
                      items={[
                        { label: "Session ID", value: detail.session_id },
                        { label: "Agent ID", value: String(detail.agent_id) },
                        { label: "Tool", value: detail.tool_name },
                        { label: "Requested", value: formatDateTime(detail.requested_at) },
                        { label: "Decided at", value: formatDateTime(detail.decided_at || null) },
                        { label: "Decided by", value: detail.decided_by || "-" },
                        { label: "Reason", value: detail.decision_reason || "-" },
                      ]}
                    />
                  </DetailCard>

                  <HStack spacing={3} flexWrap="wrap">
                    <Button
                      colorScheme="green"
                      onClick={() => setDialogIntent("approve")}
                      isDisabled={detail.status !== "pending"}
                    >
                      Approve
                    </Button>
                    <Button
                      colorScheme="red"
                      onClick={() => setDialogIntent("deny")}
                      isDisabled={detail.status !== "pending"}
                    >
                      Deny
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={handleOpenSession}
                    >
                      Open session
                    </Button>
                  </HStack>
                </VStack>
              </ModalBody>
            </>
          ) : (
            <>
              <ModalHeader>No Approval Selected</ModalHeader>
              <ModalCloseButton />
              <ModalBody>
                <EmptyPanel
                  title="No approval selected"
                  description="Select an approval to view its details."
                />
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>

      <ApprovalDecisionDialog
        isOpen={Boolean(dialogIntent)}
        intent={dialogIntent || "approve"}
        sessionId={detail?.session_id}
        isSubmitting={dialogSubmitting}
        onClose={() => setDialogIntent(null)}
        onConfirm={submitDecision}
      />
    </>
  );
};
