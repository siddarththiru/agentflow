import {
  Box,
  Code,
  HStack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { StatusType } from "../../types/status";
import { formatCompactDateTime, titleCase } from "../../lib/format";
import { StatusBadge } from "../ui/StatusBadge";

type TimelineEvent = {
  event_type: string;
  timestamp: string;
  metadata: Record<string, unknown>;
};

type HorizontalTimelineProps = {
  events: TimelineEvent[];
};

const toneForEvent = (eventType: string): StatusType => {
  const normalized = eventType.toLowerCase();
  if (normalized.includes("threat") || normalized.includes("deny") || normalized.includes("block")) {
    return "warning";
  }
  if (normalized.includes("error") || normalized.includes("fail") || normalized.includes("terminate")) {
    return "danger";
  }
  if (normalized.includes("approval")) {
    return "pending";
  }
  return "info";
};

export const HorizontalTimeline = ({ events }: HorizontalTimelineProps) => {
  if (!events || events.length === 0) {
    return null;
  }

  return (
    <Box overflowX="auto" pb={2}>
      <HStack align="stretch" spacing={3} minW="max-content" pb={2}>
        {events.map((event, index) => {
          const entries = Object.entries(event.metadata || {});
          return (
            <Box
              key={`${event.timestamp}-${index}`}
              minW="320px"
              maxW="320px"
              border="1px solid"
              borderColor="border.soft"
              borderRadius="md"
              p={4}
              bg="bg.surfaceMuted"
              _hover={{ bg: "bg.surface", boxShadow: "sm" }}
              transition="all 0.2s"
            >
              <VStack align="stretch" spacing={3} h="100%">
                <VStack align="start" spacing={1}>
                  <Text fontWeight="700" fontSize="sm">
                    {titleCase(event.event_type)}
                  </Text>
                  <Text color="text.muted" fontSize="xs">
                    {formatCompactDateTime(event.timestamp)}
                  </Text>
                </VStack>

                <StatusBadge
                  status={toneForEvent(event.event_type)}
                  label={titleCase(event.event_type)}
                />

                {entries.length > 0 ? (
                  <VStack align="stretch" spacing={2} fontSize="xs">
                    {entries.map(([key, value]) => (
                      <VStack key={key} align="start" spacing={1}>
                        <Text color="text.secondary" fontWeight="600">
                          {titleCase(key)}
                        </Text>
                        <Code
                          whiteSpace="pre-wrap"
                          display="block"
                          bg="bg.surface"
                          p={2}
                          borderRadius="sm"
                          w="100%"
                          overflowX="auto"
                          fontSize="xs"
                        >
                          {typeof value === "string"
                            ? value
                            : JSON.stringify(value, null, 2)}
                        </Code>
                      </VStack>
                    ))}
                  </VStack>
                ) : (
                  <Text color="text.secondary" fontSize="xs">
                    No metadata
                  </Text>
                )}
              </VStack>
            </Box>
          );
        })}
      </HStack>
    </Box>
  );
};
