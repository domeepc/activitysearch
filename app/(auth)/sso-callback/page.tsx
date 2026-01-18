"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { Card } from "@/components/ui/card";

export default function SSOCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="p-6">
        <AuthenticateWithRedirectCallback
          continueSignUpUrl="/sign-up/continue"
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInForceRedirectUrl="/"
          signUpForceRedirectUrl="/"
        />
        <div className="mt-4 flex items-center gap-2 text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Completing sign in…</span>
        </div>
      </Card>
    </div>
  );
}
