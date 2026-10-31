"use client";

import Image from "next/image";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { SIGNED_IN_HOME_HREF } from "@/lib/routes";

export default function SSOCallbackPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6">
      <Image src="/full-logo.svg" alt="ActivitySearch" width={148} height={36} className="dark:hidden" priority />
      <Image
        src="/full-logo-dark.svg"
        alt="ActivitySearch"
        width={148}
        height={36}
        className="hidden dark:block"
        priority
      />

      <div className="flex flex-col items-center gap-4 text-center" role="status" aria-live="polite">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/60">
          <Loader2 className="size-6 animate-spin text-blue-600 dark:text-blue-400" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Signing you in</h1>
          <p className="text-sm text-muted-foreground">This only takes a moment.</p>
        </div>
      </div>

      {/* A first-time Google sign-in becomes a sign-up here, and Clerk's bot check needs this mount point */}
      <div id="clerk-captcha" className="empty:hidden" />

      <AuthenticateWithRedirectCallback
        continueSignUpUrl="/sign-up/continue"
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
        signInForceRedirectUrl="/sso-callback"
        signUpForceRedirectUrl="/sso-callback"
        signInFallbackRedirectUrl={SIGNED_IN_HOME_HREF}
        signUpFallbackRedirectUrl={SIGNED_IN_HOME_HREF}
      />
    </main>
  );
}
