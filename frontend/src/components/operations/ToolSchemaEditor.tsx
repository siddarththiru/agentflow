import { FormControl, FormHelperText, FormLabel, Textarea } from "@chakra-ui/react";

type ToolSchemaEditorProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helperText: string;
};

export const ToolSchemaEditor = ({
  label,
  value,
  onChange,
  helperText,
}: ToolSchemaEditorProps) => {
  return (
    <FormControl>
      <FormLabel fontSize="sm" fontWeight="700" color="text.secondary" mb={1.5}>
        {label}
      </FormLabel>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        minH="170px"
        fontFamily="mono"
        fontSize="sm"
        placeholder='{"type": "object", "properties": {}}'
      />
      <FormHelperText>{helperText}</FormHelperText>
    </FormControl>
  );
};
