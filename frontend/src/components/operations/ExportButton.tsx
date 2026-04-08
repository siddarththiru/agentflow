import { Button, ButtonProps } from "@chakra-ui/react";

type ExportButtonProps = ButtonProps & {
  label: string;
};

export const ExportButton = ({ label, ...rest }: ExportButtonProps) => {
  return (
    <Button size="sm" variant="outline" {...rest}>
      {label}
    </Button>
  );
};
