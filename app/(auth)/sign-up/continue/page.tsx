"use client";

import * as React from "react";
import Link from "next/link";
import { useSignUp } from "@clerk/nextjs/legacy";
import { useRouter } from "next/navigation";
import { AtSign, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthFormShell, authFormStyles } from "@/components/auth/AuthFormShell";
import { SIGNED_IN_HOME_HREF } from "@/lib/routes";
import { extractErrorMessage } from "@/lib/errors";

export default function SignUpContinuePage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();
  // null until the user types; until then show the suggestion below
  const [typedUsername, setUsername] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!isLoaded) return;
    if (!signUp) {
      router.replace("/sign-in");
      return;
    }
    if (signUp.status !== "missing_requirements") {
      router.replace(SIGNED_IN_HOME_HREF);
      return;
    }
  }, [isLoaded, signUp, signUp?.status, signUp?.username, router]);

  // Prefill from Clerk, else suggest one from the Google name
  const suggestion =
    signUp?.username ??
    `${signUp?.firstName ?? ""}${signUp?.lastName ?? ""}`.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const username = typedUsername ?? suggestion;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUp) return;

    const needsUsername = (signUp.missingFields ?? []).includes("username");
    if (needsUsername && !username.trim()) {
      setError("Pick a username to continue");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const result = await signUp.update(needsUsername ? { username: username.trim() } : {});

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId! });
        router.push(SIGNED_IN_HOME_HREF);
      } else if (result.status === "missing_requirements") {
        setError(`Still missing: ${result.missingFields?.join(", ")}`);
      } else {
        setError("Unable to complete sign up. Please try again.");
      }
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded || !signUp || signUp.status !== "missing_requirements") {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Loading…</span>
      </div>
    );
  }

  const needsUsername = (signUp.missingFields ?? []).includes("username");
  const provider = signUp.verifications.externalAccount?.strategy?.replace("oauth_", "");

  return (
    <AuthFormShell variant="signup">
      <CardHeader className={authFormStyles.header}>
        <CardTitle className={authFormStyles.title}>One last step</CardTitle>
        <CardDescription className={authFormStyles.description}>
          Choose how friends will find you on ActivitySearch.
        </CardDescription>
      </CardHeader>
      <CardContent className={authFormStyles.content}>
        {signUp.emailAddress && (
          <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3 text-sm">
            {/* Clerk doesn't expose the Google photo until the account exists, so show the generated avatar */}
            <Avatar className="size-10">
              <AvatarFallback
                name={[signUp.firstName, signUp.lastName].filter(Boolean).join(" ") || signUp.emailAddress}
              />
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium">
                {[signUp.firstName, signUp.lastName].filter(Boolean).join(" ") || signUp.emailAddress}
              </p>
              <p className="truncate text-muted-foreground">
                {provider ? <span className="capitalize">{provider}</span> : "Signed up"} · {signUp.emailAddress}
              </p>
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {needsUsername && (
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <AtSign
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  placeholder="johndoe"
                  className="pl-9"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  aria-describedby="username-hint"
                  required
                  disabled={loading}
                />
              </div>
              <p id="username-hint" className="text-xs text-muted-foreground">
                Letters, numbers, dashes and underscores. You can change it later in your profile.
              </p>
            </div>
          )}
          <div id="clerk-captcha" />
          {error && (
            <div role="alert" className={authFormStyles.error}>
              {error}
            </div>
          )}
          <Button type="submit" className="h-10 w-full cursor-pointer" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {loading ? "Finishing sign up…" : "Continue"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className={authFormStyles.footer}>
        <p className="text-sm text-muted-foreground">
          Wrong account?{" "}
          <Link href="/sign-in" className="text-primary hover:underline">
            Use a different one
          </Link>
        </p>
      </CardFooter>
    </AuthFormShell>
  );
}
