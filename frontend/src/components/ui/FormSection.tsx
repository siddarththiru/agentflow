import { Heading, StackProps, Text, VStack } from "@chakra-ui/react";
import { ReactNode } from "react";
import { Surface } from "./Surface";

type FormSectionProps = StackProps & {
  title: string;
  description?: string;
  children: ReactNode;
};

export const FormSection = ({
  title,
  description,
  children,
  ...rest
}: FormSectionProps) => {
  return (
    <Surface>
      <VStack align="stretch" spacing={5} {...rest}>
        <VStack align="start" spacing={1}>
          <Heading size="sm">{title}</Heading>
          {description ? <Text color="text.secondary">{description}</Text> : null}
        </VStack>
        {children}
      </VStack>
    </Surface>
  );
};
