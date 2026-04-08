import { HStack, Text, VStack } from "@chakra-ui/react";
import { ReactNode } from "react";
import { StatusType } from "../../types/status";
import { StatusBadge } from "./StatusBadge";
import { Surface } from "./Surface";

type MetricCardProps = {
  label: string;
  value: string;
  meta: string;
  status: StatusType;
  statusLabel: string;
  icon: ReactNode;
};

export const MetricCard = ({
  label,
  value,
  meta,
  status,
  statusLabel,
  icon,
}: MetricCardProps) => {
  return (
    <Surface p={5}>
      <VStack align="stretch" spacing={3}>
        <HStack justify="space-between">
          <Text fontSize="sm" color="text.secondary" fontWeight="600">
            {label}
          </Text>
          <StatusBadge status={status} label={statusLabel} />
        </HStack>

        <HStack justify="space-between" align="end">
          <VStack align="start" spacing={1}>
            <Text fontSize="3xl" lineHeight={1.1} fontWeight="700" letterSpacing="-0.02em">
              {value}
            </Text>
            <Text color="text.muted" fontSize="sm">
              {meta}
            </Text>
          </VStack>
          {icon}
        </HStack>
      </VStack>
    </Surface>
  );
};
