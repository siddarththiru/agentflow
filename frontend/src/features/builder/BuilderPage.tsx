import { Alert, AlertIcon, HStack, Text, VStack, useToast } from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { StepShell } from "../../components/ui/StepShell";
import { createAgentFromDraft, getTools } from "./api";
import { builderSteps } from "./constants";
import { MetadataStep } from "./components/MetadataStep";
import { PolicyStep } from "./components/PolicyStep";
import { ReviewStep } from "./components/ReviewStep";
import { SafetyStep } from "./components/SafetyStep";
import { ToolsStep } from "./components/ToolsStep";
import { BuilderDraft, BuilderValidationErrors, ToolOption } from "./types";
import { validateMetadata, validatePolicy, validateSafety, validateTools } from "./validation";

const initialDraft: BuilderDraft = {
  metadata: {
    name: "",
    description: "",
    purpose: "",
    model: "gemini-2.5-flash",
  },
  selectedToolIds: [],
  policy: {
    frequencyLimit: "",
    requireApprovalForAllToolCalls: false,
    intentGuardEnabled: true,
    intentGuardModelMode: "dedicated",
    intentGuardModel: "gemini-2.5-flash",
    intentGuardIncludeConversation: true,
    intentGuardIncludeToolArgs: false,
    intentGuardRiskTolerance: "balanced",
    intentGuardActionLow: "ignore",
    intentGuardActionMedium: "clarify",
    intentGuardActionHigh: "pause_for_approval",
    intentGuardActionCritical: "block",
  },
};

export const BuilderPage = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [draft, setDraft] = useState<BuilderDraft>(initialDraft);
  const [errors, setErrors] = useState<BuilderValidationErrors>({});
  const [tools, setTools] = useState<ToolOption[]>([]);
  const [search, setSearch] = useState("");
  const [toolsLoading, setToolsLoading] = useState(true);
  const [toolsError, setToolsError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadTools = async () => {
      setToolsLoading(true);
      try {
        const data = await getTools();
        setTools(data);
        setToolsError(null);
      } catch {
        setToolsError("Could not load tools. Try refreshing this page.");
      } finally {
        setToolsLoading(false);
      }
    };

    void loadTools();
  }, []);

  const stepItems = useMemo(
    () => builderSteps.map((step) => ({ key: step.key, title: step.title })),
    []
  );

  const activeStep = builderSteps[activeStepIndex];

  const updateMetadata = <K extends keyof BuilderDraft["metadata"]>(
    key: K,
    value: BuilderDraft["metadata"][K]
  ) => {
    setDraft((prev) => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        [key]: value,
      },
    }));
  };

  const updatePolicy = <K extends keyof BuilderDraft["policy"]>(
    key: K,
    value: BuilderDraft["policy"][K]
  ) => {
    setDraft((prev) => ({
      ...prev,
      policy: {
        ...prev.policy,
        [key]: value,
      },
    }));
  };

  const toggleTool = (toolId: number) => {
    setDraft((prev) => {
      const selected = prev.selectedToolIds.includes(toolId);
      return {
        ...prev,
        selectedToolIds: selected
          ? prev.selectedToolIds.filter((id) => id !== toolId)
          : [...prev.selectedToolIds, toolId],
      };
    });
  };

  const validateCurrentStep = (): boolean => {
    let validation: BuilderValidationErrors = {};
    if (activeStep.key === "metadata") {
      validation = validateMetadata(draft);
    }
    if (activeStep.key === "tools") {
      validation = validateTools(draft);
    }
    if (activeStep.key === "policy") {
      validation = validatePolicy(draft);
    }
    if (activeStep.key === "safety") {
      validation = validateSafety(draft);
    }

    setErrors(validation);
    return Object.keys(validation).length === 0;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) {
      return;
    }
    setSubmitError(null);
    setActiveStepIndex((prev) => Math.min(prev + 1, builderSteps.length - 1));
  };

  const handleBack = () => {
    setErrors({});
    setSubmitError(null);
    setActiveStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleSave = async () => {
    const metadataErrors = validateMetadata(draft);
    const toolErrors = validateTools(draft);
    const policyErrors = validatePolicy(draft);
    const safetyErrors = validateSafety(draft);
    const mergedErrors = {
      ...metadataErrors,
      ...toolErrors,
      ...policyErrors,
      ...safetyErrors,
    };

    if (Object.keys(mergedErrors).length > 0) {
      setErrors(mergedErrors);
      setSubmitError("Review your configuration before creating the agent.");
      return;
    }

    setIsSaving(true);
    setSubmitError(null);
    try {
      const result = await createAgentFromDraft(draft);
      toast({
        title: "Agent created",
        description: `${result.agentName} created with ID ${result.agentId}.`,
        status: "success",
        duration: 4000,
        isClosable: true,
      });
      setDraft(initialDraft);
      setErrors({});
      setActiveStepIndex(0);
      navigate("/dashboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create agent.";
      setSubmitError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImportJson = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const imported = JSON.parse(content);
        
        // Validate the structure has required fields
        if (!imported.metadata || !imported.policy) {
          throw new Error("Invalid agent JSON format. Missing metadata or policy.");
        }

        // Handle both formats: tools array and selectedToolIds
        let toolIds: number[] = [];
        if (Array.isArray(imported.tools)) {
          toolIds = imported.tools
            .filter((tool: any) => typeof tool.id === "number")
            .map((tool: any) => tool.id);
        } else if (Array.isArray(imported.selectedToolIds)) {
          toolIds = imported.selectedToolIds;
        }

        // Map snake_case policy keys to camelCase for the builder format
        const policyKeys = [
          { from: "frequency_limit", to: "frequencyLimit" },
          { from: "require_approval_for_all_tool_calls", to: "requireApprovalForAllToolCalls" },
          { from: "intent_guard_enabled", to: "intentGuardEnabled" },
          { from: "intent_guard_model_mode", to: "intentGuardModelMode" },
          { from: "intent_guard_model", to: "intentGuardModel" },
          { from: "intent_guard_include_conversation", to: "intentGuardIncludeConversation" },
          { from: "intent_guard_include_tool_args", to: "intentGuardIncludeToolArgs" },
          { from: "intent_guard_risk_tolerance", to: "intentGuardRiskTolerance" },
          { from: "intent_guard_action_low", to: "intentGuardActionLow" },
          { from: "intent_guard_action_medium", to: "intentGuardActionMedium" },
          { from: "intent_guard_action_high", to: "intentGuardActionHigh" },
          { from: "intent_guard_action_critical", to: "intentGuardActionCritical" },
        ];

        const normalizedPolicy: any = {};
        policyKeys.forEach(({ from, to }) => {
          const value = imported.policy[from];
          if (from === "frequency_limit" && value !== null && value !== undefined) {
            normalizedPolicy[to] = String(value);
          } else {
            normalizedPolicy[to] = value;
          }
        });

        const normalizedDraft: BuilderDraft = {
          metadata: {
            name: imported.metadata.name || "",
            description: imported.metadata.description || "",
            purpose: imported.metadata.purpose || "",
            model: imported.metadata.model || "gemini-2.5-flash",
          },
          selectedToolIds: toolIds,
          policy: {
            frequencyLimit: normalizedPolicy.frequencyLimit || "",
            requireApprovalForAllToolCalls: normalizedPolicy.requireApprovalForAllToolCalls ?? false,
            intentGuardEnabled: normalizedPolicy.intentGuardEnabled ?? true,
            intentGuardModelMode: normalizedPolicy.intentGuardModelMode || "dedicated",
            intentGuardModel: normalizedPolicy.intentGuardModel || "gemini-2.5-flash",
            intentGuardIncludeConversation: normalizedPolicy.intentGuardIncludeConversation ?? true,
            intentGuardIncludeToolArgs: normalizedPolicy.intentGuardIncludeToolArgs ?? false,
            intentGuardRiskTolerance: normalizedPolicy.intentGuardRiskTolerance || "balanced",
            intentGuardActionLow: normalizedPolicy.intentGuardActionLow || "ignore",
            intentGuardActionMedium: normalizedPolicy.intentGuardActionMedium || "clarify",
            intentGuardActionHigh: normalizedPolicy.intentGuardActionHigh || "pause_for_approval",
            intentGuardActionCritical: normalizedPolicy.intentGuardActionCritical || "block",
          },
        };

        setDraft(normalizedDraft);
        setErrors({});
        setSubmitError(null);
        setActiveStepIndex(0);
        
        toast({
          title: "Agent imported",
          description: "Agent configuration loaded successfully.",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to parse JSON file.";
        toast({
          title: "Import failed",
          description: message,
          status: "error",
          duration: 4000,
          isClosable: true,
        });
      }
    };
    reader.readAsText(file);

    // Reset input so user can select the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <VStack align="stretch" spacing={7}>
      <PageHeader
        title="Builder"
        description="Create a governed agent with clear metadata, controlled tool access, and policy safeguards."
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportJson}
              style={{ display: "none" }}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Import from JSON
            </Button>
          </>
        }
      />

      <StepShell
        title={activeStep.title}
        description={activeStep.description}
        steps={stepItems}
        activeStepIndex={activeStepIndex}
        footer={
          <VStack align="stretch" spacing={3}>
            {submitError ? (
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                <Text>{submitError}</Text>
              </Alert>
            ) : null}

            {errors.tools ? (
              <Alert status="warning" borderRadius="md">
                <AlertIcon />
                <Text>{errors.tools}</Text>
              </Alert>
            ) : null}

            <HStack justify="space-between" align="center">
              <Text color="text.secondary" fontSize="sm">
                Step {activeStepIndex + 1} of {builderSteps.length}
              </Text>
              <HStack>
                <Button variant="ghost" onClick={handleBack} isDisabled={activeStepIndex === 0}>
                  Previous
                </Button>
                {activeStepIndex < builderSteps.length - 1 ? (
                  <Button onClick={handleNext}>Continue</Button>
                ) : (
                  <Button onClick={handleSave} isLoading={isSaving} loadingText="Saving">
                    Create agent
                  </Button>
                )}
              </HStack>
            </HStack>
          </VStack>
        }
      >
        {activeStep.key === "metadata" ? (
          <MetadataStep metadata={draft.metadata} errors={errors} onChange={updateMetadata} />
        ) : null}

        {activeStep.key === "tools" ? (
          <ToolsStep
            tools={tools}
            selectedToolIds={draft.selectedToolIds}
            search={search}
            isLoading={toolsLoading}
            error={toolsError}
            onSearchChange={setSearch}
            onToggleTool={toggleTool}
          />
        ) : null}

        {activeStep.key === "policy" ? (
          <PolicyStep policy={draft.policy} errors={errors} onPolicyChange={updatePolicy} />
        ) : null}

        {activeStep.key === "safety" ? (
          <SafetyStep policy={draft.policy} errors={errors} onPolicyChange={updatePolicy} />
        ) : null}

        {activeStep.key === "review" ? <ReviewStep draft={draft} tools={tools} /> : null}
      </StepShell>
    </VStack>
  );
};
