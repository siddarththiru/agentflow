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
  Text,
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
import { HorizontalTimeline } from "../../components/operations/HorizontalTimeline";
import { formatDateTime } from "../../lib/format";
import { getSessionDetail, getSessionTimeline } from "./api";

type SessionDetail = {
  session_id: string;
  agent_id: number;
  status: string;
  created_at: string;
  last_updated: string;
  latest_classification?: {
    risk_level?: string | null;
    confidence?: number | null;
    timestamp?: string | null;
  } | null;
  approval?: {
    id: number;
    status: string;
    tool_name?: string | null;
    requested_at?: string | null;
    decided_at?: string | null;
    decided_by?: string | null;
  } | null;
};

type SessionEvent = {
  timestamp: string;
  event_type: string;
  metadata: Record<string, unknown>;
};

interface SessionDetailModalProps {
  sessionId: string | null;
  isOpen: boolean;
  onClose: () => void;
  size?: string;
  onOpenApproval?: (sessionId: string) => void;
  onOpenInvestigation?: (sessionId: string) => void;
  onResume?: () => void;
}

export const SessionDetailModal = ({
  sessionId,
  isOpen,
  onClose,
  size = "2xl",
  onOpenApproval,
  onOpenInvestigation,
  onResume,
}: SessionDetailModalProps) => {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [events, setEvents] = useState<SessionEvent[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !sessionId) {
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [detailResponse, timelineResponse] = await Promise.all([
          getSessionDetail(sessionId),
          getSessionTimeline(sessionId),
        ]);
        setDetail(detailResponse);
        setEvents(timelineResponse.events);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load session details.");
        setDetail(null);
        setEvents(null);
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [isOpen, sessionId]);

  const handleResume = async () => {
    if (onResume) {
      await onResume();
      // Reload the data after resume
      if (sessionId) {
        try {
          const [detailResponse, timelineResponse] = await Promise.all([
            getSessionDetail(sessionId),
            getSessionTimeline(sessionId),
          ]);
          setDetail(detailResponse);
          setEvents(timelineResponse.events);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unable to reload session details.");
        }
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size={size} scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent bg="bg.surface" border="1px" borderColor="border.soft" boxShadow="floating" maxW="60vw">
        {isLoading ? (
          <>
            <ModalHeader>Loading...</ModalHeader>
            <ModalBody>
              <LoadingPanel label="Loading session details..." />
            </ModalBody>
          </>
        ) : error ? (
          <>
            <ModalHeader>Error</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <ErrorPanel title="Unable to load session" message={error} />
            </ModalBody>
          </>
        ) : detail ? (
          <>
            <ModalHeader fontSize="lg" fontWeight="700">
              Session {detail.session_id}
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
              <VStack align="stretch" spacing={4}>
                <HStack align="stretch" spacing={4}>
                  <DetailCard
                    title={`Session ${detail.session_id}`}
                    subtitle={`Agent ${detail.agent_id}`}
                    actions={
                      <HStack>
                        <SessionStatusBadge status={detail.status} />
                      </HStack>
                    }
                  >
                    <MetadataList
                      items={[
                        { label: "Session ID", value: detail.session_id },
                        { label: "Agent ID", value: String(detail.agent_id) },
                        { label: "Created", value: formatDateTime(detail.created_at) },
                        { label: "Updated", value: formatDateTime(detail.last_updated) },
                      ]}
                    />
                  </DetailCard>

                  <DetailCard
                    title="Signals"
                    subtitle="Classification and approval context for this session"
                  >
                  <VStack align="stretch" spacing={3}>
                    <MetadataList
                      items={[
                        {
                          label: "Latest classification",
                          value: detail.latest_classification?.risk_level
                            ? String(detail.latest_classification.risk_level)
                            : "Not available",
                        },
                        {
                          label: "Confidence",
                          value:
                            detail.latest_classification?.confidence !== undefined &&
                            detail.latest_classification?.confidence !== null
                              ? String(detail.latest_classification.confidence)
                              : "-",
                        },
                        {
                          label: "Classification timestamp",
                          value: formatDateTime(
                            detail.latest_classification?.timestamp || null
                          ),
                        },
                        {
                          label: "Approval status",
                          value: detail.approval
                            ? detail.approval.status
                            : "No approval record",
                        },
                        {
                          label: "Approval tool",
                          value: detail.approval?.tool_name || "-",
                        },
                        {
                          label: "Approval decided by",
                          value: detail.approval?.decided_by || "-",
                        },
                      ]}
                    />
                    {detail.latest_classification?.risk_level ? (
                      <RiskBadge risk={detail.latest_classification.risk_level} />
                    ) : null}
                  </VStack>
                </DetailCard>
                </HStack>

                <HStack spacing={3} flexWrap="wrap">
                  {onOpenApproval && detail.approval ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onOpenApproval(detail.session_id)}
                    >
                      Open approval record
                    </Button>
                  ) : null}
                  {onOpenInvestigation ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onOpenInvestigation(detail.session_id)}
                    >
                      Open in investigation
                    </Button>
                  ) : null}
                  {detail.status === "paused" && onResume ? (
                    <Button size="sm" onClick={handleResume}>
                      Resume session
                    </Button>
                  ) : null}
                </HStack>

                {events && events.length > 0 ? (
                  <DetailCard
                    title="Timeline"
                    subtitle="Chronological session trace (scroll horizontally)"
                  >
                    <HorizontalTimeline events={events} />
                  </DetailCard>
                ) : (
                  <DetailCard title="Timeline" subtitle="Chronological session trace">
                    <EmptyPanel
                      title="No events captured"
                      description="This session does not yet have a detailed event trail."
                    />
                  </DetailCard>
                )}
              </VStack>
            </ModalBody>
          </>
        ) : (
          <>
            <ModalHeader>No Session Selected</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <EmptyPanel
                title="No session selected"
                description="Select a session to view its details."
              />
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
