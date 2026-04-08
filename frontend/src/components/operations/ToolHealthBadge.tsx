import { StatusBadge } from "../ui/StatusBadge";

type ToolHealthBadgeProps = {
  usable: boolean;
};

export const ToolHealthBadge = ({ usable }: ToolHealthBadgeProps) => {
  return (
    <StatusBadge
      status={usable ? "success" : "pending"}
      label={usable ? "Usable" : "Disabled"}
    />
  );
};
