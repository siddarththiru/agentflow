import { HStack, Text, VStack } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { formatDateTime } from "../../lib/format";
import { Button } from "../ui/Button";
import { StatusBadge } from "../ui/StatusBadge";
import { Surface } from "../ui/Surface";

export type AlertFeedItem = {
  id: string;
  title: string;
  description: string;
  type: string;
  severity: "success" | "pending" | "warning" | "danger" | "info";
  timestamp?: string;
  sessionId?: string;
  agentId?: number;
  route?: string;
};

type AlertFeedProps = {
  items: AlertFeedItem[];
  dismissedIds?: string[];
  onDismiss?: (id: string) => void;
};

export const AlertFeed = ({ items, dismissedIds = [], onDismiss }: AlertFeedProps) => {
  const visibleItems = items.filter((item) => !dismissedIds.includes(item.id));

  return (
    <VStack align="stretch" spacing={3}>
      {visibleItems.map((item) => (
        <Surface key={item.id} p={4}>
          <VStack align="stretch" spacing={2}>
            <HStack justify="space-between" align="start" spacing={3}>
              <VStack align="start" spacing={1}>
                <Text fontWeight="700">{item.title}</Text>
                <Text color="text.secondary" fontSize="sm">
                  {item.description}
                </Text>
              </VStack>
              <StatusBadge status={item.severity} label={item.type} />
            </HStack>
            <HStack justify="space-between" align="center" flexWrap="wrap">
              <HStack spacing={3} flexWrap="wrap">
                <Text color="text.muted" fontSize="xs">
                  {formatDateTime(item.timestamp || null)}
                </Text>
                {item.sessionId ? (
                  <Text color="text.muted" fontSize="xs">
                    Session {item.sessionId}
                  </Text>
                ) : null}
                {item.agentId !== undefined ? (
                  <Text color="text.muted" fontSize="xs">
                    Agent {item.agentId}
                  </Text>
                ) : null}
              </HStack>
              <HStack spacing={3}>
                {item.route ? (
                  <Text as={RouterLink} to={item.route} color="brand.600" fontSize="sm" fontWeight="600">
                    Open
                  </Text>
                ) : null}
                {onDismiss ? (
                  <Button size="sm" variant="ghost" onClick={() => onDismiss(item.id)}>
                    Dismiss
                  </Button>
                ) : null}
              </HStack>
            </HStack>
          </VStack>
        </Surface>
      ))}
    </VStack>
  );
};
