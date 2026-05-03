import { Flex, FlexProps } from "@chakra-ui/react";
import { ReactNode } from "react";
import { Surface } from "../ui/Surface";

type FilterBarProps = FlexProps & {
  children: ReactNode;
};

export const FilterBar = ({ children, ...rest }: FilterBarProps) => {
  return (
    <Surface p={4} {...rest}>
      <Flex
        direction={{ base: "column", md: "row" }}
        gap={3}
        align={{ base: "stretch", md: "end" }}
        flexWrap="wrap"
      >
        {children}
      </Flex>
    </Surface>
  );
};
