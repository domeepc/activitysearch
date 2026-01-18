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

interface UnlinkOAuthWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UnlinkOAuthWarningDialog({
  open,
  onOpenChange,
}: UnlinkOAuthWarningDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cannot Unlink Google Account</DialogTitle>
          <DialogDescription>
            Google email accounts cannot be removed through the interface due to
            Google&apos;s security policies. If you need to unlink your Google
            account, please contact us at support@activitysearch.com for
            assistance.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

