import {
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Text,
} from "@chakra-ui/react";
import { ReactNode } from "react";
import { Surface } from "../ui/Surface";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  width?: string;
  render: (item: T) => ReactNode;
};

type DataTableProps<T> = {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  rowKey: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  selectedRowKey?: string;
};

export const DataTable = <T,>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyMessage = "No results found.",
  selectedRowKey,
}: DataTableProps<T>) => {
  return (
    <Surface p={0} overflow="hidden">
      <TableContainer overflowX="auto">
        <Table variant="simple" size="sm">
          <Thead bg="bg.surfaceMuted">
            <Tr>
              {columns.map((column) => (
                <Th key={column.key} width={column.width} textTransform="none" py={4}>
                  {column.header}
                </Th>
              ))}
            </Tr>
          </Thead>
          <Tbody>
            {rows.length === 0 ? (
              <Tr>
                <Td colSpan={columns.length} py={8}>
                  <Text color="text.secondary" textAlign="center">
                    {emptyMessage}
                  </Text>
                </Td>
              </Tr>
            ) : null}
            {rows.map((row) => (
              <Tr
                key={rowKey(row)}
                cursor={onRowClick ? "pointer" : "default"}
                bg={selectedRowKey === rowKey(row) ? "rgba(140, 169, 255, 0.12)" : undefined}
                _hover={onRowClick ? { bg: "bg.surfaceMuted" } : undefined}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => (
                  <Td key={column.key} py={4} verticalAlign="top">
                    {column.render(row)}
                  </Td>
                ))}
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableContainer>
    </Surface>
  );
};
