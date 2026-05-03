import { StatusBadge } from "../ui/StatusBadge";
import { titleCase } from "../../lib/format";

type RiskBadgeProps = {
  risk?: string | null;
};

const toneForRisk = (risk?: string | null): "success" | "pending" | "warning" | "danger" | "info" => {
  const normalized = (risk || "").toLowerCase();
  if (normalized === "low") {
    return "success";
  }
  if (normalized === "medium") {
    return "pending";
  }
  if (normalized === "high") {
    return "warning";
  }
  if (normalized === "critical") {
    return "danger";
  }
  return "info";
};

export const RiskBadge = ({ risk }: RiskBadgeProps) => {
  if (!risk) {
    return null;
  }

  return <StatusBadge status={toneForRisk(risk)} label={titleCase(risk)} />;
};
