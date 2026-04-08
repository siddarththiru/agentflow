import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import { ReactNode } from "react";

type SelectionCardProps = {
  title: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  meta?: ReactNode;
};

export const SelectionCard = ({
  title,
  description,
  selected,
  disabled,
  onSelect,
  meta,
}: SelectionCardProps) => {
  return (
    <Box
      as="button"
      textAlign="left"
      w="100%"
      p={4}
      border="1px solid"
      borderColor={selected ? "brand.300" : "border.soft"}
      borderRadius="md"
      bg={selected ? "rgba(140, 169, 255, 0.14)" : "bg.surface"}
      opacity={disabled ? 0.55 : 1}
      cursor={disabled ? "not-allowed" : "pointer"}
      transition="all 180ms ease"
      _hover={{
        borderColor: disabled ? "border.soft" : "brand.300",
        bg: disabled ? "bg.surface" : "rgba(140, 169, 255, 0.11)",
      }}
      onClick={disabled ? undefined : onSelect}
      aria-pressed={selected}
      disabled={disabled}
    >
      <VStack align="stretch" spacing={2}>
        <HStack justify="space-between" align="start" spacing={3}>
          <Text fontWeight="700">{title}</Text>
          {meta}
        </HStack>
        <Text color="text.secondary" fontSize="sm">
          {description}
        </Text>
      </VStack>
    </Box>
  );
};
