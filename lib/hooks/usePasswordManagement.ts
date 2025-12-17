import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { extractErrorMessage } from "@/lib/errors";
import type { OAuthProvider } from "@/lib/types/profile";

export function usePasswordManagement() {
  const { user: clerkUser } = useUser();
  const unlinkOAuthProvider = useAction(api.users.unlinkOAuthProvider);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [settingPassword, setSettingPassword] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [showPasswordRequiredDialog, setShowPasswordRequiredDialog] =
    useState(false);
  const [pendingUnlinkProvider, setPendingUnlinkProvider] =
    useState<OAuthProvider | null>(null);

  const handleSetPassword = async () => {
    setPasswordError("");

    if (!newPassword || !confirmPassword) {
      setPasswordError("Please fill in all fields");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setSettingPassword(true);

    try {
      const hasPassword = clerkUser?.passwordEnabled;

      if (hasPassword) {
        // User already has a password, change it
        if (!currentPassword) {
          setPasswordError("Please enter your current password");
          setSettingPassword(false);
          return;
        }
        await clerkUser?.updatePassword({
          currentPassword,
          newPassword,
        });
      } else {
        // User doesn't have a password, create one
        await clerkUser?.updatePassword({
          newPassword,
        });
      }

      await clerkUser?.reload();
      setShowDialog(false);
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPassword("");
      setPasswordError("");

      // If there's a pending unlink, show the password required dialog again
      if (pendingUnlinkProvider) {
        // Now that password is set, attempt to unlink
        try {
          await unlinkOAuthProvider({ provider: pendingUnlinkProvider });
          await clerkUser?.reload();
          setTimeout(() => window.location.reload(), 500);
        } catch (error) {
          console.error(`Failed to unlink ${pendingUnlinkProvider}:`, error);
        }
        setPendingUnlinkProvider(null);
        setShowPasswordRequiredDialog(false);
      }
    } catch (error: unknown) {
      console.error("Failed to set/update password:", error);
      setPasswordError(extractErrorMessage(error));
    } finally {
      setSettingPassword(false);
    }
  };

  const resetPasswordForm = () => {
    setNewPassword("");
    setConfirmPassword("");
    setCurrentPassword("");
    setPasswordError("");
  };

  return {
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    currentPassword,
    setCurrentPassword,
    passwordError,
    settingPassword,
    showDialog,
    setShowDialog,
    showPasswordRequiredDialog,
    setShowPasswordRequiredDialog,
    pendingUnlinkProvider,
    setPendingUnlinkProvider,
    handleSetPassword,
    resetPasswordForm,
  };
}

