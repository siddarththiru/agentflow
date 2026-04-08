import { FeaturePlaceholderPage } from "../../components/layout/FeaturePlaceholderPage";

export const ApprovalsPage = () => {
  return (
    <FeaturePlaceholderPage
      title="Approvals"
      description="Manage human-in-loop checkpoints with clear priority, context payloads, and action outcomes."
      highlights={[
        "Approval queue by urgency",
        "Decision detail panel with policy context",
        "Commented accept/reject workflows",
      ]}
    />
  );
};
