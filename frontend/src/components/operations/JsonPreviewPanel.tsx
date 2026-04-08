import { Code, Text, VStack } from "@chakra-ui/react";
import { Surface } from "../ui/Surface";

type JsonPreviewPanelProps = {
  title: string;
  data: unknown;
  maxHeight?: string;
};

export const JsonPreviewPanel = ({
  title,
  data,
  maxHeight = "220px",
}: JsonPreviewPanelProps) => {
  return (
    <Surface bg="bg.surfaceMuted">
      <VStack align="stretch" spacing={3}>
        <Text fontWeight="700">{title}</Text>
        <Code
          display="block"
          whiteSpace="pre"
          overflowX="auto"
          overflowY="auto"
          maxH={maxHeight}
          p={3}
          border="1px solid"
          borderColor="border.soft"
          borderRadius="md"
          bg="bg.surface"
        >
          {JSON.stringify(data, null, 2)}
        </Code>
      </VStack>
    </Surface>
  );
};
