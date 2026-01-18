"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PasswordRequiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetPassword: () => void;
  onCancel: () => void;
}

export function PasswordRequiredDialog({
  open,
  onOpenChange,
  onSetPassword,
  onCancel,
}: PasswordRequiredDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          onCancel();
        }
      }}
    >
      <DialogContent className="border-border border-2 shadow-xl">
        <DialogHeader>
          <DialogTitle>Password Required</DialogTitle>
          <DialogDescription>
            To unlink OAuth providers, you must first set a password for your
            account. This ensures you can still sign in after removing OAuth
            providers.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" className="border-border" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onSetPassword}>Set Password</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

