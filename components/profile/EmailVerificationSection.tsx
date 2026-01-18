"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Mail } from "lucide-react";
import type { EmailVerificationStatus } from "@/lib/types/profile";

interface EmailVerificationSectionProps {
  email: string;
  verificationStatus: EmailVerificationStatus;
  onVerifyClick: () => void;
}

export function EmailVerificationSection({
  email,
  verificationStatus,
  onVerifyClick,
}: EmailVerificationSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">{email}</p>
        {verificationStatus === true ? (
          <Badge variant="default" className="flex items-center gap-1">
            <Check className="h-3 w-3" />
            Verified
          </Badge>
        ) : verificationStatus === false ? (
          <Badge
            variant="outline"
            className="flex items-center gap-1 cursor-pointer hover:bg-accent"
            onClick={onVerifyClick}
          >
            <Mail className="h-3 w-3" />
            Not Verified - Click to Verify
          </Badge>
        ) : null}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">
          Verify your email to unlock all features and ensure account security.
        </p>
      </div>
    </div>
  );
}

