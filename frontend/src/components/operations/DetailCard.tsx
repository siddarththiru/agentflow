import { Heading, HStack, Text, VStack } from "@chakra-ui/react";
import { ReactNode } from "react";
import { Surface } from "../ui/Surface";

type DetailCardProps = {
  title: string;
  titleIcon?: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export const DetailCard = ({ title, titleIcon, subtitle, actions, children }: DetailCardProps) => {
  return (
    <Surface>
      <VStack align="stretch" spacing={4}>
        <HStack justify="space-between" align="start">
          <VStack align="start" spacing={1}>
            <HStack spacing={2} align="center">
              {titleIcon ? titleIcon : null}
              <Heading size="sm">{title}</Heading>
            </HStack>
            {subtitle ? <Text color="text.secondary">{subtitle}</Text> : null}
          </VStack>
          {actions}
        </HStack>
        {children}
      </VStack>
    </Surface>
  );
};
