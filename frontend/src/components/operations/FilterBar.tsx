import { Stack, StackProps } from "@chakra-ui/react";
import { ReactNode } from "react";
import { Surface } from "../ui/Surface";

type FilterBarProps = StackProps & {
  children: ReactNode;
};

export const FilterBar = ({ children, ...rest }: FilterBarProps) => {
  return (
    <Surface p={4} {...rest}>
      <Stack direction={{ base: "column", md: "row" }} spacing={3} align={{ base: "stretch", md: "end" }}>
        {children}
      </Stack>
    </Surface>
  );
};
