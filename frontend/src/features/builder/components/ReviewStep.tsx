import { Code, HStack, Text, VStack } from "@chakra-ui/react";
import { Button } from "../../../components/ui/Button";
import { FormSection } from "../../../components/ui/FormSection";
import { KeyValueList } from "../../../components/ui/KeyValueList";
import { Surface } from "../../../components/ui/Surface";
import { BuilderDraft, ToolOption } from "../types";

type ReviewStepProps = {
  draft: BuilderDraft;
  tools: ToolOption[];
};

export const ReviewStep = ({ draft, tools }: ReviewStepProps) => {
  const selectedTools = tools.filter((tool) => draft.selectedToolIds.includes(tool.id));

  const exportPayload = {
    metadata: draft.metadata,
    tools: selectedTools.map((tool) => ({ id: tool.id, name: tool.name })),
    policy: {
      frequency_limit:
        draft.policy.frequencyLimit.trim().length > 0
          ? Number(draft.policy.frequencyLimit)
          : null,
      require_approval_for_all_tool_calls:
        draft.policy.requireApprovalForAllToolCalls,
    },
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(exportPayload, null, 2));
  };

  return (
    <VStack align="stretch" spacing={4}>
      <FormSection title="Metadata summary">
        <KeyValueList
          items={[
            { label: "Name", value: draft.metadata.name || "-" },
            { label: "Model", value: draft.metadata.model || "-" },
            { label: "Description", value: draft.metadata.description || "-" },
            { label: "Purpose", value: draft.metadata.purpose || "-" },
          ]}
        />
      </FormSection>

      <FormSection title="Selected tools">
        <VStack align="stretch" spacing={2}>
          {selectedTools.length > 0 ? (
            selectedTools.map((tool) => (
              <Surface key={tool.id} p={3}>
                <HStack justify="space-between" align="start">
                  <VStack align="start" spacing={1}>
                    <Text fontWeight="600">{tool.name}</Text>
                    <Text color="text.secondary" fontSize="sm">
                      {tool.description}
                    </Text>
                  </VStack>
                  <Text fontSize="sm" color="text.muted">
                    ID {tool.id}
                  </Text>
                </HStack>
              </Surface>
            ))
          ) : (
            <Text color="text.secondary">No tools selected.</Text>
          )}
        </VStack>
      </FormSection>

      <FormSection title="Policy summary">
        <KeyValueList
          items={[
            {
              label: "Frequency limit",
              value: draft.policy.frequencyLimit.trim().length
                ? draft.policy.frequencyLimit
                : "None",
            },
            {
              label: "Approval for all tool calls",
              value: draft.policy.requireApprovalForAllToolCalls ? "Enabled" : "Disabled",
            },
          ]}
        />
      </FormSection>

      <FormSection title="Export preview" description="This payload can be used for audits or reproducible setup.">
        <VStack align="stretch" spacing={3}>
          <Code
            p={4}
            borderRadius="md"
            border="1px solid"
            borderColor="border.soft"
            bg="bg.surfaceMuted"
            fontSize="sm"
            whiteSpace="pre"
            overflowX="auto"
            display="block"
          >
            {JSON.stringify(exportPayload, null, 2)}
          </Code>
          <HStack justify="end">
            <Button size="sm" variant="outline" onClick={handleCopy}>
              Copy JSON
            </Button>
          </HStack>
        </VStack>
      </FormSection>
    </VStack>
  );
};
