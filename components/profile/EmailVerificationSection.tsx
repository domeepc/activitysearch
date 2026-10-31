"use client";

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
    <div className="flex flex-col gap-1.5 text-[13px]">
      <span className="flex min-w-0 items-center gap-2 text-zinc-700 dark:text-zinc-300">
        <Mail className="size-[15px] shrink-0 text-zinc-500" aria-hidden="true" />
        <span className="min-w-0 truncate">{email}</span>
        {verificationStatus === true ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700 dark:bg-green-950/60 dark:text-green-300">
            <Check className="size-3" /> Verified
          </span>
        ) : null}
      </span>
      {verificationStatus === false ? (
        <button
          type="button"
          onClick={onVerifyClick}
          className="self-start rounded-lg text-[13px] font-semibold text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
        >
          Verify your email
        </button>
      ) : null}
    </div>
  );
}
