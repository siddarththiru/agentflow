import { Divider, HStack, Text, VStack } from "@chakra-ui/react";

type KeyValueItem = {
  label: string;
  value: string;
};

type KeyValueListProps = {
  items: KeyValueItem[];
};

export const KeyValueList = ({ items }: KeyValueListProps) => {
  return (
    <VStack align="stretch" spacing={2}>
      {items.map((item, index) => (
        <VStack key={item.label} align="stretch" spacing={2}>
          <HStack justify="space-between" align="start" spacing={4}>
            <Text color="text.secondary" fontSize="sm" fontWeight="600">
              {item.label}
            </Text>
            <Text color="text.primary" textAlign="right" maxW="60%">
              {item.value}
            </Text>
          </HStack>
          {index < items.length - 1 ? <Divider borderColor="border.soft" /> : null}
        </VStack>
      ))}
    </VStack>
  );
};
