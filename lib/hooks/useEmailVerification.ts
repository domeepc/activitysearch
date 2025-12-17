import { useState, useEffect, useRef } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { extractErrorMessage } from "@/lib/errors";

export function useEmailVerification(email: string) {
  const { user: clerkUser } = useUser();
  const finalizeEmailChange = useAction(api.users.finalizeEmailChange);
  const verificationEmailSentRef = useRef(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [autoSendCooldown, setAutoSendCooldown] = useState(0);
  const [showDialog, setShowDialog] = useState(false);

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
          await clerkUser.reload();
          const unverifiedEmail = clerkUser.emailAddresses.find(
            (emailAddr) => emailAddr.verification?.status !== "verified"
          );

          if (unverifiedEmail) {
            await unverifiedEmail.prepareVerification({
              strategy: "email_code",
            });
            setAutoSendCooldown(300); // 5 minutes cooldown for auto-send
          } else {
            setVerificationError(
              "No unverified email address found. Please try again."
            );
          }
        } catch (error) {
          console.error("Failed to send verification email:", error);
          setVerificationError(
            "Failed to send verification email. Please try resending."
          );
        }
      };

      sendVerificationEmail();
    }

    // Reset the ref when dialog closes
    if (!showDialog) {
      verificationEmailSentRef.current = false;
    }
  }, [showDialog, clerkUser, autoSendCooldown]);

  const handleVerifyEmail = async () => {
    if (!clerkUser) return;

    setVerifying(true);
    setVerificationError("");

    try {
      // Reload user to get latest state
      await clerkUser.reload();

      // Find the unverified email address
      const unverifiedEmail = clerkUser.emailAddresses.find(
        (emailAddr) => emailAddr.verification?.status !== "verified"
      );

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

      setShowDialog(false);
      setVerificationCode("");

      // Wait a bit for Convex to sync, then reload the page to update the profile
      setTimeout(() => {
        window.location.reload();
      }, 1000);
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
      const unverifiedEmail = clerkUser.emailAddresses.find(
        (emailAddr) => emailAddr.verification?.status !== "verified"
      );

      if (unverifiedEmail) {
        await unverifiedEmail.prepareVerification({ strategy: "email_code" });
        setVerificationError("");
        setResendCooldown(60); // 60 second cooldown
      } else {
        setVerificationError("No unverified email found");
      }
    } catch (error) {
      console.error("Failed to resend verification email:", error);
      setVerificationError(
        "Failed to resend verification email. Please try again."
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

