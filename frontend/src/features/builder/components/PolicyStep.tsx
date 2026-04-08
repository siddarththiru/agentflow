import {
  Grid,
  GridItem,
  HStack,
  Input,
  Switch,
  Text,
  VStack,
} from "@chakra-ui/react";
import { FormSection } from "../../../components/ui/FormSection";
import { InfoField } from "../../../components/ui/InfoField";
import { BuilderValidationErrors, PolicyDraft } from "../types";

type PolicyStepProps = {
  policy: PolicyDraft;
  errors: BuilderValidationErrors;
  onPolicyChange: <K extends keyof PolicyDraft>(key: K, value: PolicyDraft[K]) => void;
};

export const PolicyStep = ({ policy, errors, onPolicyChange }: PolicyStepProps) => {
  return (
    <VStack align="stretch" spacing={4}>
      <FormSection
        title="Runtime policy"
        description="Set practical controls that shape runtime behavior under normal operating conditions."
      >
        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
          <GridItem>
            <InfoField
              label="Frequency limit"
              helperText="Optional max number of executions in a time window. Leave empty for no explicit cap."
              error={errors.frequencyLimit}
            >
              <Input
                type="number"
                min={1}
                value={policy.frequencyLimit}
                onChange={(event) => onPolicyChange("frequencyLimit", event.target.value)}
                placeholder="e.g. 25"
              />
            </InfoField>
          </GridItem>
        </Grid>
      </FormSection>

      <FormSection
        title="Safety-critical settings"
        description="Use strict approvals when every tool invocation requires explicit human sign-off."
      >
        <HStack
          justify="space-between"
          align="center"
          p={4}
          border="1px solid"
          borderColor="border.soft"
          borderRadius="md"
          bg="bg.surfaceMuted"
        >
          <VStack align="start" spacing={1}>
            <Text fontWeight="600">Require approval for all tool calls</Text>
            <Text color="text.secondary" fontSize="sm">
              Recommended for high-risk workflows or strict governance environments.
            </Text>
          </VStack>
          <Switch
            isChecked={policy.requireApprovalForAllToolCalls}
            onChange={(event) =>
              onPolicyChange("requireApprovalForAllToolCalls", event.target.checked)
            }
            colorScheme="brand"
            size="lg"
          />
        </HStack>
      </FormSection>
    </VStack>
  );
};
