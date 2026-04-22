import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
} from "@chakra-ui/react";
import { RefObject } from "react";

type ConfirmActionDialogProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmColorScheme?: string;
  isLoading?: boolean;
  leastDestructiveRef: RefObject<HTMLButtonElement>;
  onConfirm: () => void;
  onClose: () => void;
};

export const ConfirmActionDialog = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  confirmColorScheme = "red",
  isLoading = false,
  leastDestructiveRef,
  onConfirm,
  onClose,
}: ConfirmActionDialogProps) => {
  return (
    <AlertDialog
      isOpen={isOpen}
      leastDestructiveRef={leastDestructiveRef}
      onClose={onClose}
      isCentered
    >
      <AlertDialogOverlay>
        <AlertDialogContent bg="bg.surface" border="1px" borderColor="border.soft" boxShadow="floating">
          <AlertDialogHeader fontSize="lg" fontWeight="700">
            {title}
          </AlertDialogHeader>
          <AlertDialogBody>{message}</AlertDialogBody>
          <AlertDialogFooter>
            <Button ref={leastDestructiveRef} variant="ghost" onClick={onClose}>
              {cancelLabel}
            </Button>
            <Button
              colorScheme={confirmColorScheme}
              ml={3}
              onClick={onConfirm}
              isLoading={isLoading}
              loadingText={confirmLabel}
            >
              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
};