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

interface RemoveFriendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  friendName: string;
  friendLastname: string;
}

export function RemoveFriendDialog({
  open,
  onOpenChange,
  onConfirm,
  friendName,
  friendLastname,
}: RemoveFriendDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove Friend</DialogTitle>
          <DialogDescription>
            Are you sure you want to remove {friendName} {friendLastname} from
            your friends list?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Remove Friend
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

