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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Mail } from "lucide-react";

/**
 * EmailVerificationDialog for profile settings
 * This is a modal dialog component used in profile settings for email verification.
 * For sign-up flow email verification, see: components/auth/EmailVerificationDialog.tsx
 */
interface EmailVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  verificationCode: string;
  onVerificationCodeChange: (value: string) => void;
  verifying: boolean;
  verificationError: string;
  resendCooldown: number;
  onVerify: () => void;
  onResend: () => void;
}

export function EmailVerificationDialog({
  open,
  onOpenChange,
  verificationCode,
  onVerificationCodeChange,
  verifying,
  verificationError,
  resendCooldown,
  onVerify,
  onResend,
}: EmailVerificationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Verify Your Email
          </DialogTitle>
          <DialogDescription>
            We&apos;ve sent a verification code to your new email address.
            Please enter the code below to verify your email.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="verification-code">Verification Code</Label>
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={verificationCode}
                onChange={onVerificationCodeChange}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            {verificationError && (
              <p className="text-sm font-medium text-destructive text-center">
                {verificationError}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={onResend}
            disabled={resendCooldown > 0}
          >
            {resendCooldown > 0
              ? `Resend Code (${resendCooldown}s)`
              : "Resend Code"}
          </Button>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={onVerify}
            disabled={verifying || verificationCode.length !== 6}
          >
            {verifying ? "Verifying..." : "Verify Email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
