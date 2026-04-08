import {
  Grid,
  GridItem,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { ChangeEvent } from "react";
import { FormSection } from "../../../components/ui/FormSection";
import { SelectionCard } from "../../../components/ui/SelectionCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { ToolOption } from "../types";

type ToolsStepProps = {
  tools: ToolOption[];
  selectedToolIds: number[];
  search: string;
  isLoading: boolean;
  error: string | null;
  onSearchChange: (value: string) => void;
  onToggleTool: (toolId: number) => void;
};

export const ToolsStep = ({
  tools,
  selectedToolIds,
  search,
  isLoading,
  error,
  onSearchChange,
  onToggleTool,
}: ToolsStepProps) => {
  const filteredTools = tools.filter((tool) => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return (
      tool.name.toLowerCase().includes(query) ||
      tool.description.toLowerCase().includes(query)
    );
  });

  return (
    <FormSection
      title="Tool access"
      description="Select the tools this agent can call. Unusable tools are shown for visibility but cannot be selected."
    >
      <VStack align="stretch" spacing={4}>
        <HStack justify="space-between" align="center" flexWrap="wrap">
          <InputGroup maxW="420px" bg="bg.surface">
            <InputLeftElement pointerEvents="none">
              <Text color="text.muted">/</Text>
            </InputLeftElement>
            <Input
              value={search}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                onSearchChange(event.target.value)
              }
              placeholder="Search tools"
            />
          </InputGroup>
          <Text color="text.secondary" fontSize="sm">
            {selectedToolIds.length} selected
          </Text>
        </HStack>

        {isLoading ? (
          <HStack py={10} justify="center">
            <Spinner color="brand.500" />
            <Text color="text.secondary">Loading tools...</Text>
          </HStack>
        ) : null}

        {!isLoading && error ? (
          <Text color="status.warning" fontSize="sm">
            {error}
          </Text>
        ) : null}

        {!isLoading && filteredTools.length === 0 ? (
          <Text color="text.secondary">No tools match your search.</Text>
        ) : null}

        {!isLoading ? (
          <Grid templateColumns={{ base: "1fr", xl: "1fr 1fr" }} gap={3}>
            {filteredTools.map((tool) => {
              const selected = selectedToolIds.includes(tool.id);
              return (
                <GridItem key={tool.id}>
                  <SelectionCard
                    title={tool.name}
                    description={tool.description}
                    selected={selected}
                    disabled={!tool.usable}
                    onSelect={() => onToggleTool(tool.id)}
                    meta={
                      <StatusBadge
                        status={tool.usable ? "success" : "pending"}
                        label={tool.usable ? "Usable" : "Disabled"}
                      />
                    }
                  />
                </GridItem>
              );
            })}
          </Grid>
        ) : null}
      </VStack>
    </FormSection>
  );
};
