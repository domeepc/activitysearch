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

  // Get the return URL from sessionStorage or default to home
  const getReturnUrl = React.useCallback(() => {
    if (typeof window !== "undefined") {
      const returnUrl = sessionStorage.getItem("oauth_return_url");
      sessionStorage.removeItem("oauth_return_url");
      return returnUrl || "/";
    }
    return "/";
  }, []);

  // Get OAuth origin (sign-up or sign-in) from sessionStorage
  // Don't remove it immediately - we'll remove it after handling
  const getOAuthOrigin = React.useCallback(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("oauth_origin") || "sign-in"; // Default to sign-in for safety
    }
    return "sign-in";
  }, []);
  
  // Remove OAuth origin after use
  const clearOAuthOrigin = React.useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("oauth_origin");
    }
  }, []);

  React.useEffect(() => {
    if (!signUpLoaded || !signInLoaded) return;

    const handleCallback = async () => {
      try {
        const oauthOrigin = getOAuthOrigin();

        // Priority 1: Check for completed sign-in (existing user)
        if (signIn?.status === "complete") {
          clearOAuthOrigin();
          await setActiveSignIn({ session: signIn.createdSessionId! });
          const returnUrl = getReturnUrl();
          router.push(returnUrl);
          return;
        }

        // Priority 2: Check for completed sign-up (new user completed registration)
        if (signUp?.status === "complete") {
          clearOAuthOrigin();
          await setActiveSignUp({ session: signUp.createdSessionId! });
          const returnUrl = getReturnUrl();
          router.push(returnUrl);
          return;
        }

        // Priority 3: Check if we have a sign-in object when coming from sign-up
        // This indicates user already has an account (OAuth succeeded but account exists)
        // If coming from sign-up flow and we have signIn, user already has account → redirect to homepage
        // If coming from sign-in flow and signIn needs completion, handle accordingly
        if (oauthOrigin === "sign-up" && signIn && !signUp) {
          // User tried to sign up but Clerk created a sign-in instead
          // This means the account already exists
          clearOAuthOrigin();
          const returnUrl = getReturnUrl();
          router.push(returnUrl || "/");
          return;
        }
        
        // Priority 3b: Handle sign-in that needs completion (user doesn't have account)
        // This would be when coming from sign-in flow but account doesn't exist
        if (oauthOrigin === "sign-in" && signIn && signIn.firstFactorVerification && !signUp) {
          // User tried to sign in but doesn't have account → prompt for username to create account
          clearOAuthOrigin();
          setIsSignIn(true);
          setShowDialog(true);
          return;
        }

        // Priority 4: Sign-up needs additional info (username)
        // BUT: If this sign-up came from OAuth sign-up flow and we also have a signIn object,
        // it means user already has account, so redirect to homepage instead
        if (signUp?.status === "missing_requirements") {
          // Check if we also have a signIn object from sign-up flow
          // This handles the case where Clerk creates both signUp and signIn objects
          if (signIn && oauthOrigin === "sign-up") {
            // User already has account, redirect to homepage
            clearOAuthOrigin();
            const returnUrl = getReturnUrl();
            router.push(returnUrl || "/");
            return;
          }
          
          const missingFields = signUp.missingFields || [];

          if (missingFields.length > 0) {
            // Pre-fill username if available
            if (signUp.username) setUsername(signUp.username);
            setIsSignIn(false);
            setShowDialog(true);
            return;
          } else {
            // No missing fields, complete sign-up
            clearOAuthOrigin();
            await setActiveSignUp({ session: signUp.createdSessionId! });
            const returnUrl = getReturnUrl();
            router.push(returnUrl);
            return;
          }
        }
      } catch (err) {
        console.error("❌ OAuth callback error:", err);
        router.push("/sign-in");
      }
    };

    handleCallback();
  }, [
    signUpLoaded,
    signInLoaded,
    signUp,
    signIn,
    signUp?.status,
    signIn?.status,
    signIn?.firstFactorVerification?.status,
    signUp?.missingFields,
    setActiveSignUp,
    setActiveSignIn,
    router,
    getReturnUrl,
    getOAuthOrigin,
    clearOAuthOrigin,
    signUp?.createdSessionId,
    signUp?.username,
    signIn?.firstFactorVerification,
    signIn?.createdSessionId,
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
        // Create a new sign-up with the transferable OAuth data
        try {
          const newSignUp = await signUp!.create({
            username: username,
            transfer: true,
          });

          if (newSignUp.status === "complete") {
            if (setActiveSignUp) {
              await setActiveSignUp({ session: newSignUp.createdSessionId! });
            }
            const returnUrl = getReturnUrl();
            router.push(returnUrl);
          } else if (newSignUp.status === "missing_requirements") {
            setError(`Please provide: ${newSignUp.missingFields?.join(", ")}`);
          } else {
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
        // Update the sign up with the username
        const result = await signUp.update({
          username: username,
        });

        if (result.status === "complete") {
          await setActiveSignUp({ session: result.createdSessionId! });
          const returnUrl = getReturnUrl();
          router.push(returnUrl);
        } else if (result.status === "missing_requirements") {
          setError(`Still missing: ${result.missingFields?.join(", ")}`);
        } else {
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

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      // Dialog is being closed - redirect to previous page
      const returnUrl = getReturnUrl();
      router.push(returnUrl);
    }
  };

  return (
    <Dialog open={showDialog} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Your Profile</DialogTitle>
          <DialogDescription>
            Please provide the following information to complete your{" "}
            {isSignIn ? "sign in" : "sign up"}.
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
