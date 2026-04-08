import { HStack, Text, VStack } from "@chakra-ui/react";
import { StatusType } from "../../types/status";
import { StatusBadge } from "./StatusBadge";
import { Surface } from "./Surface";

export type AlertListItem = {
  id: string;
  title: string;
  detail: string;
  category: string;
  status: StatusType;
};

type AlertListProps = {
  items: AlertListItem[];
};

export const AlertList = ({ items }: AlertListProps) => {
  return (
    <VStack align="stretch" spacing={3}>
      {items.map((item) => (
        <Surface key={item.id} p={4}>
          <VStack align="stretch" spacing={3}>
            <HStack justify="space-between" align="start">
              <Text fontWeight="600">{item.title}</Text>
              <StatusBadge status={item.status} label={item.status} />
            </HStack>
            <Text color="text.secondary" fontSize="sm">
              {item.detail}
            </Text>
            <Text color="text.muted" fontSize="xs" textTransform="uppercase" letterSpacing="0.08em">
              {item.category}
            </Text>
          </VStack>
        </Surface>
      ))}
    </VStack>
  );
};
