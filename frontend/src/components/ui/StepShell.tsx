import {
  Box,
  HStack,
  Progress,
  Text,
  VStack,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { ReactNode } from "react";
import { Surface } from "./Surface";

export type StepItem = {
  key: string;
  title: string;
};

type StepShellProps = {
  title: string;
  description: string;
  steps: StepItem[];
  activeStepIndex: number;
  children: ReactNode;
  footer: ReactNode;
};

export const StepShell = ({
  title,
  description,
  steps,
  activeStepIndex,
  children,
  footer,
}: StepShellProps) => {
  const progress = ((activeStepIndex + 1) / steps.length) * 100;

  return (
    <VStack align="stretch" spacing={5}>
      <Surface>
        <VStack align="stretch" spacing={4}>
          <VStack align="start" spacing={1}>
            <Text fontSize="2xl" fontWeight="700" letterSpacing="-0.02em">
              {title}
            </Text>
            <Text color="text.secondary">{description}</Text>
          </VStack>

          <Progress
            value={progress}
            borderRadius="full"
            colorScheme="brand"
            bg="bg.surfaceMuted"
          />

          <Wrap spacing={2}>
            {steps.map((step, index) => {
              const isActive = index === activeStepIndex;
              const isComplete = index < activeStepIndex;
              return (
                <WrapItem key={step.key}>
                  <HStack
                    px={3}
                    py={2}
                    borderRadius="full"
                    border="1px solid"
                    borderColor={
                      isActive ? "brand.300" : isComplete ? "#c7dfd0" : "border.soft"
                    }
                    bg={
                      isActive
                        ? "rgba(140, 169, 255, 0.15)"
                        : isComplete
                        ? "rgba(79, 159, 120, 0.15)"
                        : "bg.surfaceMuted"
                    }
                  >
                    <Box
                      w="22px"
                      h="22px"
                      borderRadius="full"
                      display="grid"
                      placeItems="center"
                      bg={isActive ? "brand.500" : isComplete ? "status.success" : "slate.300"}
                      color="white"
                      fontSize="xs"
                      fontWeight="700"
                    >
                      {index + 1}
                    </Box>
                    <Text fontSize="sm" fontWeight="600">
                      {step.title}
                    </Text>
                  </HStack>
                </WrapItem>
              );
            })}
          </Wrap>
        </VStack>
      </Surface>

      {children}

      <Surface
        p={4}
        position={{ base: "static", md: "sticky" }}
        bottom={{ base: "auto", md: 4 }}
        bg="rgba(255,255,255,0.92)"
        backdropFilter="blur(2px)"
      >
        {footer}
      </Surface>
    </VStack>
  );
};
