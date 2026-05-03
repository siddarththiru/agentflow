import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Box,
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
import { SessionStatusBadge } from "../../components/operations/SessionStatusBadge";
import { HorizontalTimeline } from "../../components/operations/HorizontalTimeline";
import { formatDateTime } from "../../lib/format";
import { getSessionDetail, getSessionTimeline } from "./api";

type SessionDetail = Awaited<ReturnType<typeof getSessionDetail>>;

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
  onResume?: () => void;
}

export const SessionDetailModal = ({
  sessionId,
  isOpen,
  onClose,
  size = "2xl",
  onOpenApproval,
  onResume,
}: SessionDetailModalProps) => {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [events, setEvents] = useState<SessionEvent[] | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !sessionId) {
      return;
    }

    const loadData = async () => {
      setIsLoadingDetail(true);
      setIsLoadingTimeline(true);
      setDetailError(null);
      setTimelineError(null);

      const [detailResult, timelineResult] = await Promise.allSettled([
        getSessionDetail(sessionId),
        getSessionTimeline(sessionId),
      ]);

      if (detailResult.status === "fulfilled") {
        setDetail(detailResult.value);
      } else {
        setDetail(null);
        setDetailError(
          detailResult.reason instanceof Error
            ? detailResult.reason.message
            : "Unable to load session details."
        );
      }

      if (timelineResult.status === "fulfilled") {
        setEvents(timelineResult.value.events);
      } else {
        setEvents(null);
        setTimelineError(
          timelineResult.reason instanceof Error
            ? timelineResult.reason.message
            : "Unable to load session timeline."
        );
      }

      setIsLoadingDetail(false);
      setIsLoadingTimeline(false);
    };

    void loadData();
  }, [isOpen, sessionId]);

  const handleResume = async () => {
    if (onResume) {
      await onResume();
      if (sessionId) {
        try {
          setIsLoadingDetail(true);
          setIsLoadingTimeline(true);
          setDetailError(null);
          setTimelineError(null);
          const [detailResponse, timelineResponse] = await Promise.all([
            getSessionDetail(sessionId),
            getSessionTimeline(sessionId),
          ]);
          setDetail(detailResponse);
          setEvents(timelineResponse.events);
        } catch (err) {
          setDetailError(err instanceof Error ? err.message : "Unable to reload session details.");
        } finally {
          setIsLoadingDetail(false);
          setIsLoadingTimeline(false);
        }
      }
    }
  };

  const openChat = () => {
    if (!detail) {
      return;
    }
    navigate(`/agents/${detail.agent_id}/chat?sessionId=${detail.session_id}`);
  };

  const openApprovals = () => {
    if (!detail) {
      return;
    }
    if (onOpenApproval) {
      onOpenApproval(detail.session_id);
      return;
    }
    navigate(`/approvals?sessionId=${detail.session_id}`);
  };

  const showInitialLoading = isLoadingDetail && !detail;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size={size} scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent bg="bg.surface" border="1px" borderColor="border.soft" boxShadow="floating" maxW="60vw">
        {showInitialLoading ? (
          <>
            <ModalHeader>Loading session</ModalHeader>
            <ModalBody>
              <LoadingPanel label="Loading session details..." />
            </ModalBody>
          </>
        ) : detailError ? (
          <>
            <ModalHeader>Error</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <ErrorPanel title="Unable to load session" message={detailError} actionLabel="Retry" onAction={() => {
                if (sessionId) {
                  void (async () => {
                    setIsLoadingDetail(true);
                    setIsLoadingTimeline(true);
                    setDetailError(null);
                    setTimelineError(null);
                    try {
                      const [detailResponse, timelineResponse] = await Promise.all([
                        getSessionDetail(sessionId),
                        getSessionTimeline(sessionId),
                      ]);
                      setDetail(detailResponse);
                      setEvents(timelineResponse.events);
                    } catch (err) {
                      setDetailError(err instanceof Error ? err.message : "Unable to reload session details.");
                    } finally {
                      setIsLoadingDetail(false);
                      setIsLoadingTimeline(false);
                    }
                  })();
                }
              }} />
            </ModalBody>
          </>
        ) : detail ? (
          <>
            <ModalHeader fontSize="lg" fontWeight="700">
              {detail.title ? detail.title : `Session ${detail.session_id}`}
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
              <VStack align="stretch" spacing={4}>
                <HStack align="stretch" spacing={4} flexWrap="wrap">
                  <DetailCard
                    title={`Session ${detail.session_id}`}
                    subtitle={`Agent ${detail.agent_id}${detail.title ? ` · ${detail.title}` : ""}`}
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
                        { label: "Title", value: detail.title || "Untitled session" },
                        { label: "Created", value: formatDateTime(detail.created_at) },
                        { label: "Updated", value: formatDateTime(detail.last_updated) },
                        { label: "Messages", value: String(detail.messages.length) },
                      ]}
                    />
                  </DetailCard>

                  <DetailCard title="Message preview" subtitle="Most recent conversation messages">
                    <VStack align="stretch" spacing={3}>
                      {detail.messages.length > 0 ? (
                        detail.messages.slice(-3).map((message) => (
                          <Box
                            key={message.id}
                            p={3}
                            border="1px solid"
                            borderColor="border.soft"
                            borderRadius="md"
                            bg={message.role === "assistant" ? "bg.surfaceMuted" : "bg.surface"}
                          >
                            <Text fontSize="xs" color="text.muted" textTransform="uppercase" letterSpacing="0.08em">
                              {message.role}
                            </Text>
                            <Text fontSize="sm" color="text.primary" whiteSpace="pre-wrap" mt={1}>
                              {message.content}
                            </Text>
                          </Box>
                        ))
                      ) : (
                        <EmptyPanel
                          title="No messages yet"
                          description="This session has not recorded any conversation messages."
                        />
                      )}
                    </VStack>
                  </DetailCard>
                </HStack>

                <HStack spacing={3} flexWrap="wrap">
                  <Button size="sm" variant="outline" onClick={openApprovals}>
                    Open approvals
                  </Button>
                  <Button size="sm" variant="outline" onClick={openChat}>
                    Open chat
                  </Button>
                  {detail.status === "paused" && onResume ? (
                    <Button size="sm" onClick={handleResume}>
                      Resume session
                    </Button>
                  ) : null}
                </HStack>

                {timelineError ? (
                  <DetailCard title="Timeline" subtitle="Workflow map with supporting activity">
                    <ErrorPanel title="Unable to load timeline" message={timelineError} />
                  </DetailCard>
                ) : isLoadingTimeline && !events ? (
                  <DetailCard title="Timeline" subtitle="Workflow map with supporting activity">
                    <LoadingPanel label="Loading timeline..." />
                  </DetailCard>
                ) : events && events.length > 0 ? (
                  <DetailCard title="Timeline" subtitle="Workflow map with supporting activity">
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
