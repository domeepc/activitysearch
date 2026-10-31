"use client";

import * as React from "react";
import { Loader2, MailCheck } from "lucide-react";
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AuthFormShell, authFormStyles } from "@/components/auth/AuthFormShell";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { extractErrorMessage } from "@/lib/errors";

const RESEND_COOLDOWN_SECONDS = 30;
const SLOT_CLASS =
  "h-12 w-11 rounded-xl border text-lg font-semibold first:rounded-l-xl last:rounded-r-xl sm:h-14 sm:w-12";

/**
 * Email code step of the sign-up flows (full screen, inside the auth layout).
 * For profile settings email verification, see: components/profile/dialogs/EmailVerificationDialog.tsx
 */
interface EmailVerificationDialogProps {
  email: string;
  code: string;
  onCodeChange: (value: string) => void;
  onVerify: (e: React.FormEvent) => void;
  onResend: () => unknown;
  /** Back to the form to fix a mistyped email */
  onBack?: () => void;
  error?: string;
  loading?: boolean;
  variant?: "signup" | "organiser";
}

export function EmailVerificationDialog({
  email,
  code,
  onCodeChange,
  onVerify,
  onResend,
  onBack,
  error,
  loading = false,
  variant = "signup",
}: EmailVerificationDialogProps) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [cooldown, setCooldown] = React.useState(RESEND_COOLDOWN_SECONDS);
  const [resendStatus, setResendStatus] = React.useState<string | null>(null);

  // The first code was just sent, so the timer starts right away
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    setResendStatus(null);
    try {
      await onResend();
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setResendStatus("New code sent. Check your inbox.");
    } catch (e) {
      setResendStatus(extractErrorMessage(e));
    }
  };

  return (
    <AuthFormShell variant={variant} containerClassName="items-center">
      <CardHeader className={authFormStyles.header}>
        <span className="mb-2 inline-flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
          <MailCheck className="size-6" aria-hidden="true" />
        </span>
        <CardTitle className={authFormStyles.title}>Check your inbox</CardTitle>
        <CardDescription className={authFormStyles.description}>
          Enter the 6-digit code we sent to{" "}
          <span className="font-medium break-all text-foreground">{email}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className={authFormStyles.content}>
        <form ref={formRef} onSubmit={onVerify} className="space-y-5">
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={onCodeChange}
              // Next tick: the parent reads `code` from state, which updates after this event
              onComplete={() => setTimeout(() => formRef.current?.requestSubmit())}
              disabled={loading}
              autoFocus
              aria-label="Verification code"
              aria-invalid={!!error}
              containerClassName="gap-3"
            >
              <InputOTPGroup className="gap-2">
                {[0, 1, 2].map((i) => (
                  <InputOTPSlot key={i} index={i} className={SLOT_CLASS} aria-invalid={!!error} />
                ))}
              </InputOTPGroup>
              <span aria-hidden="true" className="h-0.5 w-3 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              <InputOTPGroup className="gap-2">
                {[3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} className={SLOT_CLASS} aria-invalid={!!error} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          {error && (
            <div role="alert" className={authFormStyles.error}>
              {error}
            </div>
          )}
          <Button type="submit" className="h-10 w-full cursor-pointer" disabled={loading || code.length < 6}>
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {loading ? "Verifying…" : "Verify email"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className={authFormStyles.footer}>
        <p className="text-sm text-muted-foreground">
          Didn&apos;t get it? Check spam, or{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0}
            className="font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
          >
            {cooldown > 0 ? `resend in ${cooldown}s` : "send a new code"}
          </button>
        </p>
        {resendStatus && (
          <p role="status" className="text-sm text-muted-foreground">
            {resendStatus}
          </p>
        )}
        {onBack && (
          <button type="button" onClick={onBack} className="text-sm text-primary hover:underline">
            Use a different email
          </button>
        )}
      </CardFooter>
    </AuthFormShell>
  );
}
