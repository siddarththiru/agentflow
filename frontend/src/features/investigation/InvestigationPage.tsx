import { FeaturePlaceholderPage } from "../../components/layout/FeaturePlaceholderPage";

export const InvestigationPage = () => {
  return (
    <FeaturePlaceholderPage
      title="Investigation"
      description="Review incidents, inspect evidence trails, and triage escalations with disciplined risk presentation."
      highlights={[
        "Timeline + evidence cards",
        "Threat/risk annotations and ownership",
        "Escalation handoff checklist",
      ]}
    />
  );
};
