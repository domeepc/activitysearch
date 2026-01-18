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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";

interface PasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPassword: string;
  onCurrentPasswordChange: (value: string) => void;
  newPassword: string;
  onNewPasswordChange: (value: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (value: string) => void;
  passwordError: string;
  settingPassword: boolean;
  hasPassword: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PasswordDialog({
  open,
  onOpenChange,
  currentPassword,
  onCurrentPasswordChange,
  newPassword,
  onNewPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  passwordError,
  settingPassword,
  hasPassword,
  onConfirm,
  onCancel,
}: PasswordDialogProps) {
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {hasPassword ? "Change Password" : "Set Password"}
          </DialogTitle>
          <DialogDescription>
            {hasPassword
              ? "Enter your current password and choose a new one."
              : "Set a password to secure your account and enable OAuth unlinking."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {hasPassword && (
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                name="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => onCurrentPasswordChange(e.target.value)}
                placeholder="Enter current password"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              name="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => onNewPasswordChange(e.target.value)}
              placeholder="Enter new password (min. 8 characters)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              name="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => onConfirmPasswordChange(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>
          {passwordError && (
            <p className="text-sm font-medium text-destructive">
              {passwordError}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={settingPassword}>
            {settingPassword
              ? "Setting..."
              : hasPassword
              ? "Change Password"
              : "Set Password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

