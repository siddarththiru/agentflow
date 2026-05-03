import {
  Box,
  Grid,
  GridItem,
  HStack,
  Input,
  Select,
  Switch,
  Text,
  VStack,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { DetailCard } from "../../components/operations/DetailCard";
import { EmptyPanel } from "../../components/operations/EmptyPanel";
import { ErrorPanel } from "../../components/operations/ErrorPanel";
import { FilterBar } from "../../components/operations/FilterBar";
 
import { LoadingPanel } from "../../components/operations/LoadingPanel";
import { ToolHealthBadge } from "../../components/operations/ToolHealthBadge";
import { ToolSchemaEditor } from "../../components/operations/ToolSchemaEditor";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { listTools, setToolUsable } from "./api";
import { ToolRecord } from "./types";
import { ToolDetailModal } from "./ToolDetailModal";
import { ToolRegisterModal } from "./ToolRegisterModal";

const defaultInputSchema = JSON.stringify(
  {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Input query for the tool",
      },
    },
    required: ["query"],
  },
  null,
  2
);

const defaultOutputSchema = JSON.stringify(
  {
    type: "object",
    properties: {
      result: {
        type: "string",
      },
    },
    required: ["result"],
  },
  null,
  2
);

export const ToolsPage = () => {
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isRegisterOpen, onOpen: onOpenRegister, onClose: onCloseRegister } = useDisclosure();

  const [tools, setTools] = useState<ToolRecord[]>([]);
  const [selectedToolId, setSelectedToolId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [usableFilter, setUsableFilter] = useState("");

  

  const loadTools = async () => {
    setListLoading(true);
    setListError(null);
    try {
      const response = await listTools();
      setTools(response);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Unable to load tools.");
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    void loadTools();
  }, []);

  const filteredTools = useMemo(
    () =>
      tools.filter((tool) => {
        const searchOk =
          search.trim().length === 0 ||
          tool.name.toLowerCase().includes(search.trim().toLowerCase()) ||
          tool.description.toLowerCase().includes(search.trim().toLowerCase());

        const usableOk =
          usableFilter === ""
            ? true
            : usableFilter === "usable"
            ? tool.usable
            : !tool.usable;

        return searchOk && usableOk;
      }),
    [tools, search, usableFilter]
  );

  const handleToggle = async (toolId: number, usable: boolean) => {
    setTogglingId(toolId);
    try {
      const updated = await setToolUsable(toolId, usable);
      setTools((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
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
        description: err instanceof Error ? err.message : "Unable to update tool usability.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setTogglingId(null);
    }
  };
  

  return (
    <VStack align="stretch" spacing={7}>
      <PageHeader
        title="Tools"
        description="Manage tool catalog health, validate schemas, and register new adapters for controlled runtime usage."
        actions={
          <HStack>
            <Button variant="outline" onClick={() => void loadTools()}>
              Refresh tools
            </Button>
            <Button colorScheme="brand" onClick={onOpenRegister}>
              Register tool
            </Button>
          </HStack>
        }
      />

      <FilterBar>
        <VStack align="start" spacing={1} minW="360px">
          <Text fontSize="sm" fontWeight="700" color="text.secondary">
            Search
          </Text>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or description"
          />
        </VStack>
        <VStack align="start" spacing={1} minW="180px">
          <Text fontSize="sm" fontWeight="700" color="text.secondary">
            Usability
          </Text>
          <Select value={usableFilter} onChange={(event) => setUsableFilter(event.target.value)}>
            <option value="">All</option>
            <option value="usable">Usable</option>
            <option value="disabled">Disabled</option>
          </Select>
        </VStack>
        <Button
          variant="ghost"
          onClick={() => {
            setSearch("");
            setUsableFilter("");
          }}
        >
          Clear
        </Button>
      </FilterBar>

      <VStack align="stretch" spacing={4}>
        {listLoading ? <LoadingPanel label="Loading tools..." /> : null}
        {listError ? (
          <ErrorPanel message={listError} actionLabel="Retry" onAction={() => void loadTools()} />
        ) : null}
        {!listLoading && filteredTools.length === 0 ? (
          <EmptyPanel
            title="No tools match current filters"
            description="Change search or usability filters to inspect the full catalog."
          />
        ) : null}
        {!listLoading && filteredTools.length > 0 ? (
          <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }} gap={4}>
            {filteredTools.map((tool) => (
              <GridItem key={tool.id}>
                <Box
                  borderWidth={1}
                  borderColor="border.default"
                  borderRadius="md"
                  padding={4}
                  transition="all 0.2s"
                  _hover={{ boxShadow: "md", cursor: "pointer" }}
                  onClick={() => {
                    setSelectedToolId(tool.id);
                    onOpen();
                  }}
                >
                  <VStack align="stretch" spacing={3}>
                    <VStack align="start" spacing={2}>
                      <Text fontWeight="700" fontSize="md">
                        {tool.name}
                      </Text>
                      <Text color="text.secondary" fontSize="sm">
                        {tool.description}
                      </Text>
                    </VStack>

                    <HStack justify="space-between" align="center" pt={2}>
                      <ToolHealthBadge usable={tool.usable} />
                      <HStack onClick={(e) => e.stopPropagation()} spacing={2}>
                        <Text color="text.secondary" fontSize="sm">
                          Usable
                        </Text>
                        <Switch
                          colorScheme="brand"
                          isChecked={tool.usable}
                          onChange={(event) => void handleToggle(tool.id, event.target.checked)}
                          isDisabled={togglingId === tool.id}
                        />
                      </HStack>
                    </HStack>

                    <Text fontSize="xs" color="text.secondary">
                      ID: {tool.id}
                    </Text>
                  </VStack>
                </Box>
              </GridItem>
            ))}
          </Grid>
        ) : null}
      </VStack>

      <ToolDetailModal
        isOpen={isOpen}
        onClose={onClose}
        toolId={selectedToolId}
        onToolUpdated={(updatedTool) => {
          setTools((prev) => prev.map((t) => (t.id === updatedTool.id ? updatedTool : t)));
        }}
      />

      <ToolRegisterModal
        isOpen={isRegisterOpen}
        onClose={onCloseRegister}
        onCreated={(created) => {
          void loadTools();
          setSelectedToolId(created.id);
        }}
      />
    </VStack>
  );
};
