import { FeaturePlaceholderPage } from "../../components/layout/FeaturePlaceholderPage";

export const NotificationsPage = () => {
  return (
    <FeaturePlaceholderPage
      title="Notifications"
      description="Configure delivery channels, cadence controls, and fallback routing for operational alerts."
      highlights={[
        "Channel configuration matrix",
        "Template preview and test send",
        "Failure handling and retry policy",
      ]}
    />
  );
};
