import {
  Input,
  Select,
  VStack,
  Text,
  Button,
  useDisclosure,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable } from "../../components/operations/DataTable";
import { EmptyPanel } from "../../components/operations/EmptyPanel";
import { ErrorPanel } from "../../components/operations/ErrorPanel";
import { FilterBar } from "../../components/operations/FilterBar";
import { LoadingPanel } from "../../components/operations/LoadingPanel";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { PageHeader } from "../../components/ui/PageHeader";
import { formatDateTime } from "../../lib/format";
import { listAgents } from "./api";
import { AgentSummary } from "./types";
import { AgentProfileModal } from "./AgentProfileModal";

const healthToBadge = (health: "healthy" | "attention" | "risk") => {
  if (health === "healthy") {
    return { status: "success" as const, label: "Healthy" };
  }
  if (health === "attention") {
    return { status: "pending" as const, label: "Attention" };
  }
  return { status: "danger" as const, label: "Risk" };
};

export const AgentsPage = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const navigate = useNavigate();

  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [healthFilter, setHealthFilter] = useState("");

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      const term = search.trim().toLowerCase();
      const searchMatch =
        term.length === 0 ||
        agent.name.toLowerCase().includes(term) ||
        agent.description.toLowerCase().includes(term);
      const healthMatch = healthFilter ? agent.health_status === healthFilter : true;
      return searchMatch && healthMatch;
    });
  }, [agents, search, healthFilter]);

  const loadAgents = async () => {
    setIsLoading(true);
    setListError(null);
    try {
      const response = await listAgents();
      setAgents(response);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Unable to load agents.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAgents();
  }, []);

  const handleRowClick = (agentId: number) => {
    setSelectedAgentId(agentId);
    onOpen();
  };

  return (
    <VStack align="stretch" spacing={6} p={6}>
      <PageHeader
        title="Agents"
        description="Browse and manage your conversation agents"
      />

      {isLoading ? (
        <LoadingPanel label="Loading agents..." />
      ) : listError ? (
        <ErrorPanel title="Unable to load agents" message={listError} />
      ) : agents.length === 0 ? (
        <EmptyPanel
          title="No agents yet"
          description="Create your first agent using the Builder to get started."
        />
      ) : (
        <VStack align="stretch" spacing={4}>
          <FilterBar>
            <VStack align="start" spacing={1} minW="240px">
              <Text fontSize="sm" fontWeight="700" color="text.secondary">
                Search
              </Text>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search agents..."
              />
            </VStack>
            <VStack align="start" spacing={1} minW="180px">
              <Text fontSize="sm" fontWeight="700" color="text.secondary">
                Health
              </Text>
              <Select value={healthFilter} onChange={(e) => setHealthFilter(e.target.value)}>
                <option value="">All</option>
                <option value="healthy">Healthy</option>
                <option value="attention">Attention</option>
                <option value="risk">Risk</option>
              </Select>
            </VStack>
          </FilterBar>

          <DataTable
            columns={[
              {
                key: "name",
                header: "Name",
                render: (item: AgentSummary) => item.name,
              },
              {
                key: "description",
                header: "Description",
                render: (item: AgentSummary) => item.description,
              },
              {
                key: "model",
                header: "Model",
                render: (item: AgentSummary) => item.model,
              },
              {
                key: "sessions",
                header: "Sessions",
                render: (item: AgentSummary) => item.sessions_count,
              },
              {
                key: "health",
                header: "Health",
                render: (item: AgentSummary) => {
                  const badge = healthToBadge(item.health_status);
                  return (
                    <StatusBadge status={badge.status} label={badge.label} />
                  );
                },
              },
              {
                key: "updated",
                header: "Updated",
                render: (item: AgentSummary) => formatDateTime(item.updated_at),
              },
              {
                key: "chat",
                header: "Chat",
                render: (item: AgentSummary) => (
                  <Button
                    size="sm"
                    colorScheme="brand"
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate(`/agents/${item.id}/chat`);
                    }}
                  >
                    New Chat
                  </Button>
                ),
              },
            ]}
            rows={filteredAgents}
            rowKey={(item: AgentSummary) => String(item.id)}
            onRowClick={(item: AgentSummary) => handleRowClick(item.id)}
          />
        </VStack>
      )}

      <AgentProfileModal
        agentId={selectedAgentId}
        isOpen={isOpen}
        onClose={onClose}
        onProfileUpdated={loadAgents}
      />
    </VStack>
  );
};
