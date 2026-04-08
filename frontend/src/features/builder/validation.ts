import { BuilderDraft, BuilderValidationErrors } from "./types";

export const validateMetadata = (draft: BuilderDraft): BuilderValidationErrors => {
  const errors: BuilderValidationErrors = {};

  if (!draft.metadata.name.trim()) {
    errors.name = "Name is required.";
  }

  if (draft.metadata.description.trim().length < 10) {
    errors.description = "Description must be at least 10 characters.";
  }

  if (draft.metadata.purpose.trim().length < 5) {
    errors.purpose = "Purpose must be at least 5 characters.";
  }

  if (!draft.metadata.model.trim()) {
    errors.model = "Model is required.";
  }

  return errors;
};

export const validateTools = (draft: BuilderDraft): BuilderValidationErrors => {
  if (draft.selectedToolIds.length === 0) {
    return { tools: "Select at least one tool before continuing." };
  }
  return {};
};

export const validatePolicy = (draft: BuilderDraft): BuilderValidationErrors => {
  const errors: BuilderValidationErrors = {};
  if (
    draft.policy.frequencyLimit.trim().length > 0 &&
    Number(draft.policy.frequencyLimit) <= 0
  ) {
    errors.frequencyLimit = "Frequency limit must be a positive number.";
  }

  return errors;
};
