import {
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Switch,
  Text,
  Textarea,
  VStack,
  useToast,
  Grid,
  GridItem,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { DetailCard } from "../../components/operations/DetailCard";
import { ErrorPanel } from "../../components/operations/ErrorPanel";
import { LoadingPanel } from "../../components/operations/LoadingPanel";
import { MetadataList } from "../../components/operations/MetadataList";
import { ToolHealthBadge } from "../../components/operations/ToolHealthBadge";
import { getTool, setToolUsable } from "./api";
import { ToolRecord } from "./types";

interface ToolDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  toolId: number | null;
  onToolUpdated?: (tool: ToolRecord) => void;
}

export const ToolDetailModal = ({
  isOpen,
  onClose,
  toolId,
  onToolUpdated,
}: ToolDetailModalProps) => {
  const toast = useToast();

  const [tool, setTool] = useState<ToolRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    if (!isOpen || !toolId) {
      setTool(null);
      setError(null);
      return;
    }

    const loadToolDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const detail = await getTool(toolId);
        setTool(detail);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load tool detail.");
        setTool(null);
      } finally {
        setLoading(false);
      }
    };

    void loadToolDetail();
  }, [isOpen, toolId]);

  const handleToggleUsable = async (usable: boolean) => {
    if (!tool) return;

    setIsToggling(true);
    try {
      const updated = await setToolUsable(tool.id, usable);
      setTool(updated);
      onToolUpdated?.(updated);
      toast({
        title: "Tool state updated",
        description: `${updated.name} is now ${updated.usable ? "usable" : "disabled"}.`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      toast({
        title: "Update failed",
        description:
          err instanceof Error ? err.message : "Unable to update tool usability.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Tool Details</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack align="stretch" spacing={4}>
            {loading ? <LoadingPanel label="Loading tool detail..." /> : null}
            {error ? <ErrorPanel message={error} /> : null}
            {tool ? (
              <>
                <MetadataList
                  items={[
                    { label: "Tool ID", value: String(tool.id) },
                    { label: "Name", value: tool.name },
                    { label: "Description", value: tool.description },
                  ]}
                />
                <HStack justify="space-between" align="center">
                  <ToolHealthBadge usable={tool.usable} />
                  <HStack>
                    <Text color="text.secondary" fontSize="sm">
                      Usable
                    </Text>
                    <Switch
                      colorScheme="brand"
                      isChecked={tool.usable}
                      onChange={(event) => void handleToggleUsable(event.target.checked)}
                      isDisabled={isToggling}
                    />
                  </HStack>
                </HStack>
                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
                  <GridItem>
                    <VStack align="stretch" spacing={2}>
                      <Text fontSize="sm" fontWeight="700" color="text.secondary">
                        Input Schema
                      </Text>
                      <Textarea
                        value={tool.input_schema}
                        readOnly
                        minH="100px"
                        fontSize="sm"
                        fontFamily="mono"
                      />
                    </VStack>
                  </GridItem>
                  <GridItem>
                    <VStack align="stretch" spacing={2}>
                      <Text fontSize="sm" fontWeight="700" color="text.secondary">
                        Output Schema
                      </Text>
                      <Textarea
                        value={tool.output_schema}
                        readOnly
                        minH="100px"
                        fontSize="sm"
                        fontFamily="mono"
                      />
                    </VStack>
                  </GridItem>
                </Grid>
              </>
            ) : !loading ? (
              <Text color="text.secondary">Unable to load tool.</Text>
            ) : null}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
