import { Alert, AlertIcon, HStack, Text, VStack, useToast } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { StepShell } from "../../components/ui/StepShell";
import { createAgentFromDraft, getTools } from "./api";
import { builderSteps } from "./constants";
import { MetadataStep } from "./components/MetadataStep";
import { PolicyStep } from "./components/PolicyStep";
import { ReviewStep } from "./components/ReviewStep";
import { ToolsStep } from "./components/ToolsStep";
import { BuilderDraft, BuilderValidationErrors, ToolOption } from "./types";
import { validateMetadata, validatePolicy, validateTools } from "./validation";

const initialDraft: BuilderDraft = {
  metadata: {
    name: "",
    description: "",
    purpose: "",
    model: "gemini-1.5-flash",
  },
  selectedToolIds: [],
  policy: {
    frequencyLimit: "",
    requireApprovalForAllToolCalls: false,
  },
};

export const BuilderPage = () => {
  const toast = useToast();
  const navigate = useNavigate();
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
    const mergedErrors = {
      ...metadataErrors,
      ...toolErrors,
      ...policyErrors,
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

  return (
    <VStack align="stretch" spacing={7}>
      <PageHeader
        title="Builder"
        description="Create a governed agent with clear metadata, controlled tool access, and policy safeguards."
        actions={
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Back to dashboard
          </Button>
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

        {activeStep.key === "review" ? <ReviewStep draft={draft} tools={tools} /> : null}
      </StepShell>
    </VStack>
  );
};
