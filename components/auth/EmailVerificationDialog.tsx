import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
    <div className="flex min-h-screen items-center justify-center p-3 sm:p-4">
      <Card className="w-full max-w-sm sm:max-w-md">
        <CardHeader className="space-y-1 p-4 sm:p-6">
          <CardTitle className="text-2xl font-bold">
            Verify your email
          </CardTitle>
          <CardDescription>We sent a code to {email}</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
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
            {error && <div className="text-sm text-destructive">{error}</div>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying..." : "Verify Email"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2 p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="text-sm text-muted-foreground text-center">
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
      </Card>
    </div>
  );
}
