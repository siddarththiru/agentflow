import { FeaturePlaceholderPage } from "../../components/layout/FeaturePlaceholderPage";

export const SessionsPage = () => {
  return (
    <FeaturePlaceholderPage
      title="Sessions"
      description="Observe runtime executions, status progression, and operator interventions in one timeline view."
      highlights={[
        "Live session list with filtering",
        "Session detail drawer with event sequence",
        "Action controls for replay and annotations",
      ]}
    />
  );
};
