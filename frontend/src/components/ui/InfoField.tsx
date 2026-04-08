import {
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
} from "@chakra-ui/react";
import { ReactNode } from "react";

type InfoFieldProps = {
  label: string;
  helperText?: string;
  error?: string;
  isRequired?: boolean;
  children: ReactNode;
};

export const InfoField = ({
  label,
  helperText,
  error,
  isRequired,
  children,
}: InfoFieldProps) => {
  return (
    <FormControl isInvalid={Boolean(error)} isRequired={isRequired}>
      <FormLabel fontSize="sm" fontWeight="700" color="text.secondary" mb={1.5}>
        {label}
      </FormLabel>
      {children}
      {error ? (
        <FormErrorMessage>{error}</FormErrorMessage>
      ) : helperText ? (
        <FormHelperText>{helperText}</FormHelperText>
      ) : null}
    </FormControl>
  );
};
