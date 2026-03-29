"use client";

import * as React from "react";
import { useSignUp } from "@clerk/nextjs/legacy";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SIGNED_IN_HOME_HREF } from "@/lib/routes";

export default function SignUpContinuePage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();
  const [username, setUsername] = React.useState("");
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
    if (signUp.username) setUsername(signUp.username);
  }, [isLoaded, signUp, signUp?.status, signUp?.username, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUp) return;

    const needsUsername = (signUp.missingFields ?? []).includes("username");
    if (needsUsername && !username.trim()) {
      setError("Username is required");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const result = await signUp.update(needsUsername ? { username } : {});

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId! });
        router.push(SIGNED_IN_HOME_HREF);
      } else if (result.status === "missing_requirements") {
        setError(`Still missing: ${result.missingFields?.join(", ")}`);
      } else {
        setError("Unable to complete profile. Please try again.");
      }
    } catch (err: unknown) {
      const clerkError = err as { errors?: Array<{ message: string; longMessage?: string }> };
      const msg =
        clerkError.errors?.[0]?.longMessage ??
        clerkError.errors?.[0]?.message ??
        "An error occurred. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Loading…</span>
          </div>
        </Card>
      </div>
    );
  }

  if (!signUp || signUp.status !== "missing_requirements") {
    return null;
  }

  const missingFields = signUp.missingFields ?? [];
  const needsUsername = missingFields.includes("username");

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Complete Your Profile</CardTitle>
          <CardDescription>
            Please provide the following information to complete your sign up.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {needsUsername && (
              <div className="space-y-2">
                <Label htmlFor="username">
                  Username <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="johndoe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            )}
            <div id="clerk-captcha" />
            {error && <div className="text-sm text-destructive">{error}</div>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Completing…" : "Complete Sign Up"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
