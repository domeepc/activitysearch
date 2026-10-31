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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove {friendName} from friends?</DialogTitle>
          <DialogDescription>
            You can still find {friendName} {friendLastname} later and add them again.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" className="h-10" onClick={() => onOpenChange(false)}>
            Keep
          </Button>
          <Button variant="destructive" onClick={onConfirm} className="h-10 font-semibold">
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

