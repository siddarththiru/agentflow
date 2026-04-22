import { Box, Divider, Text, VStack } from "@chakra-ui/react";
import { Handle, NodeProps, Position } from "reactflow";
import { StatusType } from "../../types/status";
import { StatusBadge } from "../ui/StatusBadge";

export type TimelineField = {
  label: string;
  value: string;
};

export type TimelineNodeData = {
  title: string;
  subtitle?: string;
  timestamp?: string;
  summaryFields: TimelineField[];
  tone: StatusType;
  categoryLabel: string;
  allowsIncoming?: boolean;
  allowsOutgoing?: boolean;
};

const FlowNodeFrame = ({
  data,
  selected,
}: {
  data: TimelineNodeData;
  selected: boolean;
}) => {
  const showIncoming = data.allowsIncoming !== false;
  const showOutgoing = data.allowsOutgoing !== false;

  return (
    <>
      {showIncoming ? (
        <Handle
          type="target"
          position={Position.Left}
          style={{
            width: 10,
            height: 10,
            borderRadius: 99,
            border: "1px solid #cdd5e1",
            background: "#ffffff",
          }}
        />
      ) : null}

      <Box
        minW="240px"
        maxW="280px"
        p={3}
        border="1px solid"
        borderColor={selected ? "accent.primary" : "border.soft"}
        borderRadius="md"
        bg={selected ? "brand.50" : "bg.surface"}
        boxShadow={selected ? "floating" : "card"}
        transition="all 180ms ease"
      >
        <VStack align="stretch" spacing={2}>
          <Text fontSize="xs" color="text.muted" fontWeight="600" textTransform="uppercase">
            {data.categoryLabel}
          </Text>
          <Text fontSize="sm" fontWeight="700" color="text.primary" lineHeight="1.3">
            {data.title}
          </Text>

          {data.subtitle ? (
            <Text fontSize="xs" color="text.secondary" lineHeight="1.4">
              {data.subtitle}
            </Text>
          ) : null}

          <StatusBadge status={data.tone} label={data.timestamp ? `Logged ${data.timestamp}` : "Logged"} />

          {data.summaryFields.length > 0 ? (
            <VStack align="stretch" spacing={1}>
              <Divider borderColor="border.soft" />
              {data.summaryFields.map((field) => (
                <Box key={`${field.label}-${field.value}`}>
                  <Text fontSize="xs" color="text.muted" fontWeight="600">
                    {field.label}
                  </Text>
                  <Text fontSize="xs" color="text.primary" noOfLines={2}>
                    {field.value}
                  </Text>
                </Box>
              ))}
            </VStack>
          ) : null}
        </VStack>
      </Box>

      {showOutgoing ? (
        <Handle
          type="source"
          position={Position.Right}
          style={{
            width: 10,
            height: 10,
            borderRadius: 99,
            border: "1px solid #cdd5e1",
            background: "#ffffff",
          }}
        />
      ) : null}
    </>
  );
};

export const StepNode = ({ data, selected }: NodeProps<TimelineNodeData>) => (
  <FlowNodeFrame data={data} selected={selected} />
);

export const DecisionNode = ({ data, selected }: NodeProps<TimelineNodeData>) => (
  <FlowNodeFrame data={data} selected={selected} />
);

export const AlertNode = ({ data, selected }: NodeProps<TimelineNodeData>) => (
  <FlowNodeFrame data={data} selected={selected} />
);

export const ToolNode = ({ data, selected }: NodeProps<TimelineNodeData>) => (
  <FlowNodeFrame data={data} selected={selected} />
);

export const StartEndNode = ({ data, selected }: NodeProps<TimelineNodeData>) => (
  <FlowNodeFrame data={data} selected={selected} />
);

export const timelineNodeTypes = {
  step: StepNode,
  decision: DecisionNode,
  alert: AlertNode,
  tool: ToolNode,
  startEnd: StartEndNode,
};
