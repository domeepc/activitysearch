import { useState, useEffect, useRef } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { extractErrorMessage } from "@/lib/errors";

/**
 * Helper function to find unverified email address from Clerk user
 * Uses a flexible type that works with Clerk's EmailAddressResource
 */
function findUnverifiedEmail<
  T extends { verification?: { status: string | null } | null }
>(emailAddresses: T[]): T | undefined {
  return emailAddresses.find(
    (emailAddr) => emailAddr.verification?.status !== "verified"
  );
}

export function useEmailVerification(email: string) {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const finalizeEmailChange = useAction(api.users.finalizeEmailChange);
  const verificationEmailSentRef = useRef(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [autoSendCooldown, setAutoSendCooldown] = useState(0);
  const [showDialog, setShowDialog] = useState(false);
  const [verificationComplete, setVerificationComplete] = useState(false);

  // Cooldown timer for resend button
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Cooldown timer for auto-send on dialog open (5 minutes)
  useEffect(() => {
    if (autoSendCooldown > 0) {
      const timer = setTimeout(() => {
        setAutoSendCooldown(autoSendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoSendCooldown]);

  // Send verification email when dialog opens (only if no cooldown)
  useEffect(() => {
    if (
      showDialog &&
      clerkUser &&
      !verificationEmailSentRef.current &&
      autoSendCooldown === 0
    ) {
      verificationEmailSentRef.current = true;

      const sendVerificationEmail = async () => {
        try {
          // Reload user to get latest email addresses
          await clerkUser.reload();

          // First, try to find the email that matches the current email address
          let targetEmail = clerkUser.emailAddresses.find(
            (emailAddr) => emailAddr.emailAddress === email
          );

          // If target email not found, look for any unverified email as fallback
          if (!targetEmail) {
            console.warn(
              `Email ${email} not found, looking for any unverified email`
            );
            const unverifiedEmail = findUnverifiedEmail(
              clerkUser.emailAddresses
            );
            if (unverifiedEmail) {
              targetEmail = unverifiedEmail;
            } else {
              setVerificationError(
                `Email address ${email} not found in your account. Please check your email or try resending.`
              );
              return;
            }
          }

          // Check if email is already verified
          if (targetEmail.verification?.status === "verified") {
            setVerificationError("");
            return; // Email is already verified, no need to send
          }

          // Try to prepare verification for the target email
          await targetEmail.prepareVerification({
            strategy: "email_code",
          });

          setVerificationError(""); // Clear any previous errors
          setAutoSendCooldown(300); // 5 minutes cooldown for auto-send
        } catch (error) {
          console.error("Failed to send verification email:", error);
          const errorMessage = extractErrorMessage(error);
          setVerificationError(
            `Failed to send verification email: ${errorMessage}. Please try resending.`
          );
        }
      };

      sendVerificationEmail();
    }

    // Reset the ref when dialog closes
    if (!showDialog) {
      verificationEmailSentRef.current = false;
    }
  }, [showDialog, clerkUser, autoSendCooldown, email]);

  const handleVerifyEmail = async () => {
    if (!clerkUser) return;

    setVerifying(true);
    setVerificationError("");

    try {
      // Reload user to get latest state
      await clerkUser.reload();

      // Find the unverified email address
      const unverifiedEmail = findUnverifiedEmail(clerkUser.emailAddresses);

      if (!unverifiedEmail) {
        setVerificationError("No email address to verify");
        setVerifying(false);
        return;
      }

      // Attempt to verify the email with the code
      await unverifiedEmail.attemptVerification({
        code: verificationCode,
      });

      // Reload user again to get the verified status
      await clerkUser.reload();

      // Find all emails that are NOT the one we just verified
      // These are the old emails that should be deleted
      const emailsToDelete = clerkUser.emailAddresses
        .filter((emailAddr) => emailAddr.id !== unverifiedEmail.id)
        .map((emailAddr) => emailAddr.emailAddress);

      // Make new email primary and delete old emails
      await finalizeEmailChange({
        newEmailId: unverifiedEmail.id,
        oldEmail: emailsToDelete[0] || "", // Take the first old email
      });

      // Reload user one more time to ensure verification status is updated
      await clerkUser.reload();

      setShowDialog(false);
      setVerificationCode("");

      // Mark verification as complete to trigger status re-evaluation
      setVerificationComplete(true);

      // Wait a bit for Convex and Clerk to sync, then refresh the page
      // This ensures the verification status is updated before the badge is re-rendered
      setTimeout(async () => {
        // Reload user one more time to ensure we have the latest verification status
        await clerkUser.reload();
        router.refresh();
      }, 1500);
    } catch (error: unknown) {
      setVerificationError(extractErrorMessage(error));
    } finally {
      setVerifying(false);
    }
  };

  const handleResendVerificationEmail = async () => {
    if (!clerkUser || resendCooldown > 0) return;

    try {
      await clerkUser.reload();

      // First, try to find the email that matches the current email address
      let targetEmail = clerkUser.emailAddresses.find(
        (emailAddr) => emailAddr.emailAddress === email
      );

      // If target email not found, look for any unverified email as fallback
      if (!targetEmail) {
        console.warn(
          `Email ${email} not found, looking for any unverified email`
        );
        const unverifiedEmail = findUnverifiedEmail(clerkUser.emailAddresses);
        if (unverifiedEmail) {
          targetEmail = unverifiedEmail;
        } else {
          setVerificationError(
            `Email address ${email} not found in your account.`
          );
          return;
        }
      }

      // Check if email is already verified
      if (targetEmail.verification?.status === "verified") {
        setVerificationError("");
        return; // Email is already verified
      }

      // Try to prepare verification for the target email
      await targetEmail.prepareVerification({ strategy: "email_code" });
      setVerificationError("");
      setResendCooldown(60); // 60 second cooldown
    } catch (error) {
      console.error("Failed to resend verification email:", error);
      const errorMessage = extractErrorMessage(error);
      setVerificationError(
        `Failed to resend verification email: ${errorMessage}. Please try again.`
      );
    }
  };

  const getEmailVerificationStatus = (): boolean | null => {
    if (!clerkUser) return null;
    // Find the email that matches the current email
    const currentEmail = clerkUser.emailAddresses.find(
      (emailAddr) => emailAddr.emailAddress === email
    );
    // Also check if this is the primary email
    const isPrimary = currentEmail?.id === clerkUser.primaryEmailAddressId;
    // Check if email exists and has a verification object with verified status
    if (!currentEmail?.verification) return false;
    return currentEmail.verification.status === "verified" && isPrimary;
  };

  // Force re-evaluation of verification status when verification completes
  // This ensures the badge updates immediately after verification
  // The verificationComplete flag is included in the dependency to trigger re-render
  useEffect(() => {
    if (verificationComplete) {
      // The router.refresh() will handle the page refresh,
      // but we also want to ensure the status is re-evaluated
      // Reset the flag after a short delay
      const timer = setTimeout(() => {
        setVerificationComplete(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [verificationComplete]);

  return {
    verificationCode,
    setVerificationCode,
    verifying,
    verificationError,
    resendCooldown,
    showDialog,
    setShowDialog,
    handleVerifyEmail,
    handleResendVerificationEmail,
    getEmailVerificationStatus,
  };
}
