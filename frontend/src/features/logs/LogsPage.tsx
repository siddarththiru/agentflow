import {
  Checkbox,
  CheckboxGroup,
  Code,
  Grid,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  VStack,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { DataTable } from "../../components/operations/DataTable";
import { EmptyPanel } from "../../components/operations/EmptyPanel";
import { ErrorPanel } from "../../components/operations/ErrorPanel";
import { FilterBar } from "../../components/operations/FilterBar";
import { LoadingPanel } from "../../components/operations/LoadingPanel";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { downloadCsv, downloadJson } from "../../lib/export";
import { formatCompactDateTime, formatDateTime, titleCase } from "../../lib/format";
import { getLogEventTypes, getLogs, LogRecord } from "../reporting/api";

const LOG_TABS = [
  { label: "All logs", eventTypes: [] },
  { label: "Sessions", eventTypes: ["session_start", "session_end", "node_transition"] },
  {
    label: "Tools",
    eventTypes: ["tool_call", "tool_call_attempt", "tool_call_result", "tool_result"],
  },
  {
    label: "Governance",
    eventTypes: [
      "intent_guard_decision",
      "enforcement_decision",
      "approval_requested",
      "approval_decision",
    ],
  },
  { label: "Errors", eventTypes: ["runtime_error"] },
] as const;

const LOG_COLUMNS = [
  { key: "id", label: "ID" },
  { key: "session_id", label: "Session ID" },
  { key: "agent_id", label: "Agent ID" },
  { key: "event_type", label: "Event type" },
  { key: "timestamp", label: "Timestamp" },
  { key: "event_data", label: "Event data" },
] as const;

type LogColumnKey = (typeof LOG_COLUMNS)[number]["key"];

type LogFilters = {
  sessionId: string;
  agentId: string;
  eventType: string;
  fromTime: string;
  toTime: string;
};

type ExportDraft = {
  format: "json" | "csv";
  fileName: string;
  limit: string;
  columns: LogColumnKey[];
};

const defaultFilters: LogFilters = {
  sessionId: "",
  agentId: "",
  eventType: "",
  fromTime: "",
  toTime: "",
};

const toIsoFromLocalInput = (value: string): string | undefined => {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const buildDefaultFileName = (format: "json" | "csv", tabLabel: string) => {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const scope = tabLabel.toLowerCase().replace(/\s+/g, "-");
  return `agentflow-${scope}-logs-${stamp}.${format}`;
};

const projectLogRow = (log: LogRecord, columns: LogColumnKey[]) => {
  const row: Record<string, unknown> = {};
  columns.forEach((column) => {
    row[column] = log[column];
  });
  return row;
};

const sortLogsDesc = (items: LogRecord[]) =>
  [...items].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

export const LogsPage = () => {
  const toast = useToast();
  const detailDisclosure = useDisclosure();
  const exportDisclosure = useDisclosure();

  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [filters, setFilters] = useState<LogFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<LogFilters>(defaultFilters);
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<LogRecord | null>(null);
  const [exportDraft, setExportDraft] = useState<ExportDraft>({
    format: "json",
    fileName: buildDefaultFileName("json", LOG_TABS[0].label),
    limit: "300",
    columns: ["id", "session_id", "agent_id", "event_type", "timestamp", "event_data"],
  });
  const [isExporting, setIsExporting] = useState(false);

  const activeTab = LOG_TABS[activeTabIndex];
  const activeTabEventTypes = activeTab.eventTypes;
  const tabEventTypeSet = useMemo<Set<string>>(
    () => new Set(activeTabEventTypes),
    [activeTabEventTypes]
  );
  const pageNumber = Math.floor(offset / limit) + 1;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  const fetchLogsForScope = async (queryLimit: number, queryOffset: number) => {
    const sharedQuery = {
      sessionId: appliedFilters.sessionId,
      agentId: appliedFilters.agentId,
      fromTime: toIsoFromLocalInput(appliedFilters.fromTime),
      toTime: toIsoFromLocalInput(appliedFilters.toTime),
    };

    if (activeTabEventTypes.length === 0 || appliedFilters.eventType) {
      if (
        appliedFilters.eventType &&
        activeTabEventTypes.length > 0 &&
        !tabEventTypeSet.has(appliedFilters.eventType)
      ) {
        return { logs: [], total: 0 };
      }

      const response = await getLogs({
        ...sharedQuery,
        eventType: appliedFilters.eventType,
        limit: queryLimit,
        offset: queryOffset,
      });
      return { logs: response.logs, total: response.total };
    }

    const responses = await Promise.all(
      activeTabEventTypes.map((eventType) =>
        getLogs({
          ...sharedQuery,
          eventType,
          limit: 1000,
          offset: 0,
        })
      )
    );
    const combinedLogs = sortLogsDesc(responses.flatMap((response) => response.logs));
    const combinedTotal = responses.reduce((sum, response) => sum + response.total, 0);
    return {
      logs: combinedLogs.slice(queryOffset, queryOffset + queryLimit),
      total: combinedTotal,
    };
  };

  const loadLogs = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetchLogsForScope(limit, offset);
      setLogs(response.logs);
      setTotal(response.total);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load logs.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadEventTypes = async () => {
      try {
        setEventTypes(await getLogEventTypes());
      } catch {
        setEventTypes([]);
      }
    };

    void loadEventTypes();
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [activeTabIndex, appliedFilters, limit, offset]);

  const availableEventTypes = useMemo(() => {
    if (activeTabEventTypes.length === 0) {
      return eventTypes;
    }
    return eventTypes.filter((eventType) => tabEventTypeSet.has(eventType));
  }, [activeTabEventTypes.length, eventTypes, tabEventTypeSet]);

  const applyFilters = () => {
    setOffset(0);
    setAppliedFilters({ ...filters });
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setOffset(0);
  };

  const openLogDetail = (log: LogRecord) => {
    setSelectedLog(log);
    detailDisclosure.onOpen();
  };

  const openExportModal = () => {
    const format = exportDraft.format;
    setExportDraft((prev) => ({
      ...prev,
      fileName: buildDefaultFileName(format, activeTab.label),
      columns:
        format === "csv"
          ? ["id", "session_id", "agent_id", "event_type", "timestamp"]
          : ["id", "session_id", "agent_id", "event_type", "timestamp", "event_data"],
    }));
    exportDisclosure.onOpen();
  };

  const runGuidedExport = async () => {
    if (exportDraft.columns.length === 0) {
      toast({
        title: "Choose at least one column",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const exportLimit = Number(exportDraft.limit);
    if (!Number.isFinite(exportLimit) || exportLimit < 1 || exportLimit > 1000) {
      toast({
        title: "Export limit must be between 1 and 1000",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsExporting(true);
    try {
      const response = await fetchLogsForScope(exportLimit, 0);
      const rowsForExport = response.logs.map((log) => projectLogRow(log, exportDraft.columns));
      if (exportDraft.format === "json") {
        downloadJson(exportDraft.fileName || buildDefaultFileName("json", activeTab.label), {
          generated_at: new Date().toISOString(),
          tab: activeTab.label,
          filters: appliedFilters,
          count: rowsForExport.length,
          logs: rowsForExport,
        });
      } else {
        downloadCsv(
          exportDraft.fileName || buildDefaultFileName("csv", activeTab.label),
          rowsForExport,
          exportDraft.columns
        );
      }
      exportDisclosure.onClose();
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unable to export logs.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <VStack align="stretch" spacing={7}>
      <PageHeader
        title="Logs"
        description="Inspect runtime events, narrow traces by operational context, and export tailored log packages."
        actions={
          <HStack>
            <Button variant="outline" onClick={() => void loadLogs()}>
              Refresh
            </Button>
            <Button onClick={openExportModal}>Export logs</Button>
          </HStack>
        }
      />

      <Tabs
        index={activeTabIndex}
        onChange={(index) => {
          setActiveTabIndex(index);
          setOffset(0);
          setFilters((prev) => ({ ...prev, eventType: "" }));
          setAppliedFilters((prev) => ({ ...prev, eventType: "" }));
        }}
        colorScheme="brand"
      >
        <TabList overflowX="auto" overflowY="hidden">
          {LOG_TABS.map((tab) => (
            <Tab key={tab.label} whiteSpace="nowrap">
              {tab.label}
            </Tab>
          ))}
        </TabList>
        <TabPanels>
          {LOG_TABS.map((tab) => (
            <TabPanel key={tab.label} px={0} pt={5} pb={0}>
              <VStack align="stretch" spacing={5}>
                <FilterBar>
                  <VStack align="start" spacing={1} minW={{ base: "100%", md: "200px" }} flex="1 1 200px">
                    <Text fontSize="sm" fontWeight="700" color="text.secondary">
                      Session ID
                    </Text>
                    <Input
                      value={filters.sessionId}
                      onChange={(event) => setFilters((prev) => ({ ...prev, sessionId: event.target.value }))}
                      placeholder="Any session"
                    />
                  </VStack>
                  <VStack align="start" spacing={1} minW={{ base: "100%", md: "130px" }} flex="0 1 150px">
                    <Text fontSize="sm" fontWeight="700" color="text.secondary">
                      Agent ID
                    </Text>
                    <Input
                      value={filters.agentId}
                      onChange={(event) => setFilters((prev) => ({ ...prev, agentId: event.target.value }))}
                      placeholder="Any agent"
                    />
                  </VStack>
                  <VStack align="start" spacing={1} minW={{ base: "100%", md: "190px" }} flex="1 1 190px">
                    <Text fontSize="sm" fontWeight="700" color="text.secondary">
                      Event type
                    </Text>
                    <Select
                      value={filters.eventType}
                      onChange={(event) => setFilters((prev) => ({ ...prev, eventType: event.target.value }))}
                    >
                      <option value="">All in tab</option>
                      {availableEventTypes.map((eventType) => (
                        <option key={eventType} value={eventType}>
                          {titleCase(eventType)}
                        </option>
                      ))}
                    </Select>
                  </VStack>
                  <VStack align="start" spacing={1} minW={{ base: "100%", md: "190px" }} flex="1 1 190px">
                    <Text fontSize="sm" fontWeight="700" color="text.secondary">
                      From
                    </Text>
                    <Input
                      type="datetime-local"
                      value={filters.fromTime}
                      onChange={(event) => setFilters((prev) => ({ ...prev, fromTime: event.target.value }))}
                    />
                  </VStack>
                  <VStack align="start" spacing={1} minW={{ base: "100%", md: "190px" }} flex="1 1 190px">
                    <Text fontSize="sm" fontWeight="700" color="text.secondary">
                      To
                    </Text>
                    <Input
                      type="datetime-local"
                      value={filters.toTime}
                      onChange={(event) => setFilters((prev) => ({ ...prev, toTime: event.target.value }))}
                    />
                  </VStack>
                  <HStack w="100%" justify="flex-end" spacing={3}>
                    <Button onClick={applyFilters}>Apply</Button>
                    <Button variant="ghost" onClick={clearFilters}>
                      Clear
                    </Button>
                  </HStack>
                </FilterBar>

                {isLoading ? <LoadingPanel label="Loading logs..." /> : null}
                {loadError ? <ErrorPanel message={loadError} actionLabel="Retry" onAction={() => void loadLogs()} /> : null}
                {!isLoading && !loadError && logs.length === 0 ? (
                  <EmptyPanel
                    title="No logs match current filters"
                    description="Change filters or switch tabs to inspect another event category."
                  />
                ) : null}
                {!loadError && logs.length > 0 ? (
                  <DataTable
                    rows={logs}
                    rowKey={(log) => String(log.id)}
                    onRowClick={openLogDetail}
                    columns={[
                      {
                        key: "event",
                        header: "Event",
                        render: (log) => (
                          <VStack align="start" spacing={1}>
                            <Text fontWeight="700">{titleCase(log.event_type)}</Text>
                            <Text color="text.secondary" fontSize="sm">
                              Log {log.id}
                            </Text>
                          </VStack>
                        ),
                      },
                      {
                        key: "session",
                        header: "Session",
                        render: (log) => (
                          <VStack align="start" spacing={1}>
                            <Text>{log.session_id}</Text>
                            <Text color="text.secondary" fontSize="sm">
                              Agent {log.agent_id}
                            </Text>
                          </VStack>
                        ),
                      },
                      {
                        key: "timestamp",
                        header: "Timestamp",
                        render: (log) => <Text color="text.secondary">{formatCompactDateTime(log.timestamp)}</Text>,
                      },
                      {
                        key: "summary",
                        header: "Data",
                        render: (log) => (
                          <Code whiteSpace="normal" colorScheme="gray">
                            {Object.keys(log.event_data).length} fields
                          </Code>
                        ),
                      },
                    ]}
                  />
                ) : null}

                <HStack justify="space-between" flexWrap="wrap" spacing={3}>
                  <Text color="text.secondary" fontSize="sm">
                    Page {pageNumber} of {pageCount} / {total} logs
                  </Text>
                  <HStack>
                    <Select
                      size="sm"
                      value={limit}
                      onChange={(event) => {
                        setLimit(Number(event.target.value));
                        setOffset(0);
                      }}
                      w="120px"
                    >
                      <option value={25}>25 rows</option>
                      <option value={50}>50 rows</option>
                      <option value={100}>100 rows</option>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setOffset((current) => Math.max(0, current - limit))}
                      isDisabled={offset === 0 || isLoading}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setOffset((current) => current + limit)}
                      isDisabled={offset + limit >= total || isLoading}
                    >
                      Next
                    </Button>
                  </HStack>
                </HStack>
              </VStack>
            </TabPanel>
          ))}
        </TabPanels>
      </Tabs>

      <Modal isOpen={detailDisclosure.isOpen} onClose={detailDisclosure.onClose} size="3xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Log detail</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {selectedLog ? (
              <VStack align="stretch" spacing={4}>
                <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={3}>
                  <Text>
                    <b>Event:</b> {titleCase(selectedLog.event_type)}
                  </Text>
                  <Text>
                    <b>Time:</b> {formatDateTime(selectedLog.timestamp)}
                  </Text>
                  <Text>
                    <b>Session:</b> {selectedLog.session_id}
                  </Text>
                  <Text>
                    <b>Agent:</b> {selectedLog.agent_id}
                  </Text>
                </Grid>
                <Code
                  display="block"
                  whiteSpace="pre"
                  overflowX="auto"
                  maxH="420px"
                  p={4}
                  border="1px solid"
                  borderColor="border.soft"
                  borderRadius="md"
                  bg="bg.surfaceMuted"
                >
                  {JSON.stringify(selectedLog.event_data, null, 2)}
                </Code>
              </VStack>
            ) : null}
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={exportDisclosure.isOpen} onClose={exportDisclosure.onClose} size="2xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Guided export</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={5}>
              <Text color="text.secondary">
                Export starts from the current {activeTab.label.toLowerCase()} tab and applied filters.
              </Text>
              <Grid templateColumns={{ base: "1fr", md: "1fr 2fr" }} gap={4}>
                <VStack align="start" spacing={1}>
                  <Text fontSize="sm" fontWeight="700" color="text.secondary">
                    Format
                  </Text>
                  <Select
                    value={exportDraft.format}
                    onChange={(event) => {
                      const format = event.target.value as "json" | "csv";
                      setExportDraft((prev) => ({
                        ...prev,
                        format,
                        fileName: buildDefaultFileName(format, activeTab.label),
                        columns:
                          format === "csv"
                            ? ["id", "session_id", "agent_id", "event_type", "timestamp"]
                            : ["id", "session_id", "agent_id", "event_type", "timestamp", "event_data"],
                      }));
                    }}
                  >
                    <option value="json">JSON</option>
                    <option value="csv">CSV</option>
                  </Select>
                </VStack>
                <VStack align="start" spacing={1}>
                  <Text fontSize="sm" fontWeight="700" color="text.secondary">
                    File name
                  </Text>
                  <Input
                    value={exportDraft.fileName}
                    onChange={(event) => setExportDraft((prev) => ({ ...prev, fileName: event.target.value }))}
                  />
                </VStack>
                <VStack align="start" spacing={1}>
                  <Text fontSize="sm" fontWeight="700" color="text.secondary">
                    Row limit
                  </Text>
                  <Input
                    value={exportDraft.limit}
                    onChange={(event) => setExportDraft((prev) => ({ ...prev, limit: event.target.value }))}
                  />
                </VStack>
              </Grid>
              <VStack align="stretch" spacing={2}>
                <Text fontSize="sm" fontWeight="700" color="text.secondary">
                  Columns
                </Text>
                <CheckboxGroup
                  value={exportDraft.columns}
                  onChange={(values) =>
                    setExportDraft((prev) => ({ ...prev, columns: values as LogColumnKey[] }))
                  }
                >
                  <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={2}>
                    {LOG_COLUMNS.map((column) => (
                      <Checkbox key={column.key} value={column.key}>
                        {column.label}
                      </Checkbox>
                    ))}
                  </Grid>
                </CheckboxGroup>
              </VStack>
            </VStack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={exportDisclosure.onClose}>
              Cancel
            </Button>
            <Button onClick={() => void runGuidedExport()} isLoading={isExporting}>
              Export
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
};
