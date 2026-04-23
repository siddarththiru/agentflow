import {
  Button,
  Checkbox,
  Grid,
  HStack,
  Icon,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Select,
  Text,
  Textarea,
  VStack,
  useToast,
  Box,
} from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DetailCard } from "../../components/operations/DetailCard";
import { ConfirmActionDialog } from "../../components/operations/ConfirmActionDialog";
import { EmptyPanel } from "../../components/operations/EmptyPanel";
import { ErrorPanel } from "../../components/operations/ErrorPanel";
import { JsonPreviewPanel } from "../../components/operations/JsonPreviewPanel";
import { LoadingPanel } from "../../components/operations/LoadingPanel";
import { MetadataList } from "../../components/operations/MetadataList";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { downloadJson } from "../../lib/export";
import { formatDateTime } from "../../lib/format";
import {
  getAgentProfile,
  listAvailableTools,
  deleteAgent,
  updateAgentMetadata,
  updateAgentPolicy,
  updateAgentTools,
} from "./api";
import {
  AgentMutableMetadata,
  AgentMutablePolicy,
  AgentProfile,
} from "./types";
import { modelOptions } from "../builder/constants";

interface AgentProfileModalProps {
  agentId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: () => void;
}

const healthToLabel = (health: "healthy" | "attention" | "risk") => {
  if (health === "healthy") {
    return "Healthy";
  }
  if (health === "attention") {
    return "Attention";
  }
  return "Risk";
};

const healthToStatus = (health: "healthy" | "attention" | "risk") => {
  if (health === "healthy") {
    return "success" as const;
  }
  if (health === "attention") {
    return "pending" as const;
  }
  return "danger" as const;
};

const CardTitleIcon = ({ path }: { path: string }) => (
  <Icon viewBox="0 0 24 24" boxSize={5} color="text.secondary" aria-hidden>
    <path fill="currentColor" d={path} />
  </Icon>
);

export const AgentProfileModal = ({
  agentId,
  isOpen,
  onClose,
  onProfileUpdated,
}: AgentProfileModalProps) => {
  const toast = useToast();
  const navigate = useNavigate();
  const deleteCancelRef = useRef<HTMLButtonElement>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [metadataDraft, setMetadataDraft] = useState<AgentMutableMetadata | null>(null);
  const [policyDraft, setPolicyDraft] = useState<AgentMutablePolicy | null>(null);
  const [toolDraft, setToolDraft] = useState<number[]>([]);

  const [editingMetadata, setEditingMetadata] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(false);
  const [editingTools, setEditingTools] = useState(false);

  const [saveMetadataLoading, setSaveMetadataLoading] = useState(false);
  const [savePolicyLoading, setSavePolicyLoading] = useState(false);
  const [saveToolsLoading, setSaveToolsLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [availableTools, setAvailableTools] = useState<Array<{ id: number; name: string; usable: boolean }>>([]);
  const [toolsLoading, setToolsLoading] = useState(false);

  const availableModelOptions = useMemo(() => {
    if (!profile?.agent.model || modelOptions.includes(profile.agent.model)) {
      return modelOptions;
    }
    return [profile.agent.model, ...modelOptions];
  }, [profile?.agent.model]);

  const loadProfile = async (id: number) => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const response = await getAgentProfile(id);
      setProfile(response);
      setMetadataDraft({
        name: response.agent.name,
        description: response.agent.description,
        purpose: response.agent.purpose,
        model: response.agent.model,
      });
      setPolicyDraft({
        frequencyLimit:
          response.policy?.frequency_limit !== null && response.policy?.frequency_limit !== undefined
            ? String(response.policy.frequency_limit)
            : "",
        requireApprovalForAllToolCalls:
          response.policy?.require_approval_for_all_tool_calls || false,
      });
      setToolDraft(response.tools.map((tool) => tool.id));
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Unable to load agent profile.");
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const loadTools = async () => {
    setToolsLoading(true);
    try {
      const tools = await listAvailableTools();
      setAvailableTools(
        tools.map((tool) => ({ id: tool.id, name: tool.name, usable: tool.usable }))
      );
    } catch {
      setAvailableTools([]);
    } finally {
      setToolsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && agentId !== null) {
      void loadProfile(agentId);
      void loadTools();
    }
  }, [isOpen, agentId]);

  const toggleTool = (toolId: number) => {
    setToolDraft((prev) =>
      prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId]
    );
  };

  const saveMetadata = async () => {
    if (!profile || !metadataDraft) {
      return;
    }
    if (!metadataDraft.name.trim() || !metadataDraft.description.trim() || !metadataDraft.purpose.trim()) {
      toast({
        title: "Required fields missing",
        description: "Name, description, and purpose are required.",
        status: "warning",
        duration: 3000,
      });
      return;
    }

    setSaveMetadataLoading(true);
    try {
      await updateAgentMetadata(profile.agent.id, metadataDraft);
      toast({
        title: "Metadata saved",
        status: "success",
        duration: 3000,
      });
      setEditingMetadata(false);
      await loadProfile(profile.agent.id);
      onProfileUpdated?.();
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unable to save metadata.",
        status: "error",
        duration: 3000,
      });
    } finally {
      setSaveMetadataLoading(false);
    }
  };

  const savePolicy = async () => {
    if (!profile || !policyDraft) {
      return;
    }

    setSavePolicyLoading(true);
    try {
      await updateAgentPolicy(profile.agent.id, policyDraft);
      toast({
        title: "Policy saved",
        status: "success",
        duration: 3000,
      });
      setEditingPolicy(false);
      await loadProfile(profile.agent.id);
      onProfileUpdated?.();
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unable to save policy.",
        status: "error",
        duration: 3000,
      });
    } finally {
      setSavePolicyLoading(false);
    }
  };

  const saveTools = async () => {
    if (!profile) {
      return;
    }

    setSaveToolsLoading(true);
    try {
      await updateAgentTools(profile.agent.id, toolDraft);
      toast({
        title: "Tools saved",
        status: "success",
        duration: 3000,
      });
      setEditingTools(false);
      await loadProfile(profile.agent.id);
      onProfileUpdated?.();
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unable to save tools.",
        status: "error",
        duration: 3000,
      });
    } finally {
      setSaveToolsLoading(false);
    }
  };

  const handleDeleteAgent = async () => {
    if (!profile) {
      return;
    }

    setDeleteLoading(true);
    try {
      await deleteAgent(profile.agent.id);
      toast({
        title: "Agent deleted",
        status: "success",
        duration: 3000,
      });
      setIsDeleteDialogOpen(false);
      onClose();
      onProfileUpdated?.();
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Unable to delete agent.",
        status: "error",
        duration: 3000,
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCopyDefinition = async () => {
    if (!profile?.definition) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(profile.definition, null, 2));
      toast({
        title: "Definition copied",
        status: "success",
        duration: 2000,
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard access was unavailable.",
        status: "error",
        duration: 3000,
      });
    }
  };

  const handleExportDefinition = () => {
    if (!profile?.definition) return;
    downloadJson(`agent-${profile.agent.id}-definition.json`, profile.definition);
    toast({
      title: "Definition exported",
      status: "success",
      duration: 2000,
    });
  };

  const latestSessions = profile ? profile.recent_sessions.slice(0, 3) : [];
  const latestApprovals = profile ? profile.recent_approvals.slice(0, 3) : [];

  const subtleActionButtonProps = {
    size: "sm" as const,
    variant: "ghost" as const,
    bg: "blackAlpha.50",
    color: "text.secondary",
    borderRadius: "md",
    fontWeight: 600,
    _hover: {
      bg: "blackAlpha.100",
      color: "text.primary",
    },
    _active: {
      bg: "blackAlpha.200",
    },
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent
        bgGradient="linear(to-b, rgba(248,250,252,1), rgba(241,245,249,1))"
        border={{ base: "none", md: "1px" }}
        borderColor="border.soft"
        boxShadow={{ base: "none", md: "floating" }}
        w={{ base: "100vw", md: "85vw" }}
        maxW={{ base: "100vw", md: "1400px" }}
        h={{ base: "100vh", md: "92vh" }}
        my={{ base: 0, md: 4 }}
        borderRadius={{ base: 0, md: "xl" }}
      >
        {profileLoading ? (
          <>
            <ModalHeader>Loading...</ModalHeader>
            <ModalBody>
              <LoadingPanel label="Loading agent details..." />
            </ModalBody>
          </>
        ) : profileError ? (
          <>
            <ModalHeader>Profile Error</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <ErrorPanel title="Unable to load profile" message={profileError} />
            </ModalBody>
          </>
        ) : profile ? (
          <>
            <ModalHeader fontSize="lg" fontWeight="700" borderBottom="1px solid" borderColor="border.soft">
              {profile.agent.name}
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
              <VStack align="stretch" spacing={4}>
                <HStack align="stretch" spacing={3}>
                  <Box
                    flex="1"
                    border="1px solid"
                    borderColor="border.soft"
                    bgGradient="linear(to-r, rgba(49,130,206,0.2), rgba(56,178,172,0.16))"
                    borderRadius="xl"
                    px={4}
                    py={3}
                    boxShadow="sm"
                  >
                    <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
                      <VStack align="start" spacing={0}>
                        <Text fontSize="sm" color="text.secondary" fontWeight="700">
                          Agent Snapshot
                        </Text>
                        <Text fontSize="lg" fontWeight="800">
                          {profile.agent.name}
                        </Text>
                      </VStack>
                      <HStack spacing={2} flexWrap="wrap">
                        <StatusBadge
                          status={healthToStatus(profile.health_status)}
                          label={`Health: ${healthToLabel(profile.health_status)}`}
                        />
                        <StatusBadge status="pending" label={`Agent ID: ${profile.agent.id}`} />
                        <StatusBadge status="pending" label={`Sessions: ${profile.sessions_count}`} />
                        <StatusBadge status="success" label={`Tools: ${profile.tools.length}`} />
                        <StatusBadge status="pending" label={`Approvals: ${profile.recent_approvals.length}`} />
                      </HStack>
                    </HStack>
                  </Box>

                  <HStack spacing={2} align="center" justify="center">
                    <Button
                      aria-label="Open agent chat"
                      leftIcon={
                        <Icon viewBox="0 0 24 24" boxSize={5}>
                          <path
                            fill="currentColor"
                            d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2zm2 4v2h12V8H6zm0 4v2h8v-2H6z"
                          />
                        </Icon>
                      }
                      onClick={() => {
                        navigate(`/agents/${profile.agent.id}/chat`);
                        onClose();
                      }}
                      variant="ghost"
                      bg="blackAlpha.50"
                      border="1px solid"
                      borderColor="border.soft"
                      _hover={{ bg: "blackAlpha.100" }}
                    >
                      Chat
                    </Button>
                    <IconButton
                      aria-label="Delete agent"
                      icon={
                        <Icon viewBox="0 0 24 24" boxSize={5}>
                          <path
                            fill="currentColor"
                            d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1z"
                          />
                        </Icon>
                      }
                      onClick={() => setIsDeleteDialogOpen(true)}
                      variant="ghost"
                      color="red.500"
                      bg="red.50"
                      border="1px solid"
                      borderColor="red.100"
                      _hover={{ bg: "red.100" }}
                    />
                  </HStack>
                </HStack>

                <Grid
                  templateColumns={{ base: "1fr", xl: "1.15fr 0.85fr" }}
                  gap={5}
                  alignItems="start"
                >
                  <VStack align="stretch" spacing={4}>
                    <DetailCard
                      title="Metadata"
                      titleIcon={<CardTitleIcon path="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z" />}
                      actions={
                        editingMetadata ? null : (
                          <Button {...subtleActionButtonProps} onClick={() => setEditingMetadata(true)}>
                            Edit
                          </Button>
                        )
                      }
                    >
                      {editingMetadata ? (
                        <VStack align="stretch" spacing={3}>
                          <Input
                            placeholder="Name"
                            value={metadataDraft?.name || ""}
                            onChange={(e) =>
                              metadataDraft && setMetadataDraft({ ...metadataDraft, name: e.target.value })
                            }
                          />
                          <Textarea
                            placeholder="Description"
                            value={metadataDraft?.description || ""}
                            onChange={(e) =>
                              metadataDraft && setMetadataDraft({ ...metadataDraft, description: e.target.value })
                            }
                          />
                          <Textarea
                            placeholder="Purpose"
                            value={metadataDraft?.purpose || ""}
                            onChange={(e) =>
                              metadataDraft && setMetadataDraft({ ...metadataDraft, purpose: e.target.value })
                            }
                          />
                          <Select
                            placeholder="Select model"
                            value={metadataDraft?.model || ""}
                            onChange={(e) =>
                              metadataDraft && setMetadataDraft({ ...metadataDraft, model: e.target.value })
                            }
                          >
                            {availableModelOptions.map((model) => (
                              <option key={model} value={model}>
                                {model}
                              </option>
                            ))}
                          </Select>
                          <HStack>
                            <Button size="sm" onClick={() => void saveMetadata()} isLoading={saveMetadataLoading}>
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingMetadata(false);
                                if (profile) {
                                  setMetadataDraft({
                                    name: profile.agent.name,
                                    description: profile.agent.description,
                                    purpose: profile.agent.purpose,
                                    model: profile.agent.model,
                                  });
                                }
                              }}
                            >
                              Cancel
                            </Button>
                          </HStack>
                        </VStack>
                      ) : (
                        <MetadataList
                          items={[
                            { label: "Name", value: profile.agent.name },
                            { label: "Description", value: profile.agent.description },
                            { label: "Purpose", value: profile.agent.purpose },
                            { label: "Model", value: profile.agent.model },
                            { label: "Health", value: healthToLabel(profile.health_status) },
                            { label: "Sessions", value: String(profile.sessions_count) },
                            {
                              label: "Created",
                              value: formatDateTime(profile.agent.created_at),
                            },
                            {
                              label: "Updated",
                              value: formatDateTime(profile.agent.updated_at),
                            },
                          ]}
                        />
                      )}
                    </DetailCard>
                    <DetailCard
                      title="Recent Sessions"
                      titleIcon={<CardTitleIcon path="M12 1a11 11 0 1 0 11 11A11.01 11.01 0 0 0 12 1zm1 11.59 3.3 3.29-1.42 1.42L11 13V6h2z" />}
                      subtitle="Latest runtime activity"
                      actions={
                        <Button
                          {...subtleActionButtonProps}
                          onClick={() => {
                            navigate(`/sessions?agentId=${profile.agent.id}`);
                            onClose();
                          }}
                        >
                          View more
                        </Button>
                      }
                    >
                      <VStack align="stretch" spacing={2}>
                        {latestSessions.length === 0 ? (
                          <EmptyPanel title="No sessions yet" description="This agent has not been run yet." />
                        ) : (
                          latestSessions.map((session) => (
                            <DetailCard
                              key={session.session_id}
                              title={session.session_id.substring(0, 8)}
                              subtitle={formatDateTime(session.created_at)}
                            >
                              <MetadataList
                                items={[
                                  { label: "Status", value: session.status },
                                  {
                                    label: "Risk",
                                    value: session.latest_risk_level || "Not classified",
                                  },
                                  {
                                    label: "Session ID",
                                    value: session.session_id,
                                  },
                                ]}
                              />
                            </DetailCard>
                          ))
                        )}
                      </VStack>
                    </DetailCard>
                  </VStack>

                  <VStack align="stretch" spacing={4}>
                    <DetailCard
                      title="Governance Policy"
                      titleIcon={<CardTitleIcon path="M12 2 4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3zm-1 14-3-3 1.41-1.41L11 13.17l3.59-3.58L16 11l-5 5z" />}
                      actions={
                        editingPolicy ? null : (
                          <Button {...subtleActionButtonProps} onClick={() => setEditingPolicy(true)}>
                            Edit
                          </Button>
                        )
                      }
                    >
                      {editingPolicy ? (
                        <VStack align="stretch" spacing={3}>
                          <VStack align="start">
                            <label htmlFor="freq">Frequency limit (calls):</label>
                            <Input
                              id="freq"
                              type="number"
                              placeholder="Leave empty for no limit"
                              value={policyDraft?.frequencyLimit || ""}
                              onChange={(e) =>
                                policyDraft &&
                                setPolicyDraft({ ...policyDraft, frequencyLimit: e.target.value })
                              }
                            />
                          </VStack>
                          <Checkbox
                            isChecked={policyDraft?.requireApprovalForAllToolCalls || false}
                            onChange={(e) =>
                              policyDraft &&
                              setPolicyDraft({
                                ...policyDraft,
                                requireApprovalForAllToolCalls: e.target.checked,
                              })
                            }
                          >
                            Require approval for all tool calls
                          </Checkbox>
                          <HStack>
                            <Button size="sm" onClick={() => void savePolicy()} isLoading={savePolicyLoading}>
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingPolicy(false);
                                if (profile) {
                                  setPolicyDraft({
                                    frequencyLimit:
                                      profile.policy?.frequency_limit !== null &&
                                      profile.policy?.frequency_limit !== undefined
                                        ? String(profile.policy.frequency_limit)
                                        : "",
                                    requireApprovalForAllToolCalls:
                                      profile.policy?.require_approval_for_all_tool_calls || false,
                                  });
                                }
                              }}
                            >
                              Cancel
                            </Button>
                          </HStack>
                        </VStack>
                      ) : (
                        <MetadataList
                          items={[
                            {
                              label: "Frequency limit",
                              value:
                                profile.policy?.frequency_limit !== null &&
                                profile.policy?.frequency_limit !== undefined
                                  ? String(profile.policy.frequency_limit)
                                  : "Not set",
                            },
                            {
                              label: "Approval required",
                              value: profile.policy?.require_approval_for_all_tool_calls
                                ? "Enabled"
                                : "Disabled",
                            },
                          ]}
                        />
                      )}
                    </DetailCard>

                    <DetailCard
                      title="Selected Tools"
                      titleIcon={<CardTitleIcon path="M22.61 18.99 13 9.38V7.5l4.44-4.44a1 1 0 0 0-1.06-1.64 6.5 6.5 0 0 0-4.82 6.1L3.2 15.9a2.5 2.5 0 1 0 3.54 3.54l8.38-8.36a6.5 6.5 0 0 0 6.1-4.82 1 1 0 0 0-1.64-1.06L15.14 9.64H13.26l9.61 9.61a1 1 0 1 1-1.41 1.41z" />}
                      subtitle="Current tool assignments"
                      actions={
                        editingTools ? null : (
                          <Button {...subtleActionButtonProps} onClick={() => setEditingTools(true)}>
                            Edit
                          </Button>
                        )
                      }
                    >
                      {editingTools ? (
                        <VStack align="stretch" spacing={2}>
                          {toolsLoading ? <LoadingPanel label="Loading available tools..." /> : null}
                          {!toolsLoading && availableTools.length === 0 ? (
                            <EmptyPanel
                              title="No tools found"
                              description="Tool assignments are unavailable because no tools are registered yet."
                            />
                          ) : null}
                          {availableTools.map((tool) => (
                            <HStack
                              key={tool.id}
                              justify="space-between"
                              border="1px solid"
                              borderColor="border.soft"
                              borderRadius="md"
                              px={3}
                              py={2}
                            >
                              <Box>
                                <div style={{ fontWeight: "600" }}>{tool.name}</div>
                                <div style={{ color: "#666", fontSize: "0.875rem" }}>Tool ID {tool.id}</div>
                              </Box>
                              <Checkbox
                                colorScheme="brand"
                                isChecked={toolDraft.includes(tool.id)}
                                onChange={() => toggleTool(tool.id)}
                                isDisabled={!tool.usable}
                              >
                                {tool.usable ? "Assigned" : "Unavailable"}
                              </Checkbox>
                            </HStack>
                          ))}
                          <HStack>
                            <Button size="sm" onClick={() => void saveTools()} isLoading={saveToolsLoading}>
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingTools(false);
                                if (profile) {
                                  setToolDraft(profile.tools.map((tool) => tool.id));
                                }
                              }}
                            >
                              Cancel
                            </Button>
                          </HStack>
                        </VStack>
                      ) : profile.tools.length > 0 ? (
                        <VStack align="stretch" spacing={2}>
                          {profile.tools.map((tool) => (
                            <HStack key={tool.id} justify="space-between">
                              <div>{tool.name}</div>
                              <StatusBadge
                                status={tool.usable ? "success" : "pending"}
                                label={tool.usable ? "Usable" : "Disabled"}
                              />
                            </HStack>
                          ))}
                        </VStack>
                      ) : (
                        <EmptyPanel
                          title="No tools assigned"
                          description="Assign tools to make this agent operational in runtime flows."
                        />
                      )}
                    </DetailCard>

                    <DetailCard
                      title="Recent Approvals"
                      titleIcon={<CardTitleIcon path="M3 5h10v2H3zm0 6h10v2H3zm0 6h7v2H3zm14.59-8L15 11.59 13.41 10 12 11.41 15 14.41 19 10.41 17.59 9z" />}
                      subtitle="Latest approval decisions"
                      actions={
                        <Button
                          {...subtleActionButtonProps}
                          onClick={() => {
                            navigate(`/approvals?agentId=${profile.agent.id}`);
                            onClose();
                          }}
                        >
                          View more
                        </Button>
                      }
                    >
                      <VStack align="stretch" spacing={2}>
                        {latestApprovals.length === 0 ? (
                          <EmptyPanel
                            title="No approvals"
                            description="No tool call approvals for this agent."
                          />
                        ) : (
                          latestApprovals.map((approval) => (
                            <DetailCard
                              key={approval.id}
                              title={approval.tool_name}
                              subtitle={formatDateTime(approval.requested_at)}
                            >
                              <MetadataList
                                items={[
                                  { label: "Status", value: approval.status },
                                  {
                                    label: "Approval ID",
                                    value: String(approval.id),
                                  },
                                  {
                                    label: "Session ID",
                                    value: approval.session_id,
                                  },
                                ]}
                              />
                            </DetailCard>
                          ))
                        )}
                      </VStack>
                    </DetailCard>
                  </VStack>
                </Grid>

                <DetailCard
                  title="Agent Definition"
                  titleIcon={<CardTitleIcon path="M8.7 16.6 4.1 12l4.6-4.6L7.3 6 1.3 12l6 6zm6.6 0 1.4 1.4 6-6-6-6-1.4 1.4 4.6 4.6z" />}
                  actions={
                    profile.definition ? (
                      <HStack>
                        <IconButton
                          aria-label="Copy definition to clipboard"
                          icon={
                            <Icon viewBox="0 0 24 24" boxSize={4}>
                              <path
                                fill="currentColor"
                                d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16h-9V7h9v14z"
                              />
                            </Icon>
                          }
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleCopyDefinition()}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          leftIcon={
                            <Icon viewBox="0 0 24 24" boxSize={4}>
                              <path
                                fill="currentColor"
                                d="M5 20h14v-2H5v2zM12 2v12l4-4 1.41 1.41L12 17.83l-5.41-5.42L8 10l4 4V2h0z"
                              />
                            </Icon>
                          }
                          onClick={handleExportDefinition}
                        >
                          Export JSON
                        </Button>
                      </HStack>
                    ) : null
                  }
                >
                  {profile.definition ? (
                    <JsonPreviewPanel
                      title="Definition JSON"
                      data={profile.definition as any}
                      maxHeight="300px"
                    />
                  ) : (
                    <EmptyPanel
                      title="No definition"
                      description="Policy must be configured to view the agent definition."
                    />
                  )}
                </DetailCard>
              </VStack>

            </ModalBody>
          </>
        ) : null}
      </ModalContent>

      <ConfirmActionDialog
        isOpen={isDeleteDialogOpen}
        title="Delete Agent"
        message="This will permanently remove the agent and its related sessions, approvals, and logs."
        confirmLabel="Delete"
        isLoading={deleteLoading}
        leastDestructiveRef={deleteCancelRef}
        onConfirm={() => void handleDeleteAgent()}
        onClose={() => setIsDeleteDialogOpen(false)}
      />
    </Modal>
  );
};
