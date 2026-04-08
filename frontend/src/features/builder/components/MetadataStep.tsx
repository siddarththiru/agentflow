import { Grid, GridItem, Input, Select, Textarea } from "@chakra-ui/react";
import { FormSection } from "../../../components/ui/FormSection";
import { InfoField } from "../../../components/ui/InfoField";
import { AgentMetadataDraft, BuilderValidationErrors } from "../types";
import { modelOptions } from "../constants";

type MetadataStepProps = {
  metadata: AgentMetadataDraft;
  errors: BuilderValidationErrors;
  onChange: <K extends keyof AgentMetadataDraft>(key: K, value: AgentMetadataDraft[K]) => void;
};

export const MetadataStep = ({ metadata, errors, onChange }: MetadataStepProps) => {
  return (
    <FormSection
      title="Agent metadata"
      description="Capture a clear identity and mission so reviewers can immediately understand this agent's role."
    >
      <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
        <GridItem>
          <InfoField
            label="Name"
            helperText="Must be unique in your workspace."
            error={errors.name}
            isRequired
          >
            <Input
              value={metadata.name}
              onChange={(event) => onChange("name", event.target.value)}
              placeholder="e.g. Incident triage assistant"
            />
          </InfoField>
        </GridItem>

        <GridItem>
          <InfoField
            label="Model"
            helperText="Select the model that powers planning and response behavior."
            error={errors.model}
            isRequired
          >
            <Select
              value={metadata.model}
              onChange={(event) => onChange("model", event.target.value)}
            >
              {modelOptions.map((model) => (
                <option value={model} key={model}>
                  {model}
                </option>
              ))}
            </Select>
          </InfoField>
        </GridItem>

        <GridItem colSpan={{ base: 1, md: 2 }}>
          <InfoField
            label="Description"
            helperText="Use at least 10 characters so operators get useful context."
            error={errors.description}
            isRequired
          >
            <Textarea
              value={metadata.description}
              onChange={(event) => onChange("description", event.target.value)}
              placeholder="Summarize how the agent behaves and where it is used."
              minH="120px"
            />
          </InfoField>
        </GridItem>

        <GridItem colSpan={{ base: 1, md: 2 }}>
          <InfoField
            label="Purpose"
            helperText="State the mission in one concise sentence."
            error={errors.purpose}
            isRequired
          >
            <Textarea
              value={metadata.purpose}
              onChange={(event) => onChange("purpose", event.target.value)}
              placeholder="e.g. Reduce analyst response time by prioritizing high-risk events."
              minH="90px"
            />
          </InfoField>
        </GridItem>
      </Grid>
    </FormSection>
  );
};
