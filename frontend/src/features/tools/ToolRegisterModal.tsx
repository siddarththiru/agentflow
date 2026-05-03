import {
  Alert,
  AlertIcon,
  Button as ChakraButton,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
  useToast,
  Grid,
  GridItem,
} from "@chakra-ui/react";
import { useState } from "react";
import { ToolSchemaEditor } from "../../components/operations/ToolSchemaEditor";
import { JsonPreviewPanel } from "../../components/operations/JsonPreviewPanel";
import { ToolHealthBadge } from "../../components/operations/ToolHealthBadge";
import { LoadingPanel } from "../../components/operations/LoadingPanel";
import { createTool, validateTool } from "./api";
import { ToolCreatePayload, ToolValidateResponse } from "./types";

const defaultInputSchema = JSON.stringify(
  {
    type: "object",
    properties: {
      query: { type: "string", description: "Input query for the tool" },
    },
    required: ["query"],
  },
  null,
  2
);

const defaultOutputSchema = JSON.stringify(
  {
    type: "object",
    properties: { result: { type: "string" } },
    required: ["result"],
  },
  null,
  2
);

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (tool: any) => void;
}

export const ToolRegisterModal = ({ isOpen, onClose, onCreated }: Props) => {
  const toast = useToast();

  const [form, setForm] = useState({
    name: "",
    description: "",
    inputSchema: defaultInputSchema,
    outputSchema: defaultOutputSchema,
  });
  const [validationResult, setValidationResult] = useState<ToolValidateResponse | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const runValidation = async () => {
    setValidationError(null);
    setIsValidating(true);
    setValidationResult(null);

    if (!form.name.trim() || !form.description.trim()) {
      setValidationError("Name and description are required.");
      setIsValidating(false);
      return;
    }

    try {
      const result = await validateTool({
        name: form.name.trim(),
        description: form.description.trim(),
        inputSchema: form.inputSchema,
        outputSchema: form.outputSchema,
      });
      setValidationResult(result);
      if (!result.valid && result.errors.length > 0) {
        setValidationError(result.errors.join(" | "));
      }
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Validation failed.");
    } finally {
      setIsValidating(false);
    }
  };

  const submitRegistration = async () => {
    setIsCreating(true);
    setValidationError(null);
    try {
      const payload: ToolCreatePayload = {
        name: form.name.trim(),
        description: form.description.trim(),
        inputSchema: form.inputSchema,
        outputSchema: form.outputSchema,
      };
      const created = await createTool(payload);
      toast({
        title: "Tool registered",
        description: `${created.name} was created successfully.`,
        status: "success",
        duration: 4000,
        isClosable: true,
      });
      onCreated?.(created);
      onClose();
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Tool registration failed.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Register tool</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack align="stretch" spacing={4}>
            <VStack align="stretch">
              <Text fontSize="sm" fontWeight="700" color="text.secondary">
                Name
              </Text>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. SlackNotifier"
                style={{ padding: 8, borderRadius: 6, border: "1px solid #E2E8F0" }}
              />
            </VStack>

            <VStack align="stretch">
              <Text fontSize="sm" fontWeight="700" color="text.secondary">
                Description
              </Text>
              <input
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Describe what this tool does"
                style={{ padding: 8, borderRadius: 6, border: "1px solid #E2E8F0" }}
              />
            </VStack>

            <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
              <GridItem>
                <ToolSchemaEditor
                  label="Input schema"
                  value={form.inputSchema}
                  onChange={(value) => setForm((p) => ({ ...p, inputSchema: value }))}
                  helperText="Provide a JSON schema string for input payloads."
                />
              </GridItem>
              <GridItem>
                <ToolSchemaEditor
                  label="Output schema"
                  value={form.outputSchema}
                  onChange={(value) => setForm((p) => ({ ...p, outputSchema: value }))}
                  helperText="Provide a JSON schema string for output payloads."
                />
              </GridItem>
            </Grid>

            {validationError ? (
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                <Text>{validationError}</Text>
              </Alert>
            ) : null}

            <HStack spacing={3}>
              <ChakraButton onClick={() => void runValidation()} isLoading={isValidating} variant="outline">
                Validate schemas
              </ChakraButton>
              <ChakraButton
                onClick={() => void submitRegistration()}
                isLoading={isCreating}
                isDisabled={validationResult?.valid === false}
              >
                Register tool
              </ChakraButton>
            </HStack>

            {validationResult ? (
              <VStack align="stretch" spacing={3}>
                <ToolHealthBadge usable={validationResult.valid} />
                {validationResult.errors.length > 0 ? (
                  <Alert status="warning" borderRadius="md">
                    <AlertIcon />
                    <Text>{validationResult.errors.join(" | ")}</Text>
                  </Alert>
                ) : null}
                <GridLikePreviews input={validationResult.input_schema} output={validationResult.output_schema} />
              </VStack>
            ) : null}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

const GridLikePreviews = ({ input, output }: { input: any; output: any }) => (
  <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
    <GridItem>
      <JsonPreviewPanel title="Validated input schema" data={input} />
    </GridItem>
    <GridItem>
      <JsonPreviewPanel title="Validated output schema" data={output} />
    </GridItem>
  </Grid>
);

export default ToolRegisterModal;
