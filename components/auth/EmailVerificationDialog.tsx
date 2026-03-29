import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AuthFormShell, authFormStyles } from "@/components/auth/AuthFormShell";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

/**
 * EmailVerificationDialog for sign-up flow
 * This is a full-screen card component used during the authentication sign-up process.
 * For profile settings email verification, see: components/profile/dialogs/EmailVerificationDialog.tsx
 */
interface EmailVerificationDialogProps {
  email: string;
  code: string;
  onCodeChange: (value: string) => void;
  onVerify: (e: React.FormEvent) => void;
  onResend: () => void;
  error?: string;
  loading?: boolean;
  resendCooldown?: number;
}

export function EmailVerificationDialog({
  email,
  code,
  onCodeChange,
  onVerify,
  onResend,
  error,
  loading = false,
  resendCooldown = 0,
}: EmailVerificationDialogProps) {
  return (
    <AuthFormShell containerClassName="items-center">
      <CardHeader className={authFormStyles.header}>
        <CardTitle className={authFormStyles.title}>
            Verify your email
        </CardTitle>
        <CardDescription className={authFormStyles.description}>
          We sent a code to {email}
        </CardDescription>
      </CardHeader>
      <CardContent className={authFormStyles.content}>
          <form onSubmit={onVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Verification Code</Label>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={code} onChange={onCodeChange}>
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
            </div>
            {error && <div className={authFormStyles.error}>{error}</div>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying..." : "Verify Email"}
            </Button>
          </form>
      </CardContent>
      <CardFooter className={authFormStyles.footer}>
        <div className="text-center text-sm text-muted-foreground">
            Didn&apos;t receive a code?{" "}
            <button
              onClick={onResend}
              disabled={resendCooldown > 0}
              className="text-primary hover:underline disabled:opacity-50"
            >
              {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : "Resend"}
            </button>
        </div>
      </CardFooter>
    </AuthFormShell>
  );
}
