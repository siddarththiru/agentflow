import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import { StatusType } from "../../types/status";
import { StatusBadge } from "./StatusBadge";
import { Surface } from "./Surface";

export type ActivityItem = {
  id: string;
  title: string;
  meta: string;
  timestamp: string;
  status: StatusType;
};

type ActivityListProps = {
  items: ActivityItem[];
};

export const ActivityList = ({ items }: ActivityListProps) => {
  return (
    <VStack align="stretch" spacing={3}>
      {items.map((item) => (
        <Surface key={item.id} p={4}>
          <HStack justify="space-between" align="start" spacing={3}>
            <VStack align="start" spacing={1}>
              <Text fontWeight="600">{item.title}</Text>
              <Text color="text.secondary" fontSize="sm">
                {item.meta}
              </Text>
              <Box>
                <Text color="text.muted" fontSize="xs">
                  {item.timestamp}
                </Text>
              </Box>
            </VStack>
            <StatusBadge status={item.status} label={item.status} />
          </HStack>
        </Surface>
      ))}
    </VStack>
  );
};
