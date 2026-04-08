import {
  Button,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
} from "@chakra-ui/react";

type ExportMenuProps = {
  onExportJson: () => void;
  onExportCsv?: () => void;
  label?: string;
};

export const ExportMenu = ({
  onExportJson,
  onExportCsv,
  label = "Export",
}: ExportMenuProps) => {
  return (
    <Menu>
      <MenuButton as={Button} size="sm" variant="outline">
        {label}
      </MenuButton>
      <MenuList>
        <MenuItem onClick={onExportJson}>Export JSON</MenuItem>
        {onExportCsv ? <MenuItem onClick={onExportCsv}>Export CSV</MenuItem> : null}
      </MenuList>
    </Menu>
  );
};
