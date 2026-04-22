import {
  Button,
  Checkbox,
  Grid,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Select,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Textarea,
  VStack,
  useToast,
  Box,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DetailCard } from "../../components/operations/DetailCard";
import { EmptyPanel } from "../../components/operations/EmptyPanel";
import { ErrorPanel } from "../../components/operations/ErrorPanel";
import { JsonPreviewPanel } from "../../components/operations/JsonPreviewPanel";
import { LoadingPanel } from "../../components/operations/LoadingPanel";
import { MetadataList } from "../../components/operations/MetadataList";
import { RiskBadge } from "../../components/operations/RiskBadge";
import { SessionStatusBadge } from "../../components/operations/SessionStatusBadge";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatDateTime } from "../../lib/format";
import {
  getAgentProfile,
  listAvailableTools,
  updateAgentMetadata,
  updateAgentPolicy,
  updateAgentTools,
} from "./api";
import {
  AgentMutableMetadata,
  AgentMutablePolicy,
  AgentProfile,
} from "./types";

interface AgentProfileModalProps {
  agentId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: () => void;
}

const healthToBadge = (health: "healthy" | "attention" | "risk") => {
  if (health === "healthy") {
    return { status: "success" as const, label: "Healthy" };
  }
  if (health === "attention") {
    return { status: "pending" as const, label: "Attention" };
  }
  return { status: "danger" as const, label: "Risk" };
};

export const AgentProfileModal = ({
  agentId,
  isOpen,
  onClose,
  onProfileUpdated,
}: AgentProfileModalProps) => {
  const toast = useToast();
  const navigate = useNavigate();

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

  const [availableTools, setAvailableTools] = useState<Array<{ id: number; name: string; usable: boolean }>>([]);
  const [toolsLoading, setToolsLoading] = useState(false);

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent bg="surface.primary" border="1px" borderColor="border.soft">
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
            <ModalHeader fontSize="lg" fontWeight="700">
              {profile.agent.name}
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
              <Tabs variant="soft-rounded" colorScheme="brand">
                <TabList mb={4} gap={2}>
                  <Tab>Overview</Tab>
                  <Tab>Policy</Tab>
                  <Tab>Tools</Tab>
                  <Tab>Sessions</Tab>
                  <Tab>Approvals</Tab>
                  <Tab>Definition</Tab>
                </TabList>

                <TabPanels>
                  {/* Overview Tab */}
                  <TabPanel>
                    <VStack align="stretch" spacing={4}>
                      <DetailCard
                        title="Metadata"
                        actions={
                          editingMetadata ? null : (
                            <Button size="sm" variant="ghost" onClick={() => setEditingMetadata(true)}>
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
                            <Input
                              placeholder="Model"
                              value={metadataDraft?.model || ""}
                              onChange={(e) =>
                                metadataDraft && setMetadataDraft({ ...metadataDraft, model: e.target.value })
                              }
                            />
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
                              { label: "Health", value: healthToBadge(profile.health_status).label },
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
                    </VStack>
                  </TabPanel>

                  {/* Policy Tab */}
                  <TabPanel>
                    <VStack align="stretch" spacing={4}>
                      <DetailCard
                        title="Governance Policy"
                        actions={
                          editingPolicy ? null : (
                            <Button size="sm" variant="ghost" onClick={() => setEditingPolicy(true)}>
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
                    </VStack>
                  </TabPanel>

                  {/* Tools Tab */}
                  <TabPanel>
                    <VStack align="stretch" spacing={4}>
                      <DetailCard
                        title="Selected tools"
                        subtitle="Current tool assignments"
                        actions={
                          editingTools ? null : (
                            <Button size="sm" variant="ghost" onClick={() => setEditingTools(true)}>
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
                                  <div style={{ color: "#666", fontSize: "0.875rem" }}>
                                    Tool ID {tool.id}
                                  </div>
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
                    </VStack>
                  </TabPanel>

                  {/* Sessions Tab */}
                  <TabPanel>
                    <VStack align="stretch" spacing={2}>
                      {profile.recent_sessions.length === 0 ? (
                        <EmptyPanel
                          title="No sessions yet"
                          description="This agent has not been run yet."
                        />
                      ) : (
                        profile.recent_sessions.map((session) => (
                          <DetailCard
                            key={session.session_id}
                            title={session.session_id.substring(0, 8)}
                            subtitle={`${formatDateTime(session.created_at)}`}
                          >
                            <MetadataList
                              items={[
                                { label: "Status", value: session.status },
                                {
                                  label: "Risk",
                                  value: session.latest_risk_level || "Not classified",
                                },
                              ]}
                            />
                          </DetailCard>
                        ))
                      )}
                    </VStack>
                  </TabPanel>

                  {/* Approvals Tab */}
                  <TabPanel>
                    <VStack align="stretch" spacing={2}>
                      {profile.recent_approvals.length === 0 ? (
                        <EmptyPanel
                          title="No approvals"
                          description="No tool call approvals for this agent."
                        />
                      ) : (
                        profile.recent_approvals.map((approval) => (
                          <DetailCard
                            key={approval.id}
                            title={approval.tool_name}
                            subtitle={`${formatDateTime(approval.requested_at)}`}
                          >
                            <MetadataList
                              items={[
                                { label: "Status", value: approval.status },
                                {
                                  label: "Session",
                                  value: approval.session_id.substring(0, 8),
                                },
                              ]}
                            />
                          </DetailCard>
                        ))
                      )}
                    </VStack>
                  </TabPanel>

                  {/* Definition Tab */}
                  <TabPanel>
                    <VStack align="stretch">
                      {profile.definition ? (
                        <JsonPreviewPanel
                          title="Agent Definition"
                          data={profile.definition as any}
                          maxHeight="280px"
                        />
                      ) : (
                        <EmptyPanel
                          title="No definition"
                          description="Policy must be configured to view the agent definition."
                        />
                      )}
                    </VStack>
                  </TabPanel>
                </TabPanels>
              </Tabs>

              {/* Action buttons at bottom */}
              <VStack align="stretch" spacing={2} mt={6} pt={4} borderTop="1px solid" borderColor="border.soft">
                <Button
                  onClick={() => {
                    navigate(`/agents/${profile.agent.id}/chat`);
                    onClose();
                  }}
                  colorScheme="brand"
                >
                  Open Agent Chat
                </Button>
                <Button variant="ghost">View Investigation</Button>
              </VStack>
            </ModalBody>
          </>
        ) : null}
      </ModalContent>
    </Modal>
  );
};
