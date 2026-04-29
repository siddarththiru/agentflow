import { Accordion, Button, HStack, Text, VStack } from "@chakra-ui/react";
import { DetailCard } from "./DetailCard";
import { EmptyPanel } from "./EmptyPanel";
import { LoadingPanel } from "./LoadingPanel";
import { MetadataList } from "./MetadataList";
import { RiskBadge } from "./RiskBadge";
import { SessionStatusBadge } from "./SessionStatusBadge";
import { TimelineEvent } from "./TimelineEvent";
import { formatDateTime } from "../../lib/format";

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

type SessionDetailPanelProps = {
  detail?: SessionDetail | null;
  events?: SessionEvent[] | null;
  isLoading?: boolean;
  error?: string | null;
  onOpenApproval?: (sessionId: string) => void;
  onResume?: () => void;
  showTimeline?: boolean;
};

export const SessionDetailPanel = ({
  detail,
  events,
  isLoading,
  error,
  onOpenApproval,
  onResume,
  showTimeline = true,
}: SessionDetailPanelProps) => {
  if (isLoading) {
    return <LoadingPanel label="Loading session detail..." />;
  }

  if (error) {
    return <EmptyPanel title="Session detail unavailable" description={error} />;
  }

  if (!detail) {
    return (
      <EmptyPanel
        title="Select a session"
        description="Choose a session from the list to inspect its status, classification summary, approval state, and event trace."
      />
    );
  }

  return (
    <VStack align="stretch" spacing={4}>
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

      <DetailCard title="Signals" subtitle="Classification and approval context for this session">
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
                value: formatDateTime(detail.latest_classification?.timestamp || null),
              },
              {
                label: "Approval status",
                value: detail.approval ? detail.approval.status : "No approval record",
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

      <HStack spacing={3} flexWrap="wrap">
        {onOpenApproval && detail.approval ? (
          <Button size="sm" variant="outline" onClick={() => onOpenApproval(detail.session_id)}>
            Open approval record
          </Button>
        ) : null}

        {detail.status === "paused" && onResume ? (
          <Button size="sm" onClick={onResume}>
            Resume session
          </Button>
        ) : null}
      </HStack>

      {showTimeline ? (
        <DetailCard title="Timeline" subtitle="Chronological session trace">
          {events && events.length > 0 ? (
            <Accordion allowMultiple>
              {events.map((event, index) => (
                <TimelineEvent key={`${event.timestamp}-${index}`} event={event} />
              ))}
            </Accordion>
          ) : (
            <EmptyPanel
              title="No events captured"
              description="This session does not yet have a detailed event trail."
            />
          )}
        </DetailCard>
      ) : null}
    </VStack>
  );
};
