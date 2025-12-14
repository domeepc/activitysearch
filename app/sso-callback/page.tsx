"use client";

import * as React from "react";
import { useSignUp, useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";

export default function SSOCallback() {
  const {
    isLoaded: signUpLoaded,
    signUp,
    setActive: setActiveSignUp,
  } = useSignUp();
  const {
    isLoaded: signInLoaded,
    signIn,
    setActive: setActiveSignIn,
  } = useSignIn();
  const router = useRouter();

  const [showDialog, setShowDialog] = React.useState(false);
  const [username, setUsername] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [isSignIn, setIsSignIn] = React.useState(false);

  React.useEffect(() => {
    if (!signUpLoaded || !signInLoaded) return;

    // Set timeout to redirect to sign-in if taking too long
    const timeoutId = setTimeout(() => {
      console.log("OAuth callback timeout - redirecting to sign-in");
      if (!showDialog) {
        router.push("/sign-in");
      }
    }, 10000); // 10 seconds timeout

    const handleCallback = async () => {
      try {
        console.log("SignUp status:", signUp?.status);
        console.log("SignIn status:", signIn?.status);
        console.log(
          "SignIn firstFactorVerification:",
          signIn?.firstFactorVerification
        );
        console.log("SignUp missingFields:", signUp?.missingFields);

        // Check for sign-in flow first
        if (signIn?.status === "complete") {
          console.log("Sign in complete, redirecting to home");
          clearTimeout(timeoutId);
          await setActiveSignIn({ session: signIn.createdSessionId! });
          router.push("/");
          return;
        }

        // Handle sign-in with missing requirements
        if (
          signIn &&
          signIn.firstFactorVerification?.status === "transferable"
        ) {
          // This means OAuth succeeded but user needs additional info
          const user = signIn.userData;
          console.log("Sign-in needs profile completion", user);

          clearTimeout(timeoutId);
          setIsSignIn(true);

          setShowDialog(true);
          return;
        }

        // Check if we have a sign up in progress
        if (signUp?.status === "missing_requirements") {
          clearTimeout(timeoutId);
          setIsSignIn(false);

          const missingFields = signUp.missingFields || [];
          console.log("Sign-up missing fields:", missingFields);

          if (missingFields.length > 0) {
            // Pre-fill what we can from OAuth
            if (signUp.username) setUsername(signUp.username);

            console.log("Showing dialog for missing fields");
            setShowDialog(true);
          } else {
            console.log(
              "No missing fields,ignIn, setActiveSignUp, setActiveSignIning sign up"
            );
            await setActiveSignUp({ session: signUp.createdSessionId! });
            router.push("/");
          }
        } else if (signUp?.status === "complete") {
          console.log("Sign up complete, redirecting to home");
          clearTimeout(timeoutId);
          await setActiveSignUp({ session: signUp.createdSessionId! });
          router.push("/");
        } else {
          console.log("No active sign up or sign in flow");
        }
      } catch (err) {
        console.error("OAuth callback error:", err);
        console.error("Error type:", typeof err);
        console.error("Error stringified:", JSON.stringify(err, null, 2));
        clearTimeout(timeoutId);
        router.push("/sign-in");
      }
    };

    handleCallback();

    // Cleanup timeout on unmount
    return () => clearTimeout(timeoutId);
  }, [
    signUpLoaded,
    signInLoaded,
    signUp,
    signIn,
    setActiveSignUp,
    setActiveSignIn,
    router,
    showDialog,
  ]);

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username) {
      setError("Username is required");
      return;
    }

    setError("");
    setLoading(true);

    try {
      if (isSignIn && signIn) {
        console.log(
          "Completing OAuth sign-in, creating account with username:",
          username
        );

        // Create a new sign-up with the transferable OAuth data
        try {
          const newSignUp = await signUp!.create({
            username: username,
            transfer: true,
          });

          console.log("SignUp creation result:", newSignUp);

          if (newSignUp.status === "complete") {
            console.log("Account created successfully, setting active session");
            if (setActiveSignUp) {
              await setActiveSignUp({ session: newSignUp.createdSessionId! });
            }
            router.push("/");
          } else if (newSignUp.status === "missing_requirements") {
            console.log("Still missing requirements:", newSignUp.missingFields);
            setError(`Please provide: ${newSignUp.missingFields?.join(", ")}`);
          } else {
            console.log("Unexpected status:", newSignUp.status);
            setError("Unable to complete account setup. Please try again.");
          }
        } catch (createError: unknown) {
          console.error("Error creating account:", createError);
          const error = createError as {
            errors?: Array<{ message: string; longMessage?: string }>;
          };
          const errorMessage =
            error.errors?.[0]?.longMessage ||
            error.errors?.[0]?.message ||
            "Unable to complete account setup. Please try again.";
          setError(errorMessage);
        }
      } else if (signUp) {
        console.log("Updating sign up with username:", username);

        // Update the sign up with the username
        const result = await signUp.update({
          username: username,
        });

        console.log("Update result:", result);
        console.log("SignUp status after update:", result.status);

        if (result.status === "complete") {
          console.log("Sign up complete, setting active session");
          await setActiveSignUp({ session: result.createdSessionId! });
          router.push("/");
        } else if (result.status === "missing_requirements") {
          console.log("Still missing requirements:", result.missingFields);
          setError(`Still missing: ${result.missingFields?.join(", ")}`);
        } else {
          console.log("Unexpected status:", result.status);
          setError("Unable to complete profile. Please try again.");
        }
      } else {
        setError("No sign up or sign in session found. Please try again.");
      }
    } catch (err: unknown) {
      console.error("Error completing profile:", err);
      const error = err as {
        errors?: Array<{ message: string; longMessage?: string }>;
      };
      const errorMessage =
        error.errors?.[0]?.longMessage ||
        error.errors?.[0]?.message ||
        "An error occurred. Please try again.";
      console.error("Error details:", error);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!showDialog) {
    return (
      <>
        {isSignIn ? "sign in" : "sign up"}

        <div className="flex min-h-screen items-center justify-center">
          <Card className="p-6">
            <div className="flex items-center space-x-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-muted-foreground">Completing sign up...</p>
            </div>
          </Card>
        </div>
      </>
    );
  }

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Your Profile</DialogTitle>
          <DialogDescription>
            Please provide the following information to complete your sign up.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleComplete} className="space-y-4">
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
          <div id="clerk-captcha"></div>
          {error && <div className="text-sm text-destructive">{error}</div>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? "Completing..."
              : `Complete ${isSignIn ? "Sign In" : "Sign Up"}`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
