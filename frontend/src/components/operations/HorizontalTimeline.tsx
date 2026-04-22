import {
  Box,
  Code,
  Divider,
  HStack,
  Switch,
  Text,
  useColorModeValue,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  Edge,
  MarkerType,
  Node,
  NodeMouseHandler,
} from "reactflow";
import "reactflow/dist/style.css";
import { StatusType } from "../../types/status";
import { formatCompactDateTime, titleCase } from "../../lib/format";
import { TimelineNodeData, timelineNodeTypes } from "./TimelineFlowNodes";

type TimelineEvent = {
  event_type: string;
  timestamp: string;
  metadata: Record<string, unknown>;
};

type HorizontalTimelineProps = {
  events: TimelineEvent[];
};

type TimelineNodeKind = "main" | "context" | "fallback";

type TimelineFlowNodeData = TimelineNodeData & {
  eventType: string;
  rawMetadata: Record<string, unknown>;
  mainOrder: number;
  kind: TimelineNodeKind;
};

type TimelineFlowEdgeData = {
  kind: "main" | "context";
  toMainOrder: number;
};

const eventTitleMap: Record<string, string> = {
  session_start: "Session opened",
  session_end: "Session closed",
  node_transition: "Workflow shift",
  tool_call: "Tool requested",
  tool_call_attempt: "Tool attempt",
  tool_call_result: "Tool completed",
  tool_result: "Tool completed",
  enforcement_decision: "Policy decision",
  approval_requested: "Approval requested",
  approval_decision: "Approval recorded",
  threat_classification: "Risk evaluation",
  runtime_error: "Runtime issue",
};

const keyLabelMap: Record<string, string> = {
  from: "Previous stage",
  to: "Next stage",
  reason: "Decision reason",
  decided_by: "Reviewed by",
  risk_level: "Risk level",
  confidence: "Confidence",
  explanation: "Evaluation summary",
  intent: "Detected intent",
  analysis_window: "Review window",
  tool_name: "Tool",
  tool: "Tool",
  tool_id: "Tool ID",
  status: "Outcome",
  duration_ms: "Response time (ms)",
  output_type: "Result type",
  params_provided: "Input attached",
  interception: "Safety check",
  decision: "Decision",
  policy_id: "Policy reference",
  timestamp: "Logged at",
  error: "Error",
};

const nodeTypeForEvent = (eventType: string): keyof typeof timelineNodeTypes => {
  const normalized = eventType.toLowerCase();
  if (normalized.includes("session_start") || normalized.includes("session_end")) {
    return "startEnd";
  }
  if (normalized.includes("approval") || normalized.includes("decision")) {
    return "decision";
  }
  if (normalized.includes("threat") || normalized.includes("error") || normalized.includes("deny") || normalized.includes("block")) {
    return "alert";
  }
  if (normalized.includes("tool")) {
    return "tool";
  }
  return "step";
};

const friendlyEventTitle = (eventType: string): string =>
  eventTitleMap[eventType] || titleCase(eventType);

const labelForKey = (key: string): string => keyLabelMap[key] || titleCase(key);

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
};

const summaryFieldsForEvent = (event: TimelineEvent): { label: string; value: string }[] => {
  const metadata = event.metadata || {};
  const eventType = event.event_type;

  if (eventType === "node_transition") {
    return [
      { label: "Previous stage", value: formatValue(metadata.from) },
      { label: "Next stage", value: formatValue(metadata.to) },
      ...(metadata.reason ? [{ label: "Decision reason", value: formatValue(metadata.reason) }] : []),
    ];
  }

  if (eventType.includes("approval") || eventType.includes("decision")) {
    return [
      ...(metadata.decision ? [{ label: "Decision", value: formatValue(metadata.decision) }] : []),
      ...(metadata.reason ? [{ label: "Decision reason", value: formatValue(metadata.reason) }] : []),
      ...(metadata.decided_by ? [{ label: "Reviewed by", value: formatValue(metadata.decided_by) }] : []),
    ].slice(0, 3);
  }

  if (eventType.includes("threat") || eventType.includes("error")) {
    return [
      ...(metadata.risk_level ? [{ label: "Risk level", value: formatValue(metadata.risk_level) }] : []),
      ...(metadata.confidence !== undefined ? [{ label: "Confidence", value: formatValue(metadata.confidence) }] : []),
      ...(metadata.explanation ? [{ label: "Evaluation summary", value: formatValue(metadata.explanation) }] : []),
      ...(metadata.error ? [{ label: "Error", value: formatValue(metadata.error) }] : []),
    ].slice(0, 3);
  }

  if (eventType.includes("tool")) {
    return [
      { label: "Tool", value: formatValue(metadata.tool_name || metadata.tool || "-") },
      ...(metadata.status ? [{ label: "Outcome", value: formatValue(metadata.status) }] : []),
      ...(metadata.duration_ms !== undefined
        ? [{ label: "Response time (ms)", value: formatValue(metadata.duration_ms) }]
        : []),
      ...(metadata.params_provided !== undefined
        ? [{ label: "Input attached", value: formatValue(metadata.params_provided) }]
        : []),
    ].slice(0, 3);
  }

  const entries = Object.entries(metadata).slice(0, 3);
  return entries.map(([key, value]) => ({
    label: labelForKey(key),
    value: formatValue(value),
  }));
};

const buildTimelineFlow = (
  events: TimelineEvent[]
): {
  nodes: Node<TimelineFlowNodeData>[];
  edges: Edge<TimelineFlowEdgeData>[];
} => {
  if (events.length === 0) {
    return { nodes: [], edges: [] };
  }

  const transitions = events.filter((event) => event.event_type === "node_transition");
  if (transitions.length === 0) {
    const fallbackNode: Node<TimelineFlowNodeData> = {
      id: "fallback-summary",
      type: "step",
      position: { x: 120, y: 120 },
      data: {
        categoryLabel: "Session summary",
        title: "No stage changes were recorded",
        subtitle: "You can still review supporting events below.",
        timestamp: formatCompactDateTime(events[0]?.timestamp),
        tone: "info",
        summaryFields: [
          { label: "Captured events", value: String(events.length) },
          {
            label: "Event categories",
            value: Array.from(new Set(events.map((event) => friendlyEventTitle(event.event_type)))).join(", "),
          },
        ],
        eventType: "session_summary",
        rawMetadata: {},
        mainOrder: 0,
        kind: "fallback",
        allowsIncoming: false,
        allowsOutgoing: false,
      },
    };

    return { nodes: [fallbackNode], edges: [] };
  }

  const nodes: Node<TimelineFlowNodeData>[] = [];
  const edges: Edge<TimelineFlowEdgeData>[] = [];
  const mainNodeIdByOrder = new Map<number, string>();
  const contextCountByOrder = new Map<number, number>();

  let mainOrder = 0;
  let currentMainOrder = 0;
  const startEvent = events.find((event) => event.event_type === "session_start") || events[0];

  const startNodeId = "main-start";
  nodes.push({
    id: startNodeId,
    type: "startEnd",
    position: { x: 40, y: 90 },
    data: {
      categoryLabel: "Start",
      title: "Session opened",
      subtitle: "Workflow monitoring began.",
      timestamp: formatCompactDateTime(startEvent?.timestamp),
      tone: "info",
      summaryFields: [],
      eventType: "session_start",
      rawMetadata: startEvent?.metadata || {},
      mainOrder,
      kind: "main",
      allowsIncoming: false,
      allowsOutgoing: true,
    },
  });
  mainNodeIdByOrder.set(mainOrder, startNodeId);

  events.forEach((event) => {
    if (event.event_type === "session_start") {
      return;
    }

    if (event.event_type === "node_transition") {
      mainOrder += 1;
      currentMainOrder = mainOrder;
      const id = `main-${mainOrder}`;
      const fromValue = formatValue(event.metadata?.from);
      const toValue = formatValue(event.metadata?.to);

      nodes.push({
        id,
        type: "step",
        position: { x: 40 + mainOrder * 300, y: 90 },
        data: {
          categoryLabel: "Workflow step",
          title: toValue !== "-" ? toValue : "Stage update",
          subtitle: fromValue !== "-" ? `Moved from ${fromValue}` : "A new stage was entered.",
          timestamp: formatCompactDateTime(event.timestamp),
          tone: toneForEvent(event.event_type),
          summaryFields: summaryFieldsForEvent(event),
          eventType: event.event_type,
          rawMetadata: event.metadata || {},
          mainOrder,
          kind: "main",
          allowsIncoming: true,
          allowsOutgoing: true,
        },
      });
      mainNodeIdByOrder.set(mainOrder, id);

      const previousNodeId = mainNodeIdByOrder.get(mainOrder - 1);
      if (previousNodeId) {
        edges.push({
          id: `edge-main-${mainOrder - 1}-${mainOrder}`,
          source: previousNodeId,
          target: id,
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed },
          data: { kind: "main", toMainOrder: mainOrder },
          style: { stroke: "#cdd5e1", strokeWidth: 2 },
        });
      }
      return;
    }

    if (event.event_type === "session_end") {
      return;
    }

    const anchorOrder = currentMainOrder;
    const anchorNodeId = mainNodeIdByOrder.get(anchorOrder) || startNodeId;
    const contextIndex = contextCountByOrder.get(anchorOrder) || 0;
    contextCountByOrder.set(anchorOrder, contextIndex + 1);

    const contextNodeId = `context-${anchorOrder}-${contextIndex}`;
    nodes.push({
      id: contextNodeId,
      type: nodeTypeForEvent(event.event_type),
      position: {
        x: 40 + anchorOrder * 300,
        y: 270 + contextIndex * 180,
      },
      data: {
        categoryLabel: friendlyEventTitle(event.event_type),
        title: friendlyEventTitle(event.event_type),
        subtitle: "Supporting session activity",
        timestamp: formatCompactDateTime(event.timestamp),
        tone: toneForEvent(event.event_type),
        summaryFields: summaryFieldsForEvent(event),
        eventType: event.event_type,
        rawMetadata: event.metadata || {},
        mainOrder: anchorOrder,
        kind: "context",
        allowsIncoming: true,
        allowsOutgoing: false,
      },
    });

    edges.push({
      id: `edge-context-${anchorOrder}-${contextIndex}`,
      source: anchorNodeId,
      target: contextNodeId,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { kind: "context", toMainOrder: anchorOrder },
      style: { stroke: "#c7d0db", strokeDasharray: "6 4", strokeWidth: 1.5 },
    });
  });

  const endEvent = [...events].reverse().find((event) => event.event_type === "session_end");
  if (endEvent) {
    const endOrder = mainOrder + 1;
    const endNodeId = `main-end-${endOrder}`;
    nodes.push({
      id: endNodeId,
      type: "startEnd",
      position: { x: 40 + endOrder * 300, y: 90 },
      data: {
        categoryLabel: "End",
        title: "Session closed",
        subtitle: "The workflow run completed.",
        timestamp: formatCompactDateTime(endEvent.timestamp),
        tone: toneForEvent(endEvent.event_type),
        summaryFields: summaryFieldsForEvent(endEvent),
        eventType: endEvent.event_type,
        rawMetadata: endEvent.metadata || {},
        mainOrder: endOrder,
        kind: "main",
        allowsIncoming: true,
        allowsOutgoing: false,
      },
    });

    const previousNodeId = mainNodeIdByOrder.get(mainOrder);
    if (previousNodeId) {
      edges.push({
        id: `edge-main-${mainOrder}-${endOrder}`,
        source: previousNodeId,
        target: endNodeId,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
        data: { kind: "main", toMainOrder: endOrder },
        style: { stroke: "#cdd5e1", strokeWidth: 2 },
      });
    }
  }

  return { nodes, edges };
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
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showAllFields, setShowAllFields] = useState(false);

  const { nodes, edges } = useMemo(() => buildTimelineFlow(events), [events]);

  useEffect(() => {
    if (!nodes.length) {
      setSelectedNodeId(null);
      return;
    }
    if (!selectedNodeId || !nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(nodes[0].id);
    }
  }, [nodes, selectedNodeId]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  const selectedOrder = selectedNode?.data.mainOrder ?? -1;
  const edgeColor = useColorModeValue("#8ca9ff", "#8ca9ff");

  const styledEdges = useMemo(
    () =>
      edges.map((edge) => {
        const data = edge.data as TimelineFlowEdgeData | undefined;
        const isHighlighted =
          selectedOrder >= 0
            ? data?.kind === "main"
              ? data.toMainOrder <= selectedOrder
              : edge.source === selectedNodeId || edge.target === selectedNodeId
            : false;

        return {
          ...edge,
          animated: isHighlighted,
          style: {
            ...(edge.style || {}),
            stroke: isHighlighted ? edgeColor : (edge.style?.stroke as string) || "#cdd5e1",
            strokeWidth: isHighlighted ? 2.5 : edge.style?.strokeWidth || 2,
          },
        };
      }),
    [edgeColor, edges, selectedNodeId, selectedOrder]
  );

  const onNodeClick: NodeMouseHandler = (_, node) => {
    setSelectedNodeId(node.id);
  };

  const detailEntries = useMemo(() => {
    if (!selectedNode) {
      return [];
    }

    const metadataEntries = Object.entries(selectedNode.data.rawMetadata || {});
    const compactEntries = selectedNode.data.summaryFields.map((field) => [field.label, field.value]);
    const sourceEntries = showAllFields ? metadataEntries : compactEntries;

    return sourceEntries.map(([key, value]) => ({
      label: showAllFields ? labelForKey(key) : key,
      value: typeof value === "string" ? value : JSON.stringify(value, null, 2),
    }));
  }, [selectedNode, showAllFields]);

  if (!events || events.length === 0) {
    return null;
  }

  return (
    <VStack align="stretch" spacing={3}>
      <Box h="500px" w="100%" border="1px solid" borderColor="border.soft" borderRadius="md" overflow="hidden" bg="bg.surfaceMuted">
        <ReactFlow
          nodes={nodes}
          edges={styledEdges}
          nodeTypes={timelineNodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.5}
          maxZoom={1.6}
          onNodeClick={onNodeClick}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#e4e8ef" gap={22} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </Box>

      <Box border="1px solid" borderColor="border.soft" borderRadius="md" p={3} bg="bg.surface">
        <VStack align="stretch" spacing={3}>
          <HStack justify="space-between" align="center">
            <VStack align="start" spacing={0}>
              <Text fontWeight="700" fontSize="sm">
                Step details
              </Text>
              <Text color="text.muted" fontSize="xs">
                Select any node to inspect supporting details.
              </Text>
            </VStack>
            <HStack spacing={2}>
              <Text fontSize="xs" color="text.secondary" fontWeight="600">
                Show all fields
              </Text>
              <Switch
                size="sm"
                isChecked={showAllFields}
                onChange={(event) => setShowAllFields(event.target.checked)}
              />
            </HStack>
          </HStack>

          <Divider borderColor="border.soft" />

          {selectedNode ? (
            <VStack align="stretch" spacing={2}>
              <Text fontSize="sm" fontWeight="700" color="text.primary">
                {selectedNode.data.title}
              </Text>
              <Text fontSize="xs" color="text.secondary">
                {selectedNode.data.subtitle || friendlyEventTitle(selectedNode.data.eventType)}
              </Text>

              {detailEntries.length > 0 ? (
                <VStack align="stretch" spacing={2}>
                  {detailEntries.map((entry) => (
                    <Box key={`${entry.label}-${entry.value}`}>
                      <Text color="text.secondary" fontSize="xs" fontWeight="600">
                        {entry.label}
                      </Text>
                      <Code
                        whiteSpace="pre-wrap"
                        display="block"
                        bg="bg.surfaceMuted"
                        p={2}
                        borderRadius="sm"
                        w="100%"
                        overflowX="auto"
                        fontSize="xs"
                      >
                        {entry.value}
                      </Code>
                    </Box>
                  ))}
                </VStack>
              ) : (
                <Text color="text.secondary" fontSize="xs">
                  No details available for this step.
                </Text>
              )}
            </VStack>
          ) : (
            <Text color="text.secondary" fontSize="xs">
              Select a step to see details.
            </Text>
          )}
        </VStack>
      </Box>
    </VStack>
  );
};
